import { useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { getEvent, saveEvent, getRSVPs, updateRSVP, deleteRSVP, getExpenses, addExpense, getPhotos, addPhoto, addPayment, getCurrentUser } from '../utils/storage';
import { generateId, formatDate, formatTime, formatINR, getDirectionsUrl, getInitials, getAvatarGradient } from '../utils/helpers';
import { calculateSplit } from '../utils/upi';
import { MOCK_EVENT_ACTIVE, MOCK_RSVPS, MOCK_EXPENSES } from '../data/mockData';
import GlassCard from '../components/GlassCard';
import GlowButton from '../components/GlowButton';
import CountdownTimer from '../components/CountdownTimer';
import UPIQRCode from '../components/UPIQRCode';
import PhotoGrid from '../components/PhotoGrid';
import PlusOneSwiper from '../components/PlusOneSwiper';
import PaymentModal from '../components/PaymentModal';
import SvgDecor from '../components/SvgDecor';
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
  const [event, setEvent] = useState(() => getEvent(eventId) || MOCK_EVENT_ACTIVE);
  const [rsvps, setRsvps] = useState(() => {
    const storedRSVPs = getRSVPs(eventId);
    return storedRSVPs.length ? storedRSVPs : MOCK_RSVPS;
  });
  const [expenses, setExpenses] = useState(() => {
    const storedExpenses = getExpenses(eventId);
    return storedExpenses.length ? storedExpenses : MOCK_EXPENSES;
  });
  const [photos, setPhotos] = useState(() => {
    const storedPhotos = getPhotos(eventId);
    return storedPhotos.length ? storedPhotos : [];
  });

  /* Expense form */
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editExpenseDesc, setEditExpenseDesc] = useState('');
  const [editExpenseAmount, setEditExpenseAmount] = useState('');

  /* Toast */
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  /* Photo upload ref */
  const fileInputRef = useRef(null);

  /* Guest editing states */
  const [editingGuestId, setEditingGuestId] = useState(null);
  const [editGuestName, setEditGuestName] = useState('');
  const [editGuestStatus, setEditGuestStatus] = useState('');

  /* Edit Party modal */
  const [showEditParty, setShowEditParty] = useState(false);
  const [editEvent, setEditEvent] = useState(() => ({
    name: '',
    vibe_tags: [],
    date: '',
    time_start: '',
    time_end: '',
    location_name: '',
    location_address: '',
    cover_charge: '',
    capacity: '',
    upi_id: '',
  }));

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentUser] = useState(() => getCurrentUser());

  const handlePaymentSuccess = ({ gateway, transactionId }) => {
    const paymentData = {
      id: 'pay_' + Math.random().toString(36).substring(2, 11),
      rsvp_id: null,
      event_id: event.id,
      amount: splitAmount,
      paid_by: currentUser ? currentUser.name : 'Guest User',
      transaction_id: transactionId,
      gateway: gateway,
      status: 'success'
    };

    addPayment(paymentData);
    setShowPaymentModal(false);
    showToast(`Payment of ${formatINR(splitAmount)} confirmed! Ref: ${transactionId}`);
  };

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
    nonveg: goingRsvps.reduce((sum, r) => sum + (typeof r.poll_food === 'object' && r.poll_food !== null ? (r.poll_food.nonveg || 0) : (r.poll_food === 'nonveg' ? (r.guest_count || 1) : 0)), 0),
    veg: goingRsvps.reduce((sum, r) => sum + (typeof r.poll_food === 'object' && r.poll_food !== null ? (r.poll_food.veg || 0) : (r.poll_food === 'veg' ? (r.guest_count || 1) : 0)), 0),
    vegan: goingRsvps.reduce((sum, r) => sum + (typeof r.poll_food === 'object' && r.poll_food !== null ? (r.poll_food.vegan || 0) : (r.poll_food === 'vegan' ? (r.guest_count || 1) : 0)), 0),
    byob: goingRsvps.reduce((sum, r) => sum + (typeof r.poll_drinks === 'object' && r.poll_drinks !== null ? (r.poll_drinks.byob || 0) : (r.poll_drinks === 'byob' ? (r.guest_count || 1) : 0)), 0),
    mocktails: goingRsvps.reduce((sum, r) => sum + (typeof r.poll_drinks === 'object' && r.poll_drinks !== null ? (r.poll_drinks.mocktails || 0) : (r.poll_drinks === 'mocktails' ? (r.guest_count || 1) : 0)), 0),
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
    showToast('Expense added!');
  }

  function handleDeleteExpense(id) {
    setExpenses(prev => prev.filter(e => e.id !== id));
    // Persist deletion in localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('lowkey_expenses') || '[]');
      localStorage.setItem('lowkey_expenses', JSON.stringify(stored.filter(e => e.id !== id)));
    } catch (_) {}
    showToast('Expense removed.');
  }

  function handleSaveEditExpense(e) {
    e.preventDefault();
    if (!editExpenseDesc.trim() || !editExpenseAmount) return;
    setExpenses(prev => prev.map(exp =>
      exp.id === editingExpenseId
        ? { ...exp, description: editExpenseDesc.trim(), amount: Number(editExpenseAmount) }
        : exp
    ));
    try {
      const stored = JSON.parse(localStorage.getItem('lowkey_expenses') || '[]');
      const updated = stored.map(exp =>
        exp.id === editingExpenseId
          ? { ...exp, description: editExpenseDesc.trim(), amount: Number(editExpenseAmount) }
          : exp
      );
      localStorage.setItem('lowkey_expenses', JSON.stringify(updated));
    } catch (_) {}
    setEditingExpenseId(null);
    showToast('Expense updated!');
  }

  function openEditExpense(exp) {
    setEditingExpenseId(exp.id);
    setEditExpenseDesc(exp.description);
    setEditExpenseAmount(String(exp.amount));
    setShowAddExpense(false);
  }

  // ---- Guest List Handlers ----
  function handleSaveEditGuest(rsvpId) {
    const trimmedName = editGuestName.trim();
    if (!trimmedName) return;

    setRsvps(prev =>
      prev.map(r =>
        r.id === rsvpId ? { ...r, guest_name: trimmedName, status: editGuestStatus } : r
      )
    );

    updateRSVP(rsvpId, { guest_name: trimmedName, status: editGuestStatus });
    setEditingGuestId(null);
    showToast('Guest updated!');
  }

  function handleDeleteGuest(rsvpId) {
    if (window.confirm('Are you sure you want to remove this guest?')) {
      setRsvps(prev => prev.filter(r => r.id !== rsvpId));
      deleteRSVP(rsvpId);
      showToast('Guest removed.');
    }
  }

  function openEditGuest(rsvp) {
    setEditingGuestId(rsvp.id);
    setEditGuestName(rsvp.guest_name);
    setEditGuestStatus(rsvp.status);
  }

  function openEditParty() {
    setEditEvent({
      name: event.name || '',
      vibe_tags: event.vibe_tags || [],
      date: event.date || '',
      time_start: event.time_start || '',
      time_end: event.time_end || '',
      location_name: event.location_name || '',
      location_address: event.location_address || '',
      cover_charge: event.cover_charge != null ? String(event.cover_charge) : '',
      capacity: event.capacity != null ? String(event.capacity) : '',
      upi_id: event.upi_id || '',
    });
    setShowEditParty(true);
  }

  // ---- Photo handlers ----
  function handlePhotoUpload(e) {
    const files = e.target.files;
    if (!files?.length) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        const newPhoto = {
          id: `photo_${generateId()}`,
          event_id: event?.id || eventId,
          uploaded_by: currentUser?.name || 'Guest',
          photo_url: base64String,
          caption: file.name.split('.')[0],
          filter: 'raw',
          created_at: new Date().toISOString(),
        };
        addPhoto(newPhoto);
        setPhotos(prev => [...prev, newPhoto]);
      };
      reader.readAsDataURL(file);
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
      <SvgDecor variant="grid" />
      {/* ========== EDIT PARTY MODAL ========== */}
      {showEditParty && (
        <div className="dashboard-edit-overlay" onClick={(e) => e.target === e.currentTarget && setShowEditParty(false)}>
          <div className="dashboard-edit-modal">
            <div className="dashboard-edit-modal__header">
              <span className="dashboard-edit-modal__title">Edit Party Details</span>
              <button className="dashboard-edit-modal__close" onClick={() => setShowEditParty(false)} type="button">✕</button>
            </div>
            <div className="dashboard-edit-modal__body">
              <div className="dashboard-edit-field">
                <label className="dashboard-edit-label">Party Name</label>
                <input className="dashboard-add-expense__input" type="text" value={editEvent.name} onChange={e => setEditEvent(p => ({...p, name: e.target.value}))} maxLength={60} />
              </div>
              <div className="dashboard-edit-field">
                <label className="dashboard-edit-label">Party Tags</label>
                <div className="dashboard-edit-tags-list">
                  {(editEvent.vibe_tags || []).map(tag => (
                    <span key={tag} className="dashboard-edit-tag-chip">
                      #{tag.toLowerCase()}
                      <button
                        type="button"
                        className="dashboard-edit-tag-chip__remove"
                        onClick={() => {
                          setEditEvent(p => ({
                            ...p,
                            vibe_tags: (p.vibe_tags || []).filter(t => t !== tag)
                          }));
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  {(editEvent.vibe_tags || []).length === 0 && (
                    <span className="dashboard-edit-tags-empty">No tags added yet.</span>
                  )}
                </div>
                <div className="dashboard-edit-tag-input-row">
                  <input
                    className="dashboard-add-expense__input"
                    type="text"
                    placeholder="Type tag & press Enter..."
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const newTag = e.target.value.trim();
                        if (newTag && !(editEvent.vibe_tags || []).includes(newTag)) {
                          setEditEvent(p => ({
                            ...p,
                            vibe_tags: [...(p.vibe_tags || []), newTag]
                          }));
                          e.target.value = '';
                        }
                      }
                    }}
                  />
                </div>
              </div>
              <div className="dashboard-edit-row">
                <div className="dashboard-edit-field">
                  <label className="dashboard-edit-label">Date</label>
                  <input className="dashboard-add-expense__input" type="date" value={editEvent.date} onChange={e => setEditEvent(p => ({...p, date: e.target.value}))} />
                </div>
              </div>
              <div className="dashboard-edit-row">
                <div className="dashboard-edit-field">
                  <label className="dashboard-edit-label">Start Time</label>
                  <input className="dashboard-add-expense__input" type="time" value={editEvent.time_start} onChange={e => setEditEvent(p => ({...p, time_start: e.target.value}))} />
                </div>
                <div className="dashboard-edit-field">
                  <label className="dashboard-edit-label">End Time</label>
                  <input className="dashboard-add-expense__input" type="time" value={editEvent.time_end} onChange={e => setEditEvent(p => ({...p, time_end: e.target.value}))} />
                </div>
              </div>
              <div className="dashboard-edit-field">
                <label className="dashboard-edit-label">Venue Name</label>
                <input className="dashboard-add-expense__input" type="text" value={editEvent.location_name} onChange={e => setEditEvent(p => ({...p, location_name: e.target.value}))} placeholder="My Terrace, Koramangala" />
              </div>
              <div className="dashboard-edit-field">
                <label className="dashboard-edit-label">Address</label>
                <input className="dashboard-add-expense__input" type="text" value={editEvent.location_address} onChange={e => setEditEvent(p => ({...p, location_address: e.target.value}))} placeholder="full address for directions" />
              </div>
              <div className="dashboard-edit-row">
                <div className="dashboard-edit-field">
                  <label className="dashboard-edit-label">Cover (₹)</label>
                  <input className="dashboard-add-expense__input" type="number" min="0" value={editEvent.cover_charge} onChange={e => setEditEvent(p => ({...p, cover_charge: e.target.value}))} placeholder="0" />
                </div>
                <div className="dashboard-edit-field">
                  <label className="dashboard-edit-label">Capacity</label>
                  <input className="dashboard-add-expense__input" type="number" min="1" value={editEvent.capacity} onChange={e => setEditEvent(p => ({...p, capacity: e.target.value}))} placeholder="40" />
                </div>
              </div>
              <div className="dashboard-edit-field">
                <label className="dashboard-edit-label">UPI ID</label>
                <input className="dashboard-add-expense__input" type="text" value={editEvent.upi_id} onChange={e => setEditEvent(p => ({...p, upi_id: e.target.value}))} placeholder="yourname@upi" />
              </div>
            </div>
            <div className="dashboard-edit-modal__footer">
              <button
                className="dashboard-edit-save-btn"
                type="button"
                onClick={() => {
                  const updatedEvent = {
                    ...event,
                    ...editEvent,
                    cover_charge: Number(editEvent.cover_charge) || 0,
                    capacity: Number(editEvent.capacity) || null,
                    tagline: (editEvent.vibe_tags || []).map(t => '#' + t).join(' ')
                  };
                  saveEvent(updatedEvent);
                  setEvent(updatedEvent);
                  setShowEditParty(false);
                  showToast('Party details saved!');
                }}
              >
                Save Changes
              </button>
              <button className="dashboard-edit-cancel-btn" type="button" onClick={() => setShowEditParty(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {/* ========== HEADER ========== */}
      <header className="dashboard-header">
        <div className="dashboard-header__top">
          <h2 className="dashboard-header__title">{event.name}</h2>
          <button
            className="dashboard-header__edit-btn"
            type="button"
            onClick={openEditParty}
            title="Edit party details"
          >
            Edit Party
          </button>
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
            <div className="dashboard-panel-col">
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

              {/* Party Brief */}
              <Card className="dashboard-brief">
                <div className="dashboard-brief__grid">
                  <div>
                    <span className="dashboard-brief__label">City</span>
                    <strong>{event.city || 'India'}</strong>
                  </div>
                  <div>
                    <span className="dashboard-brief__label">Cover</span>
                    <strong>{event.cover_charge ? formatINR(event.cover_charge) : 'Free'}</strong>
                  </div>
                  <div>
                    <span className="dashboard-brief__label">Capacity</span>
                    <strong>{event.capacity || 'Open'}</strong>
                  </div>
                </div>
                {event.has_personal_dj && event.dj_name && (
                  <div className="dashboard-brief__dj">
                    <span className="dashboard-brief__dj-mark">DJ</span>
                    <div>
                      <strong>{event.dj_name}</strong>
                      {event.dj_genre && <span>{event.dj_genre}</span>}
                    </div>
                    <div className="dashboard-brief__dj-links">
                      {event.dj_profile_url && (
                        <a href={event.dj_profile_url} target="_blank" rel="noreferrer">Profile</a>
                      )}
                      {event.dj_instagram && (
                        <a href={event.dj_instagram} target="_blank" rel="noreferrer">Instagram</a>
                      )}
                    </div>
                  </div>
                )}
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

            <div className="dashboard-panel-col">
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
                  {rsvps.map(rsvp => {
                    const isEditing = rsvp.id === editingGuestId;
                    return (
                      <div className={`dashboard-guest-row ${isEditing ? 'editing' : ''}`} key={rsvp.id}>
                        <div
                          className="dashboard-guest-row__avatar"
                          style={{ background: getAvatarGradient(rsvp.guest_name) }}
                        >
                          {getInitials(rsvp.guest_name)}
                        </div>
                        
                        {isEditing ? (
                          <div className="dashboard-guest-inline-edit">
                            <input
                              className="dashboard-guest-edit-input"
                              type="text"
                              value={editGuestName}
                              onChange={e => setEditGuestName(e.target.value)}
                              maxLength={40}
                              autoFocus
                            />
                            <select
                              className="dashboard-guest-edit-select"
                              value={editGuestStatus}
                              onChange={e => setEditGuestStatus(e.target.value)}
                            >
                              <option value="going">going</option>
                              <option value="maybe">maybe</option>
                              <option value="not going">not going</option>
                            </select>
                            <div className="dashboard-guest-edit-actions">
                              <button
                                className="dashboard-expense-icon-btn dashboard-expense-icon-btn--edit"
                                type="button"
                                title="Save changes"
                                onClick={() => handleSaveEditGuest(rsvp.id)}
                              >
                                💾
                              </button>
                              <button
                                className="dashboard-expense-icon-btn"
                                type="button"
                                title="Cancel"
                                onClick={() => setEditingGuestId(null)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
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
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                              <span
                                className={`dashboard-guest-row__status dashboard-guest-row__status--${rsvp.status}`}
                              >
                                {rsvp.status}
                              </span>
                              <div className="dashboard-guest-actions">
                                <button
                                  className="dashboard-expense-icon-btn dashboard-expense-icon-btn--edit"
                                  type="button"
                                  title="Edit guest"
                                  onClick={() => openEditGuest(rsvp)}
                                >
                                  ✏️
                                </button>
                                <button
                                  className="dashboard-expense-icon-btn dashboard-expense-icon-btn--delete"
                                  type="button"
                                  title="Remove guest"
                                  onClick={() => handleDeleteGuest(rsvp.id)}
                                >
                                  🗑
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        )}

        {/* ---- TAB 2: KITTY 💰 ---- */}
        {activeTab === 'kitty' && (
          <div className="dashboard-tab-panel" key="kitty">
            <div className="dashboard-panel-col">
              {/* Expense List with Edit/Delete */}
              <p className="dashboard-section-title">Expenses</p>
              <div className="dashboard-expense-list">
                {expenses.map(exp => (
                  <div className="dashboard-expense-item" key={exp.id}>
                    {editingExpenseId === exp.id ? (
                      // Inline edit form for this expense
                      <form className="dashboard-expense-inline-edit" onSubmit={handleSaveEditExpense}>
                        <input
                          className="dashboard-add-expense__input"
                          type="text"
                          value={editExpenseDesc}
                          onChange={e => setEditExpenseDesc(e.target.value)}
                          placeholder="Description"
                          autoFocus
                        />
                        <div className="dashboard-add-expense__amount-wrap" style={{ marginTop: 6 }}>
                          <span className="dashboard-add-expense__currency">₹</span>
                          <input
                            className="dashboard-add-expense__input"
                            type="number"
                            placeholder="0"
                            min="0"
                            value={editExpenseAmount}
                            onChange={e => setEditExpenseAmount(e.target.value)}
                          />
                        </div>
                        <div className="dashboard-expense-inline-edit__actions">
                          <button type="submit" className="dashboard-expense-action-btn dashboard-expense-action-btn--save">Save</button>
                          <button type="button" className="dashboard-expense-action-btn dashboard-expense-action-btn--cancel" onClick={() => setEditingExpenseId(null)}>Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="dashboard-expense-item__info">
                          <div className="dashboard-expense-item__desc">{exp.description}</div>
                          <div className="dashboard-expense-item__by">Paid by {exp.paid_by}</div>
                        </div>
                        <div className="dashboard-expense-item__right">
                          <div className="dashboard-expense-item__amount">{formatINR(exp.amount)}</div>
                          <div className="dashboard-expense-item__actions">
                            <button
                              className="dashboard-expense-icon-btn dashboard-expense-icon-btn--edit"
                              type="button"
                              title="Edit expense"
                              onClick={() => openEditExpense(exp)}
                            >
                              ✏️
                            </button>
                            <button
                              className="dashboard-expense-icon-btn dashboard-expense-icon-btn--delete"
                              type="button"
                              title="Delete expense"
                              onClick={() => handleDeleteExpense(exp.id)}
                            >
                              🗑
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Expense */}
              {!showAddExpense ? (
                <div style={{ marginBottom: 'var(--space-lg)' }}>
                  <Btn variant="lime" onClick={() => { setShowAddExpense(true); setEditingExpenseId(null); }}>
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
                        Add
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
            </div>

            <div className="dashboard-panel-col">
              {/* Total */}
              <div className="dashboard-kitty-total">
                <div className="dashboard-kitty-total__label">Total Kitty</div>
                <div className="dashboard-kitty-total__amount">{formatINR(totalExpenses)}</div>
              </div>

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
                      upiId={event.upi_id}
                      payeeName={event.host_name}
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
                    onClick={() => setShowPaymentModal(true)}
                  >
                    Pay Split Share 💳
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---- TAB 3: CAMERA ROLL 📸 ---- */}
        {activeTab === 'camera' && (
          <div className="dashboard-tab-panel" key="camera">
            <div className="dashboard-panel-col">
              {/* External Link Overlay */}
              {event?.external_photo_link ? (
                <div className="dashboard-external-photo-link" style={{ textAlign: 'center', padding: 'var(--space-2xl)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '48px', marginBottom: 'var(--space-md)' }}>📸</div>
                  <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 'var(--space-sm)' }}>External Photo Dump</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>Photos for this party are hosted externally. Upload and view them there!</p>
                  <a href={event.external_photo_link} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '12px 24px', background: 'var(--gradient-primary)', color: '#fff', borderRadius: 'var(--radius-md)', textDecoration: 'none', fontWeight: 'bold' }}>Open Photo Folder ↗</a>
                </div>
              ) : (
                <>
                  {/* Upload Zone */}
                  {!isPhotoLocked && (
                    <div
                      className="dashboard-upload-zone"
                      onClick={() => fileInputRef.current?.click()}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
                    >
                      <div className="dashboard-upload-zone__icon">📸</div>
                      <div className="dashboard-upload-zone__text">Tap to upload</div>
                      <div className="dashboard-upload-zone__hint">or select multiple photos</div>
                      <input
                        ref={fileInputRef}
                        className="dashboard-upload-input"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                      />
                    </div>
                  )}

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
                </>
              )}
            </div>

            <div className="dashboard-panel-col">
              {/* Photo Grid (component or fallback) */}
              {!event?.external_photo_link && (PhotoGrid && photos.length > 0 ? (
                <PhotoGrid 
                  photos={photos} 
                  isLocked={isPhotoLocked} 
                  timeRemaining={event?.date ? (() => {
                    const eventEndDate = new Date(event.date);
                    if (event.time_end) {
                      const [h, m] = event.time_end.split(':').map(Number);
                      eventEndDate.setHours(h, m, 0, 0);
                      if (event.time_end_next_day) eventEndDate.setDate(eventEndDate.getDate() + 1);
                    } else {
                      eventEndDate.setDate(eventEndDate.getDate() + 1);
                    }
                    const diffMs = (eventEndDate.getTime() + 3 * 24 * 60 * 60 * 1000) - Date.now();
                    if (diffMs <= 0) return 'expired';
                    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                    return `${days}d ${hours}h`;
                  })() : null}
                />
              ) : (
                /* Placeholder photo cards */
                !event?.external_photo_link && (
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
                              ? new Date(photo.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : '12:00 AM'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ))}
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

      {/* ========== Payment Checkout Modal ========== */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        amount={splitAmount}
        upiId={event.upi_id || 'lowkey@okaxis'}
        payeeName={event.host_name || 'LowKey Host'}
        note={`Split Settlement: ${event.name}`}
        onPaymentSuccess={handlePaymentSuccess}
      />
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
