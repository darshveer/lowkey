import { useState } from 'react';
import { useParams } from 'react-router-dom';
import GlassCard from '../components/GlassCard';
import AvatarStack from '../components/AvatarStack';
import SpotifyEmbed from '../components/SpotifyEmbed';
import { getEvent, getRSVPs, addRSVP, getCurrentUser } from '../utils/storage';
import { generateId, formatDate, formatTime, getInitials, getAvatarGradient } from '../utils/helpers';
import { MOCK_EVENT, MOCK_RSVPS } from '../data/mockData';
import PaymentModal from '../components/PaymentModal';
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

  const [submitted, setSubmitted] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [pendingRsvp, setPendingRsvp] = useState(null);

  const existingRsvp = currentUser ? rsvps.find(r => r.user_id === currentUser.id) : null;
  const isEditingRsvp = !!existingRsvp;

  // Derived data
  const themeClass = `theme-${event.theme || 'neon'}`;
  const goingCount = rsvps
    .filter(r => r.status === 'going' && (!existingRsvp || r.id !== existingRsvp.id))
    .reduce((sum, r) => sum + (r.guest_count || 1), 0);
  const maybeCount = rsvps.filter(r => r.status === 'maybe').length;
  const guestNames = rsvps
    .filter(r => r.status === 'going')
    .map(r => r.guest_name);

  const availableCapacity = event.capacity ? Math.max(0, event.capacity - goingCount) : Infinity;

  // Form state overriding with existing RSVP data if present
  const [guestName, setGuestName] = useState(() => existingRsvp ? existingRsvp.guest_name : (currentUser ? currentUser.name : ''));
  const [guestDob, setGuestDob] = useState('');
  const [ageError, setAgeError] = useState('');
  
  const defaultFood = existingRsvp && typeof existingRsvp.poll_food === 'object' && existingRsvp.poll_food !== null 
    ? existingRsvp.poll_food 
    : { veg: existingRsvp ? (existingRsvp.guest_count || 1) : 1, nonveg: 0, vegan: 0 };
  const defaultDrinks = existingRsvp && typeof existingRsvp.poll_drinks === 'object' && existingRsvp.poll_drinks !== null 
    ? existingRsvp.poll_drinks 
    : { byob: existingRsvp ? (existingRsvp.guest_count || 1) : 1, mocktails: 0 };
    
  const [foodBreakdown, setFoodBreakdown] = useState(defaultFood);
  const [drinksBreakdown, setDrinksBreakdown] = useState(defaultDrinks);
  const [guestCount, setGuestCount] = useState(existingRsvp ? existingRsvp.guest_count || 1 : 1);

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

    const totalFood = Object.values(foodBreakdown).reduce((a, b) => a + b, 0);
    const totalDrinks = Object.values(drinksBreakdown).reduce((a, b) => a + b, 0);
    
    if (totalFood !== guestCount || totalDrinks !== guestCount) {
      setAgeError(`Food (${totalFood}) and Drink (${totalDrinks}) selections must equal the number of tickets (${guestCount}).`);
      return;
    }

    const rsvpData = {
      id: existingRsvp ? existingRsvp.id : generateId(),
      event_id: event.id,
      guest_name: trimmed,
      user_id: currentUser ? currentUser.id : null,
      guest_phone: null,
      status: 'going',
      poll_food: foodBreakdown,
      poll_drinks: drinksBreakdown,
      guest_birthdate: currentUser ? currentUser.birthdate : guestDob,
      guest_count: guestCount,
    };

    // If editing and guestCount hasn't increased, no need to pay again
    const oldGuestCount = existingRsvp ? (existingRsvp.guest_count || 1) : 0;
    const additionalGuests = Math.max(0, guestCount - oldGuestCount);
    
    if (event.cover_charge > 0 && additionalGuests > 0) {
      setPendingRsvp({ ...rsvpData, _additionalGuests: additionalGuests });
      setShowPaymentModal(true);
    } else {
      if (existingRsvp) {
        // Update existing RSVP
        const updatedRsvps = rsvps.map(r => r.id === rsvpData.id ? rsvpData : r);
        setRsvps(updatedRsvps);
        localStorage.setItem('lowkey_rsvps', JSON.stringify(updatedRsvps));
        setSubmitted(true);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 3500);
      } else {
        submitRSVP(rsvpData);
      }
    }
  };

  /** Callback when payment is successfully confirmed */
  const handlePaymentSuccess = ({ gateway, transactionId }) => {
    setShowPaymentModal(false);
    if (!pendingRsvp) return;

    const paymentData = {
      id: 'pay_' + generateId(),
      rsvp_id: pendingRsvp.id,
      event_id: event.id,
      amount: event.cover_charge * (pendingRsvp._additionalGuests || pendingRsvp.guest_count),
      paid_by: pendingRsvp.guest_name,
      transaction_id: transactionId,
      gateway: gateway,
      status: 'success'
    };

    // Save payment
    const storedPayments = JSON.parse(localStorage.getItem('lowkey_payments') || '[]');
    storedPayments.push(paymentData);
    localStorage.setItem('lowkey_payments', JSON.stringify(storedPayments));

    const finalRsvp = { ...pendingRsvp };
    delete finalRsvp._additionalGuests;

    if (existingRsvp) {
      const updatedRsvps = rsvps.map(r => r.id === finalRsvp.id ? finalRsvp : r);
      setRsvps(updatedRsvps);
      localStorage.setItem('lowkey_rsvps', JSON.stringify(updatedRsvps));
      setSubmitted(true);
      setShowConfetti(true);
      setTimeout(() => setShowToast(true), 400);
      setTimeout(() => setShowConfetti(false), 2000);
      setTimeout(() => setShowToast(false), 3500);
    } else {
      submitRSVP(finalRsvp);
    }
    setPendingRsvp(null);
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

                  <button
                    className={`invite-rsvp__cta ${submitted ? 'invite-rsvp__cta--success' : ''}`}
                    onClick={handleRSVP}
                    disabled={submitted || !guestName.trim() || (event.contains_alcohol && !currentUser && !guestDob) || Object.values(foodBreakdown).reduce((a, b) => a + b, 0) !== guestCount || Object.values(drinksBreakdown).reduce((a, b) => a + b, 0) !== guestCount}
                    type="button"
                  >
                    {submitted ? '✓ Saved' : (isEditingRsvp ? 'Update RSVP' : 'Join Party')}
                  </button>
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
        onPaymentSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
