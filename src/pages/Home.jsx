import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  getEvents,
  loginUser,
  registerUser,
  signInWithGoogle,
  getActivityFeed,
} from '../utils/storage';
import { DISCOVERY_CITIES } from '../data/mockData';
import { formatDate, formatTime, formatINR, digitsOnly, isTenDigitPhone } from '../utils/helpers';
import { useTransition } from '../hooks/useTransition';
import SvgDecor from '../components/SvgDecor';
import Reveal from '../components/Reveal';
import Logo from '../components/Logo';
import TurnstileWidget from '../components/TurnstileWidget';
import './Home.css';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

function Home({
  currentUser,
  setCurrentUser,
  activeTab,
  setActiveTab,
  loginRedirect,
  setLoginRedirect,
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const { playTransition } = useTransition();
  const [events] = useState(() => getEvents());
  const [selectedCity, setSelectedCity] = useState('All');
  const [search, setSearch] = useState('');
  const [priceFilter, setPriceFilter] = useState('all'); // all | free | paid
  
  // Sync tab transitions from other pages
  useEffect(() => {
    if (location.state?.tab) {
      setActiveTab(location.state.tab);
      if (location.state.redirect !== undefined) {
        setLoginRedirect(location.state.redirect);
      }
      // Clean up router state
      window.history.replaceState({}, document.title);
    }
  }, [location.state, setActiveTab, setLoginRedirect]);
  
  // Auth states
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Cloudflare Turnstile: token feeds Supabase auth calls; bump the nonce to force
  // a fresh widget (single-use token) after a failed attempt.
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaNonce, setCaptchaNonce] = useState(0);
  const captchaRequired = !!TURNSTILE_SITE_KEY;
  const resetCaptcha = () => { setCaptchaToken(''); setCaptchaNonce((n) => n + 1); };

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupUsername, setSignupUsername] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupDob, setSignupDob] = useState('');
  const [signupPhone, setSignupPhone] = useState('');

  const discoverableEvents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events
      .filter(event => event.discoverable !== false)
      .filter(event => selectedCity === 'All' || event.city === selectedCity)
      .filter(event => priceFilter === 'all'
        || (priceFilter === 'free' && !event.cover_charge)
        || (priceFilter === 'paid' && event.cover_charge > 0))
      .filter(event => !q
        || event.name?.toLowerCase().includes(q)
        || event.location_name?.toLowerCase().includes(q)
        || (event.vibe_tags || []).some(t => t.toLowerCase().includes(q)))
      .sort((a, b) => new Date(`${a.date}T${a.time_start || '00:00'}`) - new Date(`${b.date}T${b.time_start || '00:00'}`));
  }, [events, selectedCity, search, priceFilter]);

  const activityFeed = useMemo(
    () => (currentUser ? getActivityFeed(currentUser.id) : []),
    [currentUser]
  );

  // Find user's hosted parties
  const hostedEvents = useMemo(() => {
    if (!currentUser) return [];
    return events.filter(event => event.host_id === currentUser.id);
  }, [events, currentUser]);

  // Find user's RSVP'd parties
  const rsvpedEvents = useMemo(() => {
    if (!currentUser) return [];
    const allRsvps = JSON.parse(localStorage.getItem('lowkey_rsvps') || '[]');
    const userRsvps = allRsvps.filter(
      r => r.user_id === currentUser.id || r.guest_name.toLowerCase() === currentUser.name.toLowerCase()
    );
    return userRsvps
      .map(rsvp => {
        const ev = events.find(e => e.id === rsvp.event_id);
        return ev ? { ...ev, rsvpStatus: rsvp.status } : null;
      })
      .filter(Boolean);
  }, [events, currentUser]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    setAuthSubmitting(true);
    try {
      const res = await loginUser(loginUsername, loginPassword, captchaToken || undefined);
      if (res.success) {
        await playTransition(() => {
          setCurrentUser(res.user);
          if (loginRedirect) {
            setLoginRedirect(false);
            navigate('/create');
          } else {
            setActiveTab('discover');
          }
        });
      } else {
        setAuthError(res.error);
        resetCaptcha();
      }
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    setAuthNotice('');
    setAuthSubmitting(true);
    // On success the browser redirects to Google, so we only land here on error.
    const res = await signInWithGoogle();
    if (!res.success) {
      setAuthError(res.error || "Couldn't start Google sign-in. Please try again.");
      setAuthSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthNotice('');
    if (!signupUsername || !signupEmail || !signupName || !signupPassword || !signupDob) {
      setAuthError('Please fill in all required fields.');
      return;
    }
    if (signupPhone && !isTenDigitPhone(signupPhone)) {
      setAuthError('Please enter a valid 10-digit phone number (or leave it blank).');
      return;
    }

    const newUser = {
      username: signupUsername,
      email: signupEmail,
      name: signupName,
      password: signupPassword,
      birthdate: signupDob,
      phone: signupPhone
    };

    setAuthSubmitting(true);
    try {
      const res = await registerUser(newUser, captchaToken || undefined);
      if (!res.success) {
        setAuthError(res.error);
        resetCaptcha();
        return;
      }
      if (res.needsConfirmation) {
        // Email confirmation is enabled on the Supabase project.
        setAuthNotice('Almost there! Check your email to confirm your account, then log in.');
        setIsSignUp(false);
        resetCaptcha();
        return;
      }
      await playTransition(() => {
        setCurrentUser(res.user);
        if (loginRedirect) {
          setLoginRedirect(false);
          navigate('/create');
        } else {
          setActiveTab('discover');
        }
      });
    } finally {
      setAuthSubmitting(false);
    }
  };

  const isEventExpired = (dateStr) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
  };

  return (
    <div className="home-container">
      {/* Page Wrapper */}
      <div className="page home">
        {/* Brand Header */}
        <header className="home-header animate-fade-in-up">
          <SvgDecor variant="hero" />
          <Logo size={72} className="home-logo__mark" />
          <div className="home-logo">
            <span className="home-logo__text brand-cursive text-gradient">lowkey</span>
          </div>
          <p className="home-tagline tagline-culture">for the culture</p>
        </header>

      {/* Tab Contents */}
      {activeTab === 'discover' && (
        <>
          {/* Hero */}
          <section className="home-hero animate-fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="home-hero__card glass-strong">
              <h2 className="home-hero__title">throw or find a house party<br /><span className="text-gradient-aurora">worth talking about</span></h2>
              <p className="home-hero__desc">
                Discover nearby scenes, create aesthetic invites, split the bill, manage RSVPs, and keep the afters in one place.
              </p>
              <div className="home-hero__actions">
                <button
                  className="home-cta-button"
                  onClick={() => {
                    if (currentUser) {
                      navigate('/create');
                    } else {
                      setLoginRedirect(true);
                      setAuthError('');
                      setActiveTab('login');
                    }
                  }}
                  type="button"
                >
                  <span>Host a Party</span>
                  <span className="home-cta-button__arrow">→</span>
                </button>
              </div>
              <div className="home-party-badge">
                <span className="home-party-badge__number">{events.length}</span>
                <span className="home-party-badge__text">parties live across India</span>
              </div>
            </div>
          </section>

          {/* Activity feed — from hosts you follow */}
          {currentUser && activityFeed.length > 0 && (
            <section className="home-activity animate-fade-in-up">
              <h3 className="home-section-title">From hosts you follow</h3>
              <div className="home-activity__scroll">
                {activityFeed.map(event => (
                  <Link key={event.id} to={`/invite/${event.id}`} className="home-activity__card glass pressable">
                    <span className="home-activity__host">{event.host_name}</span>
                    <span className="home-activity__name">{event.name}</span>
                    <span className="home-activity__meta">{formatDate(event.date)} · {event.city || 'India'}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Discover Listing */}
          <section id="discover" className="home-discover animate-fade-in-up" style={{ animationDelay: '180ms' }}>
            <div className="home-section-row">
              <h3 className="home-section-title">discover parties</h3>
              <span className="home-section-chip">India Beta</span>
            </div>

            {/* Search + price filter */}
            <div className="home-search-row">
              <input
                className="home-search-input"
                type="search"
                placeholder="🔍 search parties, vibes, spots…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search parties"
              />
              <div className="home-price-filter">
                {[['all', 'All'], ['free', 'Free'], ['paid', 'Paid']].map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    className={`home-price-chip${priceFilter === val ? ' active' : ''}`}
                    onClick={() => setPriceFilter(val)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="home-city-tabs" aria-label="Filter parties by city">
              {DISCOVERY_CITIES.map(city => (
                <button
                  key={city}
                  className={`home-city-tab${selectedCity === city ? ' home-city-tab--active' : ''}`}
                  onClick={() => setSelectedCity(city)}
                  type="button"
                >
                  {city}
                </button>
              ))}
            </div>

            {discoverableEvents.length > 0 ? (
              <div className="home-discovery-grid">
                {discoverableEvents.map((event, i) => (
                  <Reveal
                    as={Link}
                    key={event.id}
                    variant="up"
                    delay={Math.min(i * 60, 360)}
                    to={`/invite/${event.id}`}
                    className={`home-discovery-card pressable ${event.theme ? `theme-${event.theme}` : 'theme-neon'}`}
                  >
                    <div className="home-discovery-card__shade" />
                    <div className="home-discovery-card__content">
                      <div className="home-discovery-card__topline">
                        <span>{event.city || 'India'}</span>
                        <span>{event.cover_charge ? formatINR(event.cover_charge) : 'Free'}</span>
                      </div>
                      <h4 className="home-discovery-card__name">{event.name}</h4>
                      <p className="home-discovery-card__meta">
                        {formatDate(event.date)} · {formatTime(event.time_start)}
                      </p>
                      <div className="home-discovery-card__tags">
                        {(event.vibe_tags || []).slice(0, 3).map(tag => (
                          <span key={tag}>{tag}</span>
                        ))}
                        {event.contains_alcohol && <span className="tag-alcohol">21+</span>}
                      </div>
                      <div className="home-discovery-card__footer">
                        <span>{event.capacity ? `${event.capacity} cap` : 'limited list'}</span>
                        {event.has_personal_dj && <span>DJ set</span>}
                      </div>
                    </div>
                  </Reveal>
                ))}
              </div>
            ) : (
              <div className="home-empty glass">
                <p>No discoverable parties in {selectedCity} yet.</p>
                <button 
                  className="home-empty-btn"
                  onClick={() => {
                    if (currentUser) {
                      navigate('/create');
                    } else {
                      setLoginRedirect(true);
                      setAuthError('');
                      setActiveTab('login');
                    }
                  }}
                  type="button"
                >
                  Start one
                </button>
              </div>
            )}
          </section>

          <SvgDecor variant="section" />

          {/* Clean Features Grid */}
          <section className="home-features-clean">
            <Reveal as="h3" className="home-section-title" variant="up">Built for the Culture</Reveal>
            <div className="home-features-clean__grid">
              {[
                { title: 'WhatsApp Invites', desc: 'Drop a clean invite link. Guests verify and RSVP in seconds.' },
                { title: 'The Expense Kitty', desc: 'Split party costs, generate UPI QR codes, and track settlements.' },
                { title: 'Live Camera Dump', desc: 'A shared roll of film-filtered photos that unlocks after 2 AM.' },
                { title: 'DJs & Playlists', desc: 'Showcase the decks with artist profiles, vibes, and Spotify playlists.' },
              ].map((f, i) => (
                <Reveal key={f.title} className="home-feature-clean" variant="up" delay={i * 90}>
                  <div className="feature-marker" />
                  <div>
                    <h4 className="home-feature__title">{f.title}</h4>
                    <p className="home-feature__desc">{f.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>

          <SvgDecor variant="section" />

          {/* Host CTA Section */}
          <Reveal as="section" className="home-demo" variant="up">
            <h3 className="home-section-title">Throw your own</h3>
            <div className="stack stack-sm">
              <button
                className="home-demo-link glass pressable"
                type="button"
                onClick={() => {
                  if (currentUser) {
                    navigate('/create');
                  } else {
                    setLoginRedirect(true);
                    setAuthError('');
                    setActiveTab('login');
                  }
                }}
              >
                ✨ Create a party
              </button>
              {currentUser && (
                <Link to="/profile" className="home-demo-link glass pressable">
                  👤 Your profile & achievements
                </Link>
              )}
            </div>
          </Reveal>
        </>
      )}

      {activeTab === 'login' && (
        <section className="home-auth animate-fade-in-up">
          <div className="auth-card glass-strong">
            <h3 className="auth-title">{isSignUp ? 'Join LowKey' : 'Welcome Back'}</h3>
            <p className="auth-subtitle">
              {isSignUp ? 'Create a profile to host and RSVP to parties' : 'Log in to manage your hosted and RSVP\'d events'}
            </p>

            {authError && <div className="auth-error" role="alert">{authError}</div>}
            {authNotice && <div className="auth-notice" role="status">{authNotice}</div>}

            <button
              type="button"
              className="auth-google-btn"
              onClick={handleGoogleSignIn}
              disabled={authSubmitting}
            >
              <svg className="auth-google-btn__icon" viewBox="0 0 18 18" aria-hidden="true">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
                <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" />
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z" />
              </svg>
              {isSignUp ? 'Sign up with Google' : 'Continue with Google'}
            </button>

            <div className="auth-divider"><span>or</span></div>

            {isSignUp ? (
              <form onSubmit={handleRegisterSubmit} className="auth-form">
                <div className="form-group">
                  <label htmlFor="signup-name">Full Name *</label>
                  <input
                    id="signup-name"
                    type="text"
                    required
                    placeholder="Arjun Mehta"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="signup-username">Username *</label>
                  <input
                    id="signup-username"
                    type="text"
                    required
                    placeholder="arjun"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value)}
                    autoComplete="username"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="signup-email">Email Address *</label>
                  <input
                    id="signup-email"
                    type="email"
                    required
                    placeholder="arjun@lowkey.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="signup-phone">Phone Number (optional)</label>
                  <input
                    id="signup-phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="10-digit mobile number"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(digitsOnly(e.target.value).slice(0, 10))}
                    autoComplete="tel"
                    maxLength={10}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="signup-dob">Date of Birth * (Age verification)</label>
                  <input
                    id="signup-dob"
                    type="date"
                    required
                    value={signupDob}
                    onChange={(e) => setSignupDob(e.target.value)}
                  />
                  <small className="form-help">Used to verify access for parties with alcohol (21+).</small>
                </div>
                <div className="form-group">
                  <label htmlFor="signup-password">Password *</label>
                  <input
                    id="signup-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>
                <TurnstileWidget
                  key={`signup-${captchaNonce}`}
                  siteKey={TURNSTILE_SITE_KEY}
                  onVerify={(t) => setCaptchaToken(t || '')}
                />
                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={authSubmitting || (captchaRequired && !captchaToken)}
                >
                  {authSubmitting ? 'Creating account…' : 'Sign Up'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLoginSubmit} className="auth-form">
                <div className="form-group">
                  <label htmlFor="login-username">Email *</label>
                  <input
                    id="login-username"
                    type="email"
                    required
                    placeholder="you@email.com"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    autoComplete="email"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="login-password">Password *</label>
                  <input
                    id="login-password"
                    type="password"
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <TurnstileWidget
                  key={`login-${captchaNonce}`}
                  siteKey={TURNSTILE_SITE_KEY}
                  onVerify={(t) => setCaptchaToken(t || '')}
                />
                <button
                  type="submit"
                  className="auth-submit-btn"
                  disabled={authSubmitting || (captchaRequired && !captchaToken)}
                >
                  {authSubmitting ? 'Logging in…' : 'Log In'}
                </button>
              </form>
            )}

            <div className="auth-toggle">
              <button 
                type="button" 
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthError('');
                }}
              >
                {isSignUp ? 'Already have an account? Log In' : 'New to LowKey? Sign Up'}
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'my-parties' && currentUser && (
        <section className="home-dashboard-tab animate-fade-in-up">
          <h3 className="home-section-title">Your Hosted Parties</h3>
          {hostedEvents.length > 0 ? (
            <div className="home-parties__list stack stack-md">
              {hostedEvents.map((event) => {
                const expired = isEventExpired(event.date);
                return (
                  <Link
                    key={event.id}
                    to={`/party/${event.id}`}
                    className={`home-party-card glass pressable ${expired ? 'home-party-card--expired' : ''}`}
                  >
                    <div className={`home-party-card__gradient ${event.theme ? `theme-${event.theme}` : 'theme-neon'}`} />
                    <div className="home-party-card__content">
                      <div className="home-party-card__title-row">
                        <h4 className="home-party-card__name">{event.name}</h4>
                        {expired && <span className="badge-expired">Expired</span>}
                      </div>
                      <p className="home-party-card__meta">
                        {formatDate(event.date)} · {formatTime(event.time_start)}
                      </p>
                      <p className="home-party-card__location">{event.location_name}</p>
                    </div>
                    <div className="home-party-card__arrow">→</div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="home-empty glass">
              <p>You haven't hosted any parties yet.</p>
              <button 
                className="home-empty-btn"
                onClick={() => navigate('/create')}
                type="button"
              >
                Host your first party
              </button>
            </div>
          )}
        </section>
      )}

      {activeTab === 'rsvps' && currentUser && (
        <section className="home-dashboard-tab animate-fade-in-up">
          <h3 className="home-section-title">Your RSVPs</h3>
          {rsvpedEvents.length > 0 ? (
            <div className="home-parties__list stack stack-md">
              {rsvpedEvents.map((event) => {
                const expired = isEventExpired(event.date);
                return (
                  <Link
                    key={event.id}
                    to={`/invite/${event.id}`}
                    className={`home-party-card glass pressable ${expired ? 'home-party-card--expired' : ''}`}
                  >
                    <div className={`home-party-card__gradient ${event.theme ? `theme-${event.theme}` : 'theme-neon'}`} />
                    <div className="home-party-card__content">
                      <div className="home-party-card__title-row">
                        <h4 className="home-party-card__name">{event.name}</h4>
                        {expired ? (
                          <span className="badge-expired">Over</span>
                        ) : (
                          <span className="badge-going">Going</span>
                        )}
                      </div>
                      <p className="home-party-card__meta">
                        {formatDate(event.date)} · {formatTime(event.time_start)}
                      </p>
                      <p className="home-party-card__location">{event.location_name}</p>
                    </div>
                    <div className="home-party-card__arrow">→</div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="home-empty glass">
              <p>You haven't RSVP'd to any parties yet.</p>
              <button 
                className="home-empty-btn"
                onClick={() => setActiveTab('discover')}
                type="button"
              >
                Browse active parties
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  </div>
  );
}

export default Home;
