import { useState } from 'react';
import { useParams } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import PollSelector from '../components/PollSelector';
import AvatarStack from '../components/AvatarStack';
import SpotifyEmbed from '../components/SpotifyEmbed';
import { getEvent, getRSVPs, addRSVP, getCurrentUser } from '../utils/storage';
import { generateId, formatDate, formatTime, getInitials, getAvatarGradient } from '../utils/helpers';
import { MOCK_EVENT, MOCK_RSVPS } from '../data/mockData';
import './GuestInvite.css';

/** Confetti color palette */
const CONFETTI_COLORS = [
  'var(--neon-purple)', 'var(--neon-pink)', 'var(--neon-lime)',
  'var(--neon-blue)', 'var(--neon-cyan)', 'var(--neon-lavender)',
];

const CONFETTI_DOTS = Array.from({ length: 30 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${(i * 11) % 30}%`,
  width: `${6 + ((i * 5) % 8)}px`,
  height: `${6 + ((i * 7) % 8)}px`,
  animationDelay: `${((i * 3) % 6) / 10}s`,
  animationDuration: `${1 + ((i * 4) % 8) / 10}s`,
}));

/**
 * GuestInvite — THE star page guests see via WhatsApp invite link.
 * Route: /invite/:eventId
 */
export default function GuestInvite() {
  const { eventId } = useParams();
  const [currentUser] = useState(() => getCurrentUser());

  // Event & RSVP data
  const [event] = useState(() => getEvent(eventId) || MOCK_EVENT);
  const [rsvps, setRsvps] = useState(() => {
    const storedRsvps = getRSVPs(eventId);
    return storedRsvps.length > 0 ? storedRsvps : MOCK_RSVPS;
  });

  // Form state
  const [guestName, setGuestName] = useState(() => currentUser ? currentUser.name : '');
  const [guestDob, setGuestDob] = useState('');
  const [ageError, setAgeError] = useState('');
  const [pollFood, setPollFood] = useState('');
  const [pollDrinks, setPollDrinks] = useState('');
  const [pollStaying, setPollStaying] = useState('');
  const [plusOne, setPlusOne] = useState(false);
  const [plusOneName, setPlusOneName] = useState('');

  // Submission state
  const [submitted, setSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  if (!event) return null;

  // Derived data
  const themeClass = `theme-${event.theme || 'neon'}`;
  const goingCount = rsvps.filter(r => r.status === 'going').length;
  const maybeCount = rsvps.filter(r => r.status === 'maybe').length;
  const guestNames = rsvps
    .filter(r => r.status === 'going')
    .map(r => r.guest_name);

  const getAge = (dobString) => {
    if (!dobString) return 0;
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  /** Handle RSVP submission */
  const handleRSVP = () => {
    const trimmed = guestName.trim();
    if (!trimmed) return;

    if (event.contains_alcohol) {
      const birthdate = currentUser ? currentUser.birthdate : guestDob;
      if (!birthdate) {
        setAgeError('Please verify your date of birth first.');
        return;
      }
      const age = getAge(birthdate);
      if (age < 21) {
        setAgeError('You must be 21 or older to RSVP to a party with alcohol.');
        return;
      }
    }

    const rsvpData = {
      id: generateId(),
      event_id: event.id,
      guest_name: trimmed,
      user_id: currentUser ? currentUser.id : null,
      guest_phone: null,
      status: 'going',
      poll_food: pollFood || null,
      poll_drinks: pollDrinks || null,
      poll_staying: pollStaying || null,
      plus_one_requested: plusOne,
      plus_one_name: plusOne ? plusOneName.trim() || null : null,
      plus_one_approved: null,
      guest_birthdate: currentUser ? currentUser.birthdate : guestDob,
    };

    addRSVP(rsvpData);
    setRsvps(prev => [...prev, rsvpData]);
    setSubmitted(true);
    setShowConfetti(true);

    // Haptic feedback (if supported)
    if (navigator.vibrate) {
      navigator.vibrate([30, 50, 80]);
    }

    // Show toast
    setTimeout(() => setShowToast(true), 400);

    // Hide confetti + toast after a few seconds
    setTimeout(() => setShowConfetti(false), 2000);
    setTimeout(() => setShowToast(false), 3500);
  };

  return (
    <div className="page">
      {/* ====== HERO SECTION ====== */}
      <section className={`invite-hero ${themeClass}`}>
        {/* Floating orbs */}
        <div className="invite-hero__orb invite-hero__orb--1" aria-hidden="true" />
        <div className="invite-hero__orb invite-hero__orb--2" aria-hidden="true" />
        <div className="invite-hero__orb invite-hero__orb--3" aria-hidden="true" />
        <div className="invite-hero__orb invite-hero__orb--4" aria-hidden="true" />

        <div className="invite-hero__content">
          <h1 className="invite-hero__title">{event.name}</h1>

          {event.tagline && (
            <p className="invite-hero__tagline">{event.tagline}</p>
          )}

          <div className="invite-hero__badges">
            <span className="invite-hero__badge">
              📅 {formatDate(event.date)}  •  {formatTime(event.time_start)}
            </span>
            <span className="invite-hero__badge">
              📍 {event.location_name}
            </span>
            {(event.cover_charge || event.capacity) && (
              <span className="invite-hero__badge">
                {event.cover_charge ? `₹${event.cover_charge} cover` : 'Free entry'}
                {event.capacity ? `  •  ${event.capacity} cap` : ''}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ====== BODY ====== */}
      <div className="invite-body">
        <div className="invite-body-col">
          {/* ---- Host Badge ---- */}
          <div className="invite-section">
            <GlassCard>
              <div className="invite-host">
                <div
                  className="invite-host__avatar"
                  style={{ background: getAvatarGradient(event.host_name) }}
                >
                  {getInitials(event.host_name)}
                </div>
                <div className="invite-host__text">
                  hosted by{' '}
                  <span className="invite-host__name">{event.host_name}</span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* ---- Personal DJ ---- */}
          {event.has_personal_dj && event.dj_name && (
            <div className="invite-section">
              <GlassCard>
                <div className="invite-dj">
                  <div className="invite-dj__mark">DJ</div>
                  <div className="invite-dj__main">
                    <h2 className="invite-dj__name">{event.dj_name}</h2>
                    {event.dj_genre && <p className="invite-dj__genre">{event.dj_genre}</p>}
                    <div className="invite-dj__links">
                      {event.dj_profile_url && (
                        <a href={event.dj_profile_url} target="_blank" rel="noreferrer">Profile</a>
                      )}
                      {event.dj_instagram && (
                        <a href={event.dj_instagram} target="_blank" rel="noreferrer">Instagram</a>
                      )}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {/* ---- Who's Going ---- */}
          <div className="invite-section">
            <h2 className="invite-section__title">Who's Going</h2>
            <div className="invite-going">
              <AvatarStack names={guestNames} maxDisplay={6} size="md" />
              <p className="invite-going__stats">
                <span>{goingCount} going</span>
                {maybeCount > 0 && <> · {maybeCount} maybe</>}
              </p>
            </div>
          </div>

          {/* ---- Spotify Section ---- */}
          {event.spotify_playlist_url && (
            <div className="invite-section">
              <div className="invite-spotify">
                <SpotifyEmbed url={event.spotify_playlist_url} compact />
                <p className="invite-spotify__cta">Add your tracks</p>
              </div>
            </div>
          )}
        </div>

        <div className="invite-body-col">
          {/* ---- Smart Polls ---- */}
          <div className="invite-section">
            <h2 className="invite-section__title">Vibe Check</h2>
            <GlassCard>
              <div className="invite-polls">
                <PollSelector
                  label="what's your vibe?"
                  options={[
                    { value: 'veg', label: 'Pure Veg', emoji: '🥗' },
                    { value: 'nonveg', label: 'Non-Veg', emoji: '🍗' },
                    { value: 'vegan', label: 'Vegan', emoji: '🌱' },
                  ]}
                  value={pollFood}
                  onChange={setPollFood}
                  accentColor="purple"
                />

                <PollSelector
                  label="drinking?"
                  options={[
                    { value: 'byob', label: 'BYOB', emoji: '🍺' },
                    { value: 'mocktails', label: 'Mocktails', emoji: '🍹' },
                  ]}
                  value={pollDrinks}
                  onChange={setPollDrinks}
                  accentColor="pink"
                />

                <PollSelector
                  label="staying the night?"
                  options={[
                    { value: 'staying', label: 'Staying', emoji: '🛏️' },
                    { value: 'cab', label: 'Booking a cab', emoji: '🚕' },
                  ]}
                  value={pollStaying}
                  onChange={setPollStaying}
                  accentColor="lime"
                />
              </div>
            </GlassCard>
          </div>

          {/* ---- Plus One ---- */}
          <div className="invite-section">
            <GlassCard className="invite-plusone">
              <div
                className="invite-plusone__toggle"
                onClick={() => setPlusOne(!plusOne)}
                role="switch"
                aria-checked={plusOne}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPlusOne(!plusOne); } }}
              >
                <span className="invite-plusone__toggle-label">
                  Bringing a plus one?
                </span>
                <span className={`invite-plusone__switch ${plusOne ? 'invite-plusone__switch--active' : ''}`} />
              </div>

              {plusOne && (
                <div className="invite-plusone__input-wrap">
                  <input
                    className="invite-plusone__input"
                    type="text"
                    placeholder="their name"
                    value={plusOneName}
                    onChange={(e) => setPlusOneName(e.target.value)}
                    autoComplete="off"
                  />
                  <p className="invite-plusone__hint">host will approve privately</p>
                </div>
              )}
            </GlassCard>
          </div>

          <hr className="invite-divider" />

          {/* ---- RSVP Section ---- */}
          <div className="invite-section">
            <div className="invite-rsvp">
              {event.contains_alcohol && currentUser && getAge(currentUser.birthdate) < 21 ? (
                <div className="invite-age-block glass-strong">
                  <span className="age-gate-title">21+ Age Check Failed</span>
                  <p className="age-gate-desc">
                    This party contains alcohol. According to your profile, you are under 21 and cannot attend.
                  </p>
                </div>
              ) : (
                <>
                  {!submitted && event.contains_alcohol && (
                    currentUser ? (
                      <div className="age-verified-badge">
                        Age Verified: 21+
                      </div>
                    ) : (
                      <div className="invite-age-verification">
                        <label htmlFor="guest-dob" className="age-verification-label">Date of Birth * (21+ required)</label>
                        <input
                          id="guest-dob"
                          className="invite-rsvp__dob-input"
                          type="date"
                          value={guestDob}
                          onChange={(e) => {
                            setGuestDob(e.target.value);
                            setAgeError('');
                          }}
                        />
                        {ageError && <p className="age-error-text">{ageError}</p>}
                      </div>
                    )
                  )}

                  {!submitted && (
                    <input
                      className="invite-rsvp__input"
                      type="text"
                      placeholder="your name"
                      value={guestName}
                      onChange={(e) => setGuestName(e.target.value)}
                      autoComplete="name"
                      readOnly={!!currentUser}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRSVP(); }}
                    />
                  )}

                  <button
                    className={`invite-rsvp__cta ${submitted ? 'invite-rsvp__cta--success' : ''}`}
                    onClick={handleRSVP}
                    disabled={submitted || !guestName.trim() || (event.contains_alcohol && !currentUser && !guestDob)}
                    type="button"
                  >
                    {submitted ? '✓ Joined' : 'Join Party'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ---- Footer ---- */}
      <footer className="invite-footer">
        made with love on <span className="brand-cursive text-gradient">lowkey</span>
      </footer>

      {/* ====== Confetti Overlay ====== */}
      {showConfetti && (
        <div className="invite-confetti" aria-hidden="true">
          {CONFETTI_DOTS.map((dot, i) => (
            <span
              key={i}
              className="invite-confetti__dot"
              style={{
                left: dot.left,
                top: dot.top,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                width: dot.width,
                height: dot.height,
                animationDelay: dot.animationDelay,
                animationDuration: dot.animationDuration,
              }}
            />
          ))}
        </div>
      )}

      {/* ====== Success Toast ====== */}
      {showToast && (
        <div className="invite-toast" role="status" aria-live="polite">
          You are locked in!
        </div>
      )}
    </div>
  );
}
