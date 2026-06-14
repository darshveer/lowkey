import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getEvent, getRSVPs, getExpenses, addExpense, getPhotos, addPhoto } from '../utils/storage';
import { generateId, formatDate, formatTime, formatINR, getDirectionsUrl, getInitials, getAvatarGradient } from '../utils/helpers';
import { calculateSplit } from '../utils/upi';
import { MOCK_EVENT_ACTIVE, MOCK_RSVPS, MOCK_EXPENSES } from '../data/mockData';
import GlassCard from '../components/GlassCard';
import GlowButton from '../components/GlowButton';
import CountdownTimer from '../components/CountdownTimer';
import UPIQRCode from '../components/UPIQRCode';
import PhotoGrid from '../components/PhotoGrid';
import AvatarStack from '../components/AvatarStack';
import PlusOneSwiper from '../components/PlusOneSwiper';
import './PartyDashboard.css';

/* ---- Inline fallback wrappers ---- */

/** @param {{ children: React.ReactNode, className?: string }} props */
function Card({ children, className = '' }) {
  if (GlassCard) return <GlassCard className={className}>{children}</GlassCard>;
  return <div className={`glass ${className}`}>{children}</div>;
}

/** @param {{ children: React.ReactNode, variant?: string, onClick?: Function, className?: string, type?: string }} props */
function Btn({ children, variant = 'primary', onClick, className = '', type = 'button' }) {
  if (GlowButton) return <GlowButton variant={variant} onClick={onClick} className={className} type={type}>{children}</GlowButton>;
  const bg = {
    primary: 'var(--gradient-primary)',
    blue: 'var(--gradient-primary)',
    pink: 'var(--gradient-hot)',
    lime: 'var(--gradient-lime)',
  }[variant] || 'var(--gradient-primary)';
  const color = variant === 'lime' ? '#000' : '#fff';
  return (
    <button
      type={type}
      onClick={onClick}
      className={`pressable ${className}`}
      style={{
        width: '100%',
        padding: '14px 24px',
        borderRadius: 'var(--radius-md)',
        background: bg,
        color,
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 'var(--text-base)',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/* ---- Helper: poll response emoji map ---- */
const FOOD_EMOJI = { nonveg: '🍗', veg: '🥗', vegan: '🌱' };
const DRINK_EMOJI = { byob: '🍺', mocktails: '🍹' };
const STAY_EMOJI = { staying: '🛏️', cab: '🚕' };

/* ---- Tabs config ---- */
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'kitty', label: 'Kitty 💰' },
  { key: 'camera', label: 'Camera 📸' },
  { key: 'plusone', label: '+1' },
];

/**
 * PartyDashboard — Active Party Mode
 * Activated 2 hours before the party starts.
 * Route: /party/:eventId
 */
export default function PartyDashboard() {
  const { eventId } = useParams();
  const [activeTab, setActiveTab] = useState('overview');
  const [event, setEvent] = useState(null);
  const [rsvps, setRsvps] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [photos, setPhotos] = useState([]);

  /* Expense form */
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);

  /* Toast */
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  /* Photo upload ref */
  const fileInputRef = useRef(null);

  // ---- Load data ----
  useEffect(() => {
    const storedEvent = getEvent(eventId);
    const storedRSVPs = getRSVPs(eventId);
    const storedExpenses = getExpenses(eventId);
    const storedPhotos = getPhotos(eventId);

    setEvent(storedEvent || MOCK_EVENT_ACTIVE);
    setRsvps(storedRSVPs.length ? storedRSVPs : MOCK_RSVPS);
    setExpenses(storedExpenses.length ? storedExpenses : MOCK_EXPENSES);
    setPhotos(storedPhotos.length ? storedPhotos : []);
  }, [eventId]);

  // ---- Toast helper ----
  function showToast(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }

  // ---- Poll tallies ----
  const goingRsvps = rsvps.filter(r => r.status === 'going');
  const maybeRsvps = rsvps.filter(r => r.status === 'maybe');

  const tallies = {
    going: goingRsvps.length,
    maybe: maybeRsvps.length,
    nonveg: goingRsvps.filter(r => r.poll_food === 'nonveg').length,
    veg: goingRsvps.filter(r => r.poll_food === 'veg').length,
    vegan: goingRsvps.filter(r => r.poll_food === 'vegan').length,
    byob: goingRsvps.filter(r => r.poll_drinks === 'byob').length,
    mocktails: goingRsvps.filter(r => r.poll_drinks === 'mocktails').length,
    staying: goingRsvps.filter(r => r.poll_staying === 'staying').length,
    cab: goingRsvps.filter(r => r.poll_staying === 'cab').length,
  };

  // ---- Expense handlers ----
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const splitAmount = calculateSplit(totalExpenses, tallies.going || 1);

  function handleAddExpense(e) {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount) return;

    const newExpense = {
      id: `exp_${generateId()}`,
      event_id: event?.id || eventId,
      description: expenseDesc.trim(),
      amount: Number(expenseAmount),
      paid_by: event?.host_name || 'You',
      split_type: 'equal',
      upi_id: event?.upi_id || '',
    };

    addExpense(newExpense);
    setExpenses(prev => [...prev, newExpense]);
    setExpenseDesc('');
    setExpenseAmount('');
    setShowAddExpense(false);
    showToast('✅ Expense added!');
  }

  // ---- Photo handlers ----
  function handlePhotoUpload(e) {
    const files = e.target.files;
    if (!files?.length) return;

    Array.from(files).forEach(file => {
      const blobUrl = URL.createObjectURL(file);
      const newPhoto = {
        id: `photo_${generateId()}`,
        event_id: event?.id || eventId,
        uploaded_by: event?.host_name || 'You',
        photo_url: blobUrl,
        caption: file.name.split('.')[0],
        filter: 'raw',
        created_at: new Date().toISOString(),
      };
      addPhoto(newPhoto);
      setPhotos(prev => [...prev, newPhoto]);
    });

    showToast('📸 Photo uploaded!');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ---- +1 Request handlers ----
  const pendingPlusOnes = rsvps.filter(
    r => r.plus_one_requested && r.plus_one_approved === null
  );

  function handlePlusOneDecision(rsvpId, approved) {
    setRsvps(prev =>
      prev.map(r =>
        r.id === rsvpId ? { ...r, plus_one_approved: approved } : r
      )
    );
    showToast(approved ? '✅ +1 approved!' : '❌ +1 denied');
  }

  // ---- Photo lock logic (locked before 2 AM next day) ----
  const isPhotoLocked = (() => {
    if (!event) return false;
    const now = new Date();
    const hour = now.getHours();
    // Simple heuristic: if it's party day and before 2 AM next day, photos are locked
    // For demo purposes, we'll keep photos unlocked if event has photo_dump_unlocked
    return !event.photo_dump_unlocked && hour < 2;
  })();

  // ---- Render guards ----
  if (!event) {
    return (
      <div className="dashboard" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading party…</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* ========== HEADER ========== */}
      <header className="dashboard-header">
        <div className="dashboard-header__top">
          <h2 className="dashboard-header__title">{event.name}</h2>
        </div>
        <span className="dashboard-header__badge">
          <span className="dashboard-header__badge-dot" />
          LIVE
        </span>
        <p className="dashboard-header__subtitle">
          {formatDate(event.date)} · {formatTime(event.time_start)} – {formatTime(event.time_end)}
        </p>
      </header>

      {/* ========== TAB BAR ========== */}
      <nav className="dashboard-tabs">
        <div className="tab-bar">
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={`tab-item${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* ========== TAB CONTENT ========== */}
      <div className="dashboard-content">
        {/* ---- TAB 1: OVERVIEW ---- */}
        {activeTab === 'overview' && (
          <div className="dashboard-tab-panel" key="overview">
            {/* Countdown */}
            <div className="dashboard-countdown-wrap">
              {CountdownTimer ? (
                <CountdownTimer targetDate={event.date} targetTime={event.time_start} />
              ) : (
                <Card className="dashboard-guest-list__card" style={{ textAlign: 'center', padding: '24px' }}>
                  <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8, fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                    Party starts in
                  </p>
                  <p style={{ fontSize: 'var(--text-3xl)', fontFamily: 'var(--font-display)', fontWeight: 700, background: 'var(--gradient-primary)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    🔥 Soon™
                  </p>
                </Card>
              )}
            </div>

            {/* Stats Row */}
            <div className="dashboard-stats">
              <div className="dashboard-stat-card">
                <div className="dashboard-stat-card__number dashboard-stat-card__number--purple">
                  {tallies.going}
                </div>
                <div className="dashboard-stat-card__label">Going</div>
              </div>
              <div className="dashboard-stat-card">
                <div className="dashboard-stat-card__number dashboard-stat-card__number--pink">
                  {tallies.nonveg}
                </div>
                <div className="dashboard-stat-card__label">Non-Veg</div>
              </div>
              <div className="dashboard-stat-card">
                <div className="dashboard-stat-card__number dashboard-stat-card__number--lime">
                  {tallies.byob}
                </div>
                <div className="dashboard-stat-card__label">BYOB</div>
              </div>
            </div>

            {/* Guest List */}
            <p className="dashboard-section-title">Guest List</p>
            <Card className="dashboard-guest-list__card">
              <div className="dashboard-guest-list">
                {rsvps.map(rsvp => (
                  <div className="dashboard-guest-row" key={rsvp.id}>
                    <div
                      className="dashboard-guest-row__avatar"
                      style={{ background: getAvatarGradient(rsvp.guest_name) }}
                    >
                      {getInitials(rsvp.guest_name)}
                    </div>
                    <div className="dashboard-guest-row__info">
                      <div className="dashboard-guest-row__name">{rsvp.guest_name}</div>
                      <div className="dashboard-guest-row__badges">
                        {rsvp.poll_food && (
                          <span className="dashboard-poll-badge" title={rsvp.poll_food}>
                            {FOOD_EMOJI[rsvp.poll_food]}
                          </span>
                        )}
                        {rsvp.poll_drinks && (
                          <span className="dashboard-poll-badge" title={rsvp.poll_drinks}>
                            {DRINK_EMOJI[rsvp.poll_drinks]}
                          </span>
                        )}
                        {rsvp.poll_staying && (
                          <span className="dashboard-poll-badge" title={rsvp.poll_staying}>
                            {STAY_EMOJI[rsvp.poll_staying]}
                          </span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`dashboard-guest-row__status dashboard-guest-row__status--${rsvp.status}`}
                    >
                      {rsvp.status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Directions Button */}
            {event.location_lat && event.location_lng && (
              <div className="dashboard-directions-btn" style={{ marginTop: 'var(--space-lg)' }}>
                <Btn
                  variant="blue"
                  onClick={() => window.open(getDirectionsUrl(event.location_lat, event.location_lng), '_blank')}
                >
                  Get Directions 📍
                </Btn>
              </div>
            )}
          </div>
        )}

        {/* ---- TAB 2: KITTY 💰 ---- */}
        {activeTab === 'kitty' && (
          <div className="dashboard-tab-panel" key="kitty">
            {/* Total */}
            <div className="dashboard-kitty-total">
              <div className="dashboard-kitty-total__label">Total Kitty</div>
              <div className="dashboard-kitty-total__amount">{formatINR(totalExpenses)}</div>
            </div>

            {/* Expense List */}
            <p className="dashboard-section-title">Expenses</p>
            <div className="dashboard-expense-list">
              {expenses.map(exp => (
                <div className="dashboard-expense-item" key={exp.id}>
                  <div className="dashboard-expense-item__info">
                    <div className="dashboard-expense-item__desc">{exp.description}</div>
                    <div className="dashboard-expense-item__by">Paid by {exp.paid_by}</div>
                  </div>
                  <div className="dashboard-expense-item__amount">{formatINR(exp.amount)}</div>
                </div>
              ))}
            </div>

            {/* Add Expense */}
            {!showAddExpense ? (
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <Btn variant="lime" onClick={() => setShowAddExpense(true)}>
                  + Add Expense
                </Btn>
              </div>
            ) : (
              <form className="dashboard-add-expense" onSubmit={handleAddExpense}>
                <div className="dashboard-add-expense__title">Add Expense</div>
                <div className="dashboard-add-expense__fields">
                  <input
                    className="dashboard-add-expense__input"
                    type="text"
                    placeholder="What was it for?"
                    value={expenseDesc}
                    onChange={e => setExpenseDesc(e.target.value)}
                    autoFocus
                  />
                  <div className="dashboard-add-expense__amount-wrap">
                    <span className="dashboard-add-expense__currency">₹</span>
                    <input
                      className="dashboard-add-expense__input"
                      type="number"
                      placeholder="0"
                      min="0"
                      value={expenseAmount}
                      onChange={e => setExpenseAmount(e.target.value)}
                    />
                  </div>
                  <div className="dashboard-add-expense__btn">
                    <Btn variant="lime" type="submit">
                      Add 💸
                    </Btn>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddExpense(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-display)',
                      fontSize: 'var(--text-sm)',
                      cursor: 'pointer',
                      padding: '8px 0',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Split Calculator */}
            <div className="dashboard-split">
              <div className="dashboard-split__text">
                Split{' '}
                <span className="dashboard-split__highlight">{formatINR(totalExpenses)}</span>
                {' '}among {tallies.going} guests ={' '}
                <span className="dashboard-split__highlight">{formatINR(splitAmount)}</span>
                {' '}each
              </div>

              <div className="dashboard-split__qr">
                {UPIQRCode ? (
                  <UPIQRCode
                    vpa={event.upi_id}
                    name={event.host_name}
                    amount={splitAmount}
                    note={`Split for ${event.name}`}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 48,
                    }}
                  >
                    📱
                  </div>
                )}
              </div>

              <div className="dashboard-split__pay-btn">
                <Btn
                  variant="pink"
                  onClick={() => {
                    const upiLink = `upi://pay?pa=${event.upi_id}&pn=${encodeURIComponent(event.host_name)}&am=${splitAmount}&cu=INR&tn=${encodeURIComponent(`Split for ${event.name}`)}`;
                    window.location.href = upiLink;
                  }}
                >
                  Pay via UPI 💳
                </Btn>
              </div>
            </div>
          </div>
        )}

        {/* ---- TAB 3: CAMERA ROLL 📸 ---- */}
        {activeTab === 'camera' && (
          <div className="dashboard-tab-panel" key="camera">
            <div className="dashboard-camera">
              {/* Upload Zone */}
              <div
                className="dashboard-upload-zone"
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
              >
                <div className="dashboard-upload-zone__icon">📸</div>
                <div className="dashboard-upload-zone__text">Tap to upload</div>
                <div className="dashboard-upload-zone__hint">or drag & drop photos here</div>
                <input
                  ref={fileInputRef}
                  className="dashboard-upload-input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                />
              </div>

              {/* Photo Lock Message */}
              {isPhotoLocked && (
                <div className="dashboard-photo-lock">
                  <div className="dashboard-photo-lock__icon">🔒</div>
                  <div className="dashboard-photo-lock__title">Photo Dump Locked</div>
                  <div className="dashboard-photo-lock__text">
                    Photos unlock at <span className="dashboard-photo-lock__time">2:00 AM</span>
                    <br />
                    Keep vibing, stop scrolling 💫
                  </div>
                </div>
              )}

              {/* Photo Grid (component or fallback) */}
              {PhotoGrid && photos.length > 0 ? (
                <PhotoGrid photos={photos} isLocked={isPhotoLocked} />
              ) : (
                /* Placeholder photo cards */
                <div className="dashboard-photo-placeholder-grid">
                  {(photos.length > 0 ? photos : PLACEHOLDER_PHOTOS).map(photo => (
                    <div className="dashboard-photo-placeholder" key={photo.id}>
                      <div className="dashboard-photo-placeholder__img">
                        {photo.photo_url ? (
                          <img
                            src={photo.photo_url}
                            alt={photo.caption || 'Party photo'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          '🖼️'
                        )}
                      </div>
                      <div className="dashboard-photo-placeholder__info">
                        <div className="dashboard-photo-placeholder__caption">
                          {photo.caption || 'no caption'}
                        </div>
                        <div className="dashboard-photo-placeholder__time">
                          {photo.created_at
                            ? new Date(photo.created_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- TAB 4: +1 REQUESTS ---- */}
        {activeTab === 'plusone' && (
          <div className="dashboard-tab-panel" key="plusone">
            <div className="dashboard-plus-one">
              <p className="dashboard-section-title">Pending +1 Requests</p>

              {PlusOneSwiper && pendingPlusOnes.length > 0 ? (
                <PlusOneSwiper
                  requests={pendingPlusOnes}
                  onApprove={id => handlePlusOneDecision(id, true)}
                  onDeny={id => handlePlusOneDecision(id, false)}
                />
              ) : pendingPlusOnes.length > 0 ? (
                pendingPlusOnes.map(rsvp => (
                  <div className="dashboard-plus-one-card" key={rsvp.id}>
                    <div className="dashboard-plus-one-card__header">
                      <div
                        className="dashboard-plus-one-card__avatar"
                        style={{ background: getAvatarGradient(rsvp.guest_name) }}
                      >
                        {getInitials(rsvp.guest_name)}
                      </div>
                      <div className="dashboard-plus-one-card__info">
                        <div className="dashboard-plus-one-card__requester">
                          {rsvp.guest_name}
                        </div>
                        <div className="dashboard-plus-one-card__guest">
                          wants to bring{' '}
                          <span className="dashboard-plus-one-card__guest-name">
                            {rsvp.plus_one_name}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="dashboard-plus-one-card__actions">
                      <button
                        className="dashboard-plus-one-card__btn dashboard-plus-one-card__btn--approve"
                        onClick={() => handlePlusOneDecision(rsvp.id, true)}
                      >
                        Approve ✓
                      </button>
                      <button
                        className="dashboard-plus-one-card__btn dashboard-plus-one-card__btn--deny"
                        onClick={() => handlePlusOneDecision(rsvp.id, false)}
                      >
                        Deny ✗
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="dashboard-plus-one__empty">
                  <div className="dashboard-plus-one__empty-icon">🎉</div>
                  <div className="dashboard-plus-one__empty-text">
                    No pending +1 requests
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========== TOAST ========== */}
      {toast && <div className="dashboard-toast">{toast}</div>}
    </div>
  );
}

/* ---- Placeholder photos for demo when no photos exist ---- */
const PLACEHOLDER_PHOTOS = [
  {
    id: 'ph_001',
    caption: 'golden hour hits different',
    photo_url: null,
    created_at: '2026-06-14T22:15:00',
  },
  {
    id: 'ph_002',
    caption: 'the setup 🔥',
    photo_url: null,
    created_at: '2026-06-14T22:45:00',
  },
  {
    id: 'ph_003',
    caption: 'caught vibing',
    photo_url: null,
    created_at: '2026-06-14T23:30:00',
  },
  {
    id: 'ph_004',
    caption: 'midnight snacks',
    photo_url: null,
    created_at: '2026-06-15T00:15:00',
  },
];
