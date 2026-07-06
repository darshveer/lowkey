import { useState, useMemo, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  getEvents,
  loginUser,
  registerUser
} from '../utils/storage';
import { DISCOVERY_CITIES } from '../data/mockData';
import { formatDate, formatTime, formatINR } from '../utils/helpers';
import SvgDecor from '../components/SvgDecor';
import './Home.css';

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
  const [events] = useState(() => getEvents());
  const [selectedCity, setSelectedCity] = useState('All');
  
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
    return events
      .filter(event => event.discoverable !== false)
      .filter(event => selectedCity === 'All' || event.city === selectedCity)
      .sort((a, b) => new Date(`${a.date}T${a.time_start || '00:00'}`) - new Date(`${b.date}T${b.time_start || '00:00'}`));
  }, [events, selectedCity]);

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

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    setAuthError('');
    const res = loginUser(loginUsername, loginPassword);
    if (res.success) {
      setCurrentUser(res.user);
      if (loginRedirect) {
        setLoginRedirect(false);
        navigate('/create');
      } else {
        setActiveTab('discover');
      }
    } else {
      setAuthError(res.error);
    }
  };

  const handleRegisterSubmit = (e) => {
    e.preventDefault();
    setAuthError('');
    if (!signupUsername || !signupEmail || !signupName || !signupPassword || !signupDob) {
      setAuthError('Please fill in all required fields.');
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

    const res = registerUser(newUser);
    if (res.success) {
      setCurrentUser(res.user);
      if (loginRedirect) {
        setLoginRedirect(false);
        navigate('/create');
      } else {
        setActiveTab('discover');
      }
    } else {
      setAuthError(res.error);
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

          {/* Discover Listing */}
          <section id="discover" className="home-discover animate-fade-in-up" style={{ animationDelay: '180ms' }}>
            <div className="home-section-row">
              <h3 className="home-section-title">discover parties</h3>
              <span className="home-section-chip">India Beta</span>
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
                {discoverableEvents.map(event => (
                  <Link
                    key={event.id}
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
                  </Link>
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
          <section className="home-features-clean stagger" style={{ animationDelay: '260ms' }}>
            <h3 className="home-section-title">Built for the Culture</h3>
            <div className="home-features-clean__grid">
              <div className="home-feature-clean">
                <div className="feature-marker" />
                <div>
                  <h4 className="home-feature__title">WhatsApp Invites</h4>
                  <p className="home-feature__desc">Drop a clean invite link. Guests verify and RSVP in seconds.</p>
                </div>
              </div>
              <div className="home-feature-clean">
                <div className="feature-marker" />
                <div>
                  <h4 className="home-feature__title">The Expense Kitty</h4>
                  <p className="home-feature__desc">Split party costs, generate UPI QR codes, and track settlements.</p>
                </div>
              </div>
              <div className="home-feature-clean">
                <div className="feature-marker" />
                <div>
                  <h4 className="home-feature__title">Live Camera Dump</h4>
                  <p className="home-feature__desc">A shared roll of film-filtered photos that unlocks after 2 AM.</p>
                </div>
              </div>
              <div className="home-feature-clean">
                <div className="feature-marker" />
                <div>
                  <h4 className="home-feature__title">DJs & Playlists</h4>
                  <p className="home-feature__desc">Showcase the decks with artist profiles, vibes, and Spotify playlists.</p>
                </div>
              </div>
            </div>
          </section>

          <SvgDecor variant="section" />

          {/* Demo Section */}
          <section className="home-demo animate-fade-in-up" style={{ animationDelay: '350ms' }}>
            <h3 className="home-section-title">Quick Demo Links</h3>
            <div className="stack stack-sm">
              <Link to="/invite/party_xK9mQ2" className="home-demo-link glass pressable">
                Guest Invite Page
              </Link>
              <Link to="/party/party_aB3nY7" className="home-demo-link glass pressable">
                Host Dashboard (Live)
              </Link>
            </div>
          </section>
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
                    placeholder="+919876543210"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(e.target.value)}
                    autoComplete="tel"
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
                <button type="submit" className="auth-submit-btn">Sign Up</button>
              </form>
            ) : (
              <form onSubmit={handleLoginSubmit} className="auth-form">
                <div className="form-group">
                  <label htmlFor="login-username">Username or Email *</label>
                  <input
                    id="login-username"
                    type="text"
                    required
                    placeholder="arjun or arjun@lowkey.com"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    autoComplete="username"
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
                <button type="submit" className="auth-submit-btn">Log In</button>
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
