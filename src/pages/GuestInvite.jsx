import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import AvatarStack from '../components/AvatarStack';
import ProfilePeek from '../components/ProfilePeek';
import SpotifyEmbed from '../components/SpotifyEmbed';
import MapPreview from '../components/MapPreview';
import VibeWall from '../components/VibeWall';
import Reveal from '../components/Reveal';
import CalendarButton from '../components/CalendarButton';
import WeatherWidget from '../components/WeatherWidget';
import SongRequestQueue from '../components/SongRequestQueue';
import AnnouncementsPanel from '../components/AnnouncementsPanel';
import QRTicket from '../components/QRTicket';
import { getEvent, getRSVPs, addRSVP, updateRSVP, addPayment, getCurrentUser, toggleFollow, isFollowing, getProfile, subscribeToEvent, checkPaymentDeadlines } from '../utils/storage';
import { generateId, formatDate, formatTime, getInitials, getAvatarGradient, safeUrl, computePaymentDeadline, isPartyManager, digitsOnly, isTenDigitPhone, isEventOver } from '../utils/helpers';
import PaymentModal from '../components/PaymentModal';
import { useToast } from '../hooks/useToast';
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
  const { show } = useToast();
  const [currentUser] = useState(() => getCurrentUser());

  // Event & RSVP data (real data only — null if the party doesn't exist)
  const [event] = useState(() => getEvent(eventId));
  const [rsvps, setRsvps] = useState(() => getRSVPs(eventId));
  const [peek, setPeek] = useState(null);

  // Lazy sweep: expire unpaid RSVPs past their deadline + promote the
  // waitlist, and remind guests whose deadline is approaching. There's no
  // background job in this app, so this runs whenever the invite page loads.
  useEffect(() => {
    if (!eventId) return;
    checkPaymentDeadlines(eventId);
  }, [eventId]);

  // Open the profile peek for anyone at the party (host, co-host, guest).
  const openPeek = (userId, fallbackName) => {
    if (!userId) return;
    const p = getProfile(userId);
    setPeek({ id: userId, ...(p || {}), name: p?.name || fallbackName });
  };

  const [submitted, setSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingRsvp, setPendingRsvp] = useState(null);
  // Whether the guest has actually submitted a UTR (vs. just having an unpaid RSVP).
  // Drives the entry-pass copy so a reloaded/abandoned checkout never reads as "paid".
  const [paymentSubmitted, setPaymentSubmitted] = useState(false);

  const existingRsvp = currentUser ? rsvps.find(r => r.user_id === currentUser.id) : null;
  const isEditingRsvp = !!existingRsvp;

  // Tint the ambient FX (cursor glow + background) to match this party's theme.
  // A 'custom' theme carries a host-picked gradient — apply it as inline FX vars.
  const customFrom = event?.theme === 'custom' ? event?.custom_gradient?.from : null;
  const customTo = event?.theme === 'custom' ? event?.custom_gradient?.to : null;
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-party-theme', event?.theme || 'neon');
    if (customFrom && customTo) {
      root.style.setProperty('--fx-accent-1', customFrom);
      root.style.setProperty('--fx-accent-2', customTo);
      root.style.setProperty('--fx-accent-3', customFrom);
      root.style.setProperty('--fx-accent-ring', customTo);
    }
    return () => {
      root.removeAttribute('data-party-theme');
      ['--fx-accent-1', '--fx-accent-2', '--fx-accent-3', '--fx-accent-ring'].forEach((v) => root.style.removeProperty(v));
    };
  }, [event?.theme, customFrom, customTo]);

  // Derived data (null-safe — event may not exist)
  const themeClass = `theme-${event?.theme || 'neon'}`;
  const goingCount = rsvps
    .filter(r => r.status === 'going' && (!existingRsvp || r.id !== existingRsvp.id))
    .reduce((sum, r) => sum + (r.guest_count || 1), 0);
  const maybeCount = rsvps.filter(r => r.status === 'maybe').length;
  const guestPeople = rsvps
    .filter(r => r.status === 'going')
    .map(r => ({ name: r.guest_name, userId: r.user_id || null }));

  // Co-hosts — { email, id, username, name } entries; legacy strings normalized.
  const inviteCoHosts = (event?.co_hosts || []).map((c) =>
    typeof c === 'string' ? { name: c, email: null, id: null, username: null } : c
  );

  const availableCapacity = event?.capacity ? Math.max(0, event.capacity - goingCount) : Infinity;

  // Form state overriding with existing RSVP data if present
  const [guestName, setGuestName] = useState(() => existingRsvp ? existingRsvp.guest_name : (currentUser ? currentUser.name : ''));
  const [guestDob, setGuestDob] = useState('');
  const [ageError, setAgeError] = useState('');
  const [plusOneName, setPlusOneName] = useState(() => existingRsvp?.plus_one_name || '');
  const [submittedRsvp, setSubmittedRsvp] = useState(null);
  // Phone prefills from the signed-in profile only — it is no longer read back
  // from the RSVP (which no longer stores it; see the rsvpData note below).
  const [guestPhone, setGuestPhone] = useState(() => currentUser?.phone || '');
  const [following, setFollowing] = useState(() =>
    currentUser && event?.host_id ? isFollowing(currentUser.id, event.host_id) : false
  );
  const canFollow = currentUser && event?.host_id && currentUser.id !== event.host_id;

  // The party is over once its end time has passed — RSVPs close.
  const partyOver = isEventOver(event);

  // Song requests + vibe wall are for people who've actually joined the party
  // (RSVP'd this session or previously) — hosts/co-hosts always have access.
  const hasJoined = !!(existingRsvp || submittedRsvp);
  const canUseSocial = hasJoined || (!!currentUser && !!event && isPartyManager(event, currentUser.id));

  // Live sync so an approval, decline, or deadline-expiry from another
  // session (the host's dashboard, or the sweep above running elsewhere)
  // reflects immediately — this is what unlocks the entry QR without a reload.
  useEffect(() => {
    if (!eventId) return;
    return subscribeToEvent(eventId, {
      onRsvp: (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id;
          if (!deletedId) return;
          setRsvps(prev => prev.filter(r => r.id !== deletedId));
          setSubmittedRsvp(prev => (prev && prev.id === deletedId ? null : prev));
          return;
        }
        const row = payload.new;
        if (!row) return;
        setRsvps(prev => {
          const idx = prev.findIndex(r => r.id === row.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...row };
            return copy;
          }
          return [...prev, row];
        });
        setSubmittedRsvp(prev => (prev && prev.id === row.id ? { ...prev, ...row } : prev));
      },
    });
  }, [eventId]);

  const defaultFood = existingRsvp && typeof existingRsvp.poll_food === 'object' && existingRsvp.poll_food !== null
    ? existingRsvp.poll_food 
    : { veg: existingRsvp ? (existingRsvp.guest_count || 1) : 1, nonveg: 0, vegan: 0 };
  const defaultDrinks = existingRsvp && typeof existingRsvp.poll_drinks === 'object' && existingRsvp.poll_drinks !== null 
    ? existingRsvp.poll_drinks 
    : { byob: existingRsvp ? (existingRsvp.guest_count || 1) : 1, mocktails: 0 };
    
  const [foodBreakdown, setFoodBreakdown] = useState(defaultFood);
  const [drinksBreakdown, setDrinksBreakdown] = useState(defaultDrinks);
  const [guestCount, setGuestCount] = useState(existingRsvp ? existingRsvp.guest_count || 1 : 1);

  // Capacity: is there room for this booking, or does it go to the waitlist?
  const isWaitlisted = availableCapacity !== Infinity && availableCapacity < guestCount;

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

  /** Finalize RSVP submission after checks/payments */
  const submitRSVP = (rsvpData) => {
    addRSVP(rsvpData);
    setRsvps(prev => [...prev, rsvpData]);
    setSubmittedRsvp(rsvpData);
    setSubmitted(true);
    if (rsvpData.status !== 'waitlist') setShowConfetti(true);

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

  /** Handle RSVP submission */
  const handleRSVP = () => {
    if (partyOver) {
      setAgeError('This party has ended — RSVPs are closed.');
      return;
    }
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

    const totalFood = Object.values(foodBreakdown).reduce((a, b) => a + b, 0);
    const totalDrinks = Object.values(drinksBreakdown).reduce((a, b) => a + b, 0);
    
    if (totalFood !== guestCount || totalDrinks !== guestCount) {
      setAgeError(`Food (${totalFood}) and Drink (${totalDrinks}) selections must equal the number of tickets (${guestCount}).`);
      return;
    }

    // If editing and guestCount hasn't increased, no need to pay again
    const oldGuestCount = existingRsvp ? (existingRsvp.guest_count || 1) : 0;
    const additionalGuests = Math.max(0, guestCount - oldGuestCount);
    const goingToWaitlist = isWaitlisted && !existingRsvp;
    // Waitlisted guests don't owe a cover until they're promoted.
    const needsPayment = event.cover_charge > 0 && additionalGuests > 0 && !goingToWaitlist;

    // NOTE: guest_phone and guest_birthdate are deliberately NOT persisted on
    // the RSVP — the rsvps table is world-readable (rsvps_public_read), so
    // storing PII there leaks every guest's phone/DOB to anyone with the public
    // key. The age gate is checked here at submit time (client-side), and the
    // host-visible copy of the phone lives on payments.phone (host-only read).
    const rsvpData = {
      id: existingRsvp ? existingRsvp.id : generateId(),
      event_id: event.id,
      guest_name: trimmed,
      user_id: currentUser ? currentUser.id : null,
      status: goingToWaitlist ? 'waitlist' : 'going',
      poll_food: foodBreakdown,
      poll_drinks: drinksBreakdown,
      guest_count: guestCount,
      plus_one_requested: !!plusOneName.trim(),
      plus_one_name: plusOneName.trim() || null,
      plus_one_approved: plusOneName.trim() ? null : undefined, // null = pending host approval
    };

    // A cover charge now owed opens a fresh payment window — the RSVP itself
    // still exists immediately either way, so a guest who never opens the
    // payment modal (or closes it) keeps their spot only until this deadline.
    if (needsPayment) {
      rsvpData.payment_deadline_at = computePaymentDeadline(event.payment_deadline_hours || 12);
      rsvpData.payment_reminder_sent = false;
      rsvpData.cover_paid = false;
    }

    // The RSVP is recorded immediately (holds the spot; the payment deadline runs
    // from here) whether or not the guest completes payment. The entry pass stays
    // in a clear "payment required" state until a UTR is actually submitted (see
    // `paymentSubmitted` → QRTicket), so an unpaid RSVP never *reads* as paid.
    if (existingRsvp) {
      // Merge onto the existing row (not a full replace) so fields this form
      // doesn't know about — checked_in, settled, cover_paid, plus_one_approved
      // — survive an edit instead of being silently wiped.
      const merged = { ...existingRsvp, ...rsvpData };
      setRsvps(prev => prev.map(r => (r.id === merged.id ? merged : r)));
      updateRSVP(merged.id, rsvpData);
      setSubmittedRsvp(merged);
      setSubmitted(true);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3500);
    } else {
      submitRSVP(rsvpData);
    }

    if (needsPayment) {
      setPaymentSubmitted(false);
      setPendingRsvp({ ...rsvpData, _additionalGuests: additionalGuests });
      setShowPaymentModal(true);
    }
  };

  /** Callback once a guest submits their UTR — hands off to the host for approval. */
  const handlePaymentSubmitted = ({ transactionId, phone }) => {
    setShowPaymentModal(false);
    if (!pendingRsvp) return;

    // The phone is recorded on the (host-only) payment row, not the
    // world-readable RSVP — so it's available to the host for verification
    // without leaking to every reader of the invite's guest list.

    addPayment({
      id: 'pay_' + generateId(),
      rsvp_id: pendingRsvp.id,
      event_id: event.id,
      amount: event.cover_charge * (pendingRsvp._additionalGuests || pendingRsvp.guest_count || 1),
      paid_by: pendingRsvp.guest_name,
      phone: phone || null,
      transaction_id: transactionId,
      gateway: 'upi',
    });

    setPaymentSubmitted(true);
    show('Submitted — the host will review your payment shortly.', 'success');
    setPendingRsvp(null);
  };

  // Party doesn't exist (bad link or removed) — show a friendly not-found state.
  if (!event) {
    return (
      <div className="page">
        <div className="invite-notfound glass-strong">
          <div className="invite-notfound__emoji" aria-hidden="true">🕳️</div>
          <h1 className="invite-notfound__title">This party isn't here</h1>
          <p className="invite-notfound__text">
            The link may be broken, or the host wrapped things up. Check the invite link and try again.
          </p>
          <Link to="/" className="invite-notfound__btn">Discover other parties →</Link>
        </div>
      </div>
    );
  }

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

          {event.vibe_tags && event.vibe_tags.length > 0 ? (
            <div className="invite-hero__tags">
              {event.vibe_tags.map(tag => (
                <span key={tag} className="invite-hero__tag-chip">#{tag.toLowerCase()}</span>
              ))}
            </div>
          ) : event.tagline && (
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
                <button
                  type="button"
                  className="invite-host__avatar"
                  style={{ background: getAvatarGradient(event.host_name) }}
                  onClick={() => openPeek(event.host_id, event.host_name)}
                  aria-label={`View ${event.host_name}'s profile`}
                >
                  {getInitials(event.host_name)}
                </button>
                <div className="invite-host__text">
                  hosted by{' '}
                  <button
                    type="button"
                    className="invite-host__name invite-host__name--link"
                    onClick={() => openPeek(event.host_id, event.host_name)}
                  >
                    {event.host_name}
                  </button>
                  {inviteCoHosts.length > 0 && (
                    <span className="invite-host__cohosts">
                      {' '}with{' '}
                      {inviteCoHosts.map((c, i) => (
                        <span key={c.email || c.name || i}>
                          {i > 0 && ' · '}
                          {c.id ? (
                            <button
                              type="button"
                              className="invite-host__name invite-host__name--link"
                              onClick={() => openPeek(c.id, c.name || c.username)}
                            >
                              {c.username ? `@${c.username}` : c.name}
                            </button>
                          ) : (
                            // No account: show a friendly handle, never the full email
                            <span className="invite-host__name">
                              {c.name || (c.email ? c.email.split('@')[0] : 'co-host')}
                            </span>
                          )}
                        </span>
                      ))}
                    </span>
                  )}
                </div>
                {canFollow && (
                  <button
                    type="button"
                    className={`invite-follow-btn ${following ? 'is-following' : ''}`}
                    onClick={() => setFollowing(toggleFollow(currentUser.id, event.host_id))}
                  >
                    {following ? '✓ Following' : '+ Follow'}
                  </button>
                )}
              </div>
            </GlassCard>
          </div>

          {/* ---- Host announcements (hidden when none) ---- */}
          <AnnouncementsPanel eventId={event.id} />

          {/* ---- Add to calendar + weather ---- */}
          <div className="invite-section">
            <CalendarButton event={event} />
            <div style={{ marginTop: 'var(--space-md)' }}>
              <WeatherWidget lat={event.location_lat} lng={event.location_lng} date={event.date} />
            </div>
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
                      {safeUrl(event.dj_profile_url) && (
                        <a href={safeUrl(event.dj_profile_url)} target="_blank" rel="noreferrer">Profile</a>
                      )}
                      {safeUrl(event.dj_instagram) && (
                        <a href={safeUrl(event.dj_instagram)} target="_blank" rel="noreferrer">Instagram</a>
                      )}
                    </div>
                  </div>
                </div>
              </GlassCard>
            </div>
          )}

          {/* ---- Who's Going ---- */}
          <Reveal className="invite-section" variant="up">
            <h2 className="invite-section__title">Who's Going</h2>
            <div className="invite-going">
              <AvatarStack
                people={guestPeople}
                maxDisplay={6}
                size="md"
                onSelect={(p) => openPeek(p.userId, p.name)}
              />
              <p className="invite-going__stats">
                <span>{goingCount} going</span>
                {maybeCount > 0 && <> · {maybeCount} maybe</>}
              </p>
            </div>
          </Reveal>

          {/* ---- Getting There (OpenStreetMap) ---- */}
          <Reveal className="invite-section" variant="left">
            <h2 className="invite-section__title">Getting There</h2>
            <MapPreview
              lat={event.location_lat}
              lng={event.location_lng}
              name={event.location_name}
              address={event.location_address}
            />
          </Reveal>

          {/* ---- Spotify Section ---- */}
          {event.spotify_playlist_url && (
            <div className="invite-section">
              <div className="invite-spotify">
                <SpotifyEmbed playlistUrl={event.spotify_playlist_url} compact />
                {safeUrl(event.spotify_playlist_url) && (
                  <a
                    className="invite-spotify__cta"
                    href={safeUrl(event.spotify_playlist_url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🎵 Add your tracks to the collab playlist →
                  </a>
                )}
              </div>
            </div>
          )}

          {/* ---- Song Requests (unlocked once you've joined) ---- */}
          <Reveal className="invite-section" variant="left">
            <h2 className="invite-section__title">Song Requests</h2>
            <GlassCard>
              {canUseSocial ? (
                <SongRequestQueue
                  eventId={event.id}
                  requesterName={currentUser ? currentUser.name : (guestName || 'Guest')}
                />
              ) : (
                <div className="invite-social-locked">
                  <span className="invite-social-locked__icon" aria-hidden="true">🔒</span>
                  <p className="invite-social-locked__text">RSVP to the party to request songs.</p>
                </div>
              )}
            </GlassCard>
          </Reveal>

          {/* ---- Vibe Wall (optional; unlocked once you've joined) ---- */}
          {event.vibe_wall_enabled !== false && (
            <Reveal className="invite-section" variant="left">
              <h2 className="invite-section__title">Vibe Wall</h2>
              <GlassCard>
                {canUseSocial ? (
                <VibeWall
                  eventId={event.id}
                  authorName={currentUser ? currentUser.name : guestName}
                  authorId={currentUser ? currentUser.id : null}
                  hostId={event.host_id}
                  closesAt={event.vibe_wall_closes_at}
                  cooldownSeconds={event.vibe_wall_cooldown_seconds || 0}
                />
                ) : (
                  <div className="invite-social-locked">
                    <span className="invite-social-locked__icon" aria-hidden="true">🔒</span>
                    <p className="invite-social-locked__text">RSVP to the party to post on the vibe wall.</p>
                  </div>
                )}
              </GlassCard>
            </Reveal>
          )}
        </div>

        <div className="invite-body-col">
          {/* ---- Detailed Ticket Customization ---- */}
          <div className="invite-section">
            <h2 className="invite-section__title">Vibe Check {guestCount > 1 && `(${guestCount} Tickets)`}</h2>
            <GlassCard>
              <div className="invite-polls">
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  Customize food and drink preferences for your tickets.
                </p>
                
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)' }}>Food Preference</h4>
                  {[{ key: 'veg', label: 'Pure Veg', emoji: '🥗' }, { key: 'nonveg', label: 'Non-Veg', emoji: '🍗' }, { key: 'vegan', label: 'Vegan', emoji: '🌱' }].map(opt => (
                    <div key={opt.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '14px' }}>{opt.emoji} {opt.label}</span>
                      <input 
                        type="number" 
                        min="0" 
                        max={guestCount} 
                        value={foodBreakdown[opt.key]} 
                        onChange={(e) => setFoodBreakdown(prev => ({ ...prev, [opt.key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                        style={{ width: '60px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '4px', padding: '4px 8px', textAlign: 'center' }}
                      />
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', fontSize: '12px', color: Object.values(foodBreakdown).reduce((a, b) => a + b, 0) === guestCount ? 'var(--neon-green)' : 'var(--neon-pink)' }}>
                    Total: {Object.values(foodBreakdown).reduce((a, b) => a + b, 0)} / {guestCount}
                  </div>
                </div>

                <div>
                  <h4 style={{ fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)' }}>Drink Preference</h4>
                  {[{ key: 'byob', label: 'BYOB', emoji: '🍺' }, { key: 'mocktails', label: 'Mocktails', emoji: '🍹' }].map(opt => (
                    <div key={opt.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '8px 12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '14px' }}>{opt.emoji} {opt.label}</span>
                      <input 
                        type="number" 
                        min="0" 
                        max={guestCount} 
                        value={drinksBreakdown[opt.key]} 
                        onChange={(e) => setDrinksBreakdown(prev => ({ ...prev, [opt.key]: Math.max(0, parseInt(e.target.value) || 0) }))}
                        style={{ width: '60px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', color: '#fff', borderRadius: '4px', padding: '4px 8px', textAlign: 'center' }}
                      />
                    </div>
                  ))}
                  <div style={{ textAlign: 'right', fontSize: '12px', color: Object.values(drinksBreakdown).reduce((a, b) => a + b, 0) === guestCount ? 'var(--neon-green)' : 'var(--neon-pink)' }}>
                    Total: {Object.values(drinksBreakdown).reduce((a, b) => a + b, 0)} / {guestCount}
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>


          <hr className="invite-divider" />

          {/* ---- RSVP Section ---- */}
          <div className="invite-section">
            <div className="invite-rsvp">
              {partyOver && (
                <div className="invite-ended-banner">
                  🎈 This party has ended — RSVPs are closed. Hope it was a good one.
                </div>
              )}
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

                  {!submitted && event.cover_charge > 0 && (
                    <input
                      className="invite-rsvp__input"
                      type="tel"
                      inputMode="numeric"
                      placeholder="10-digit mobile (for payment verification)"
                      value={guestPhone}
                      onChange={(e) => setGuestPhone(digitsOnly(e.target.value).slice(0, 10))}
                      autoComplete="tel"
                      aria-label="Phone number"
                      maxLength={10}
                    />
                  )}

                  {!submitted && availableCapacity > 1 && (
                    <div className="invite-ticket-counter" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', background: 'rgba(255,255,255,0.05)', padding: '12px 16px', borderRadius: '12px', marginBottom: '16px', border: '1px solid var(--glass-border)' }}>
                      <span style={{ fontSize: '14px', color: 'var(--text-secondary)', marginRight: 'auto' }}>Number of tickets</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <button type="button" onClick={() => setGuestCount(Math.max(1, guestCount - 1))} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>-</button>
                        <span style={{ width: '20px', textAlign: 'center', fontWeight: 'bold' }}>{guestCount}</span>
                        <button type="button" onClick={() => setGuestCount(Math.min(availableCapacity, guestCount + 1))} style={{ width: '32px', height: '32px', borderRadius: '8px', border: 'none', background: 'rgba(255,255,255,0.1)', color: '#fff', fontSize: '18px', cursor: 'pointer' }}>+</button>
                      </div>
                    </div>
                  )}

                  {!submitted && (
                    <input
                      className="invite-rsvp__input"
                      type="text"
                      placeholder="bringing a +1? (their name, optional)"
                      value={plusOneName}
                      onChange={(e) => setPlusOneName(e.target.value)}
                      maxLength={60}
                      aria-label="Plus one name (optional)"
                    />
                  )}

                  {!submitted && isWaitlisted && (
                    <p className="invite-waitlist-note">
                      This party is at capacity — you'll join the waitlist and get notified if a spot opens.
                    </p>
                  )}

                  <button
                    className={`invite-rsvp__cta ${submitted ? 'invite-rsvp__cta--success' : ''}`}
                    onClick={handleRSVP}
                    disabled={partyOver || submitted || !guestName.trim() || (event.contains_alcohol && !currentUser && !guestDob) || (event.cover_charge > 0 && !isWaitlisted && !isTenDigitPhone(guestPhone)) || Object.values(foodBreakdown).reduce((a, b) => a + b, 0) !== guestCount || Object.values(drinksBreakdown).reduce((a, b) => a + b, 0) !== guestCount}
                    type="button"
                  >
                    {partyOver ? 'Party ended' : (submitted ? '✓ Saved' : (isEditingRsvp ? 'Update RSVP' : (isWaitlisted ? 'Join Waitlist' : 'Join Party')))}
                  </button>

                  {submitted && submittedRsvp && (
                    submittedRsvp.status === 'waitlist' ? (
                      <div className="invite-waitlist-badge">⏳ You're on the waitlist — we'll ping you if a spot frees up.</div>
                    ) : (
                      <div className="invite-ticket-wrap">
                        <QRTicket event={event} rsvp={submittedRsvp} paymentSubmitted={paymentSubmitted} />
                        {event.cover_charge > 0 && !submittedRsvp.cover_paid && (
                          <button
                            type="button"
                            className="invite-payment-nudge-btn"
                            onClick={() => {
                              setPendingRsvp({ ...submittedRsvp, _additionalGuests: submittedRsvp.guest_count });
                              setShowPaymentModal(true);
                            }}
                          >
                            {submittedRsvp.payment_deadline_at ? 'Submit / resubmit payment' : 'Submit payment'}
                          </button>
                        )}
                      </div>
                    )
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>


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

      {/* ====== Party-member profile peek ====== */}
      <ProfilePeek open={!!peek} person={peek} onClose={() => setPeek(null)} />

      {/* ====== Payment Checkout Modal ====== */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPendingRsvp(null);
        }}
        amount={event.cover_charge * (pendingRsvp?._additionalGuests || pendingRsvp?.guest_count || 1)}
        upiId={event.upi_id || 'lowkey@okaxis'}
        payeeName={event.host_name || 'LowKey Host'}
        note={`Entry Cover: ${event.name}`}
        defaultPhone={guestPhone || currentUser?.phone || ''}
        onPaymentSubmitted={handlePaymentSubmitted}
      />
    </div>
  );
}
