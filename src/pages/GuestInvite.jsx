import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import GlowButton from '../components/GlowButton';
import PollSelector from '../components/PollSelector';
import AvatarStack from '../components/AvatarStack';
import SpotifyEmbed from '../components/SpotifyEmbed';
import { getEvent, getRSVPs, addRSVP } from '../utils/storage';
import { generateId, formatDate, formatTime, getInitials, getAvatarGradient } from '../utils/helpers';
import { MOCK_EVENT, MOCK_RSVPS } from '../data/mockData';
import './GuestInvite.css';

/** Confetti color palette */
const CONFETTI_COLORS = [
  'var(--neon-purple)', 'var(--neon-pink)', 'var(--neon-lime)',
  'var(--neon-blue)', 'var(--neon-cyan)', 'var(--neon-lavender)',
];

/**
 * GuestInvite — THE star page guests see via WhatsApp invite link.
 * Route: /invite/:eventId
 */
export default function GuestInvite() {
  const { eventId } = useParams();

  // Event & RSVP data
  const [event, setEvent] = useState(null);
  const [rsvps, setRsvps] = useState([]);

  // Form state
  const [guestName, setGuestName] = useState('');
  const [pollFood, setPollFood] = useState('');
  const [pollDrinks, setPollDrinks] = useState('');
  const [pollStaying, setPollStaying] = useState('');
  const [plusOne, setPlusOne] = useState(false);
  const [plusOneName, setPlusOneName] = useState('');

  // Submission state
  const [submitted, setSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // Load event + RSVPs
  useEffect(() => {
    const storedEvent = getEvent(eventId);
    setEvent(storedEvent || MOCK_EVENT);

    const storedRsvps = getRSVPs(eventId);
    setRsvps(storedRsvps.length > 0 ? storedRsvps : MOCK_RSVPS);
  }, [eventId]);

  if (!event) return null;

  // Derived data
  const themeClass = `theme-${event.theme || 'neon'}`;
  const goingCount = rsvps.filter(r => r.status === 'going').length;
  const maybeCount = rsvps.filter(r => r.status === 'maybe').length;
  const guestNames = rsvps
    .filter(r => r.status === 'going')
    .map(r => r.guest_name);

  /** Handle RSVP submission */
  const handleRSVP = () => {
    const trimmed = guestName.trim();
    if (!trimmed) return;

    const rsvpData = {
      id: generateId(),
      event_id: event.id,
      guest_name: trimmed,
      guest_phone: null,
      status: 'going',
      poll_food: pollFood || null,
      poll_drinks: pollDrinks || null,
      poll_staying: pollStaying || null,
      plus_one_requested: plusOne,
      plus_one_name: plusOne ? plusOneName.trim() || null : null,
      plus_one_approved: null,
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
          </div>
        </div>
      </section>

      {/* ====== BODY ====== */}
      <div className="invite-body">

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

        {/* ---- Who's Going ---- */}
        <div className="invite-section">
          <h2 className="invite-section__title">who's in 🔥</h2>
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
              <p className="invite-spotify__cta">add your tracks 🎵</p>
            </div>
          </div>
        )}

        {/* ---- Smart Polls ---- */}
        <div className="invite-section">
          <h2 className="invite-section__title">quick vibes check ✌️</h2>
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
                bringing someone? 👀
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
            {!submitted && (
              <input
                className="invite-rsvp__input"
                type="text"
                placeholder="your name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                autoComplete="name"
                onKeyDown={(e) => { if (e.key === 'Enter') handleRSVP(); }}
              />
            )}

            <button
              className={`invite-rsvp__cta ${submitted ? 'invite-rsvp__cta--success' : ''}`}
              onClick={handleRSVP}
              disabled={submitted || !guestName.trim()}
              type="button"
            >
              {submitted ? '✓ YOU\'RE IN' : 'I\'M IN 🔥'}
            </button>
          </div>
        </div>

        {/* ---- Footer ---- */}
        <footer className="invite-footer">
          made with 💜 on LowKey
        </footer>
      </div>

      {/* ====== Confetti Overlay ====== */}
      {showConfetti && (
        <div className="invite-confetti" aria-hidden="true">
          {Array.from({ length: 30 }).map((_, i) => (
            <span
              key={i}
              className="invite-confetti__dot"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 30}%`,
                background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                width: `${6 + Math.random() * 8}px`,
                height: `${6 + Math.random() * 8}px`,
                animationDelay: `${Math.random() * 0.6}s`,
                animationDuration: `${1 + Math.random() * 0.8}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* ====== Success Toast ====== */}
      {showToast && (
        <div className="invite-toast" role="status" aria-live="polite">
          🎉 you're locked in!
        </div>
      )}
    </div>
  );
}
