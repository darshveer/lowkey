import { useState, useRef, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getEvent, saveEvent, getRSVPs, updateRSVP, deleteRSVP, getExpenses, addExpense, getPhotos, addPhoto, uploadPhotoFile, getPayments, addPayment, updatePayment, getCurrentUser, subscribeToEvent, promoteWaitlist, checkPaymentDeadlines, startEvent, archiveEvent, deleteEvent, getProfile, findProfileByEmail } from '../utils/storage';
import { generateId, formatDate, formatTime, formatINR, getInitials, getAvatarGradient, getPhotoDumpTimeRemaining, safeUrl, safeImageSrc, isEventOver, isPartyManager } from '../utils/helpers';
import { calculateSplit } from '../utils/upi';
import { parseCheckInToken } from '../utils/qr';
import GlassCard from '../components/GlassCard';
import GlowButton from '../components/GlowButton';
import CountdownTimer from '../components/CountdownTimer';
import UPIQRCode from '../components/UPIQRCode';
import PhotoGrid from '../components/PhotoGrid';
import PlusOneSwiper from '../components/PlusOneSwiper';
import PaymentModal from '../components/PaymentModal';
import ConfirmDialog from '../components/ConfirmDialog';
import ProfilePeek from '../components/ProfilePeek';
import QRScanner from '../components/QRScanner';
import MapPreview from '../components/MapPreview';
import VibeWall from '../components/VibeWall';
import AnnouncementsPanel from '../components/AnnouncementsPanel';
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
  { key: 'kitty', label: 'Kitty' },
  { key: 'camera', label: 'Camera' },
  { key: 'plusone', label: '+1' },
];

/**
 * PartyDashboard — Active Party Mode
 * Activated 2 hours before the party starts.
 * Route: /party/:eventId
 */
export default function PartyDashboard() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [event, setEvent] = useState(() => getEvent(eventId));

  // Tint ambient FX (cursor glow + background) to this party's theme.
  // A 'custom' theme carries a host-picked gradient — apply it as inline FX vars.
  const dashCustomFrom = event?.theme === 'custom' ? event?.custom_gradient?.from : null;
  const dashCustomTo = event?.theme === 'custom' ? event?.custom_gradient?.to : null;
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-party-theme', event?.theme || 'neon');
    if (dashCustomFrom && dashCustomTo) {
      root.style.setProperty('--fx-accent-1', dashCustomFrom);
      root.style.setProperty('--fx-accent-2', dashCustomTo);
      root.style.setProperty('--fx-accent-3', dashCustomFrom);
      root.style.setProperty('--fx-accent-ring', dashCustomTo);
    }
    return () => {
      root.removeAttribute('data-party-theme');
      ['--fx-accent-1', '--fx-accent-2', '--fx-accent-3', '--fx-accent-ring'].forEach((v) => root.style.removeProperty(v));
    };
  }, [event?.theme, dashCustomFrom, dashCustomTo]);

  const [rsvps, setRsvps] = useState(() => getRSVPs(eventId));
  const [expenses, setExpenses] = useState(() => getExpenses(eventId));
  const [payments, setPayments] = useState(() => getPayments(eventId));
  const [photos, setPhotos] = useState(() => {
    const storedPhotos = getPhotos(eventId);
    return storedPhotos.length ? storedPhotos : [];
  });

  // Lazy sweep: expire unpaid RSVPs past their deadline + promote the
  // waitlist, and remind guests whose deadline is approaching. There's no
  // background job in this app, so this runs whenever the dashboard mounts.
  useEffect(() => {
    const evId = event?.id || eventId;
    if (!evId) return;
    checkPaymentDeadlines(evId);
  }, [event?.id, eventId]);

  // ---- Realtime: live RSVPs, photos & payments for this party ----
  useEffect(() => {
    const evId = event?.id || eventId;
    if (!evId) return;
    return subscribeToEvent(evId, {
      onRsvp: (payload) => {
        if (payload.eventType === 'DELETE') {
          setRsvps(prev => prev.filter(r => r.id !== payload.old?.id));
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
      },
      onPhoto: (payload) => {
        const row = payload.new;
        if (!row || payload.eventType === 'DELETE') return;
        setPhotos(prev => (prev.some(p => p.id === row.id) ? prev : [...prev, row]));
      },
      onPayment: (payload) => {
        if (payload.eventType === 'DELETE') {
          setPayments(prev => prev.filter(p => p.id !== payload.old?.id));
          return;
        }
        const row = payload.new;
        if (!row) return;
        setPayments(prev => {
          const idx = prev.findIndex(p => p.id === row.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = { ...copy[idx], ...row };
            return copy;
          }
          return [...prev, row];
        });
      },
    });
  }, [event?.id, eventId]);

  /* Expense form */
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [editExpenseDesc, setEditExpenseDesc] = useState('');
  const [editExpenseAmount, setEditExpenseAmount] = useState('');
  const [expenseSplitType, setExpenseSplitType] = useState('equal'); // 'equal' | 'custom'
  const [expenseShares, setExpenseShares] = useState({}); // rsvpId -> amount
  const [expenseReceipt, setExpenseReceipt] = useState(null); // { url } | null
  const receiptInputRef = useRef(null);
  const [coHostInput, setCoHostInput] = useState('');

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
    payment_deadline_hours: '',
  }));

  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentUser] = useState(() => getCurrentUser());

  // Payment approvals — sub-tabs are independent and interchangeable, plus a
  // search that filters the current one (phone number, name, or UTR).
  const [approvalSubTab, setApprovalSubTab] = useState('pending');
  const [approvalSearch, setApprovalSearch] = useState('');

  // Door scanner — decodes a guest's entry QR to check them in.
  const [showScanner, setShowScanner] = useState(false);
  const lastScanRef = useRef({ token: null, atMs: 0 });

  // In-app confirmation dialog — { title, message, confirmLabel, danger, onConfirm } | null
  const [confirmState, setConfirmState] = useState(null);

  // Profile peek modal — a person object (see ProfilePeek) or null
  const [peek, setPeek] = useState(null);
  function openPeek(userId, fallbackName) {
    if (!userId) return;
    const p = getProfile(userId);
    setPeek({ id: userId, ...(p || {}), name: p?.name || fallbackName });
  }

  // Party doesn't exist — all hooks are declared above this guard.
  if (!event) {
    return (
      <div className="page">
        <div className="dashboard-notfound glass-strong">
          <div className="dashboard-notfound__emoji" aria-hidden="true">🎈</div>
          <h1 className="dashboard-notfound__title">Party not found</h1>
          <p className="dashboard-notfound__text">
            This dashboard doesn't exist anymore, or you opened a stale link.
          </p>
          <Link to="/" className="dashboard-notfound__btn">Back to LowKey →</Link>
        </div>
      </div>
    );
  }

  const handlePaymentSubmitted = ({ transactionId, phone }) => {
    const paymentData = {
      id: 'pay_' + generateId(),
      rsvp_id: null,
      event_id: event.id,
      amount: splitAmount,
      paid_by: currentUser ? currentUser.name : 'Guest User',
      phone: phone || null,
      transaction_id: transactionId,
      gateway: 'upi',
    };

    addPayment(paymentData);
    setPayments(prev => [...prev, paymentData]);
    setShowPaymentModal(false);
    showToast(`Submitted ${formatINR(splitAmount)} for approval. Ref: ${transactionId}`);
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
  const customSplitSum = goingRsvps.reduce((s, r) => s + (Number(expenseShares[r.id]) || 0), 0);

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

  async function handleReceiptUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    showToast('Uploading receipt…');
    const uploaded = await uploadPhotoFile(file, `${event?.id || eventId}-receipts`);
    const url = uploaded?.url || (await new Promise((res) => {
      const r = new FileReader();
      r.onloadend = () => res(r.result);
      r.readAsDataURL(file);
    }));
    setExpenseReceipt({ url });
    showToast('Receipt attached.');
    if (receiptInputRef.current) receiptInputRef.current.value = '';
  }

  function handleAddExpense(e) {
    e.preventDefault();
    if (!expenseDesc.trim() || !expenseAmount) return;

    const amount = Number(expenseAmount);
    const shares =
      expenseSplitType === 'custom'
        ? Object.fromEntries(
            goingRsvps.map(r => [r.guest_name, Math.round(Number(expenseShares[r.id] ?? 0))])
          )
        : null;

    const newExpense = {
      id: `exp_${generateId()}`,
      event_id: event?.id || eventId,
      description: expenseDesc.trim(),
      amount,
      paid_by: event?.host_name || 'You',
      split_type: expenseSplitType,
      split_shares: shares,
      receipt_url: expenseReceipt?.url || null,
      upi_id: event?.upi_id || '',
    };

    addExpense(newExpense);
    setExpenses(prev => [...prev, newExpense]);
    setExpenseDesc('');
    setExpenseAmount('');
    setExpenseSplitType('equal');
    setExpenseShares({});
    setExpenseReceipt(null);
    setShowAddExpense(false);
    showToast('Expense added!');
  }

  function handleDeleteExpense(id) {
    setExpenses(prev => prev.filter(e => e.id !== id));
    // Persist deletion in localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('lowkey_expenses') || '[]');
      localStorage.setItem('lowkey_expenses', JSON.stringify(stored.filter(e => e.id !== id)));
    } catch { /* ignore persistence errors */ }
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
    } catch { /* ignore persistence errors */ }
    setEditingExpenseId(null);
    showToast('Expense updated!');
  }

  function openEditExpense(exp) {
    setEditingExpenseId(exp.id);
    setEditExpenseDesc(exp.description);
    setEditExpenseAmount(String(exp.amount));
    setShowAddExpense(false);
  }

  // ---- Settlement handler ----
  function handleToggleSettled(rsvp) {
    const settled = !rsvp.settled;
    setRsvps(prev => prev.map(r => (r.id === rsvp.id ? { ...r, settled } : r)));
    updateRSVP(rsvp.id, { settled });
    showToast(settled ? `${rsvp.guest_name} marked paid` : `${rsvp.guest_name} marked unpaid`);
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
    setConfirmState({
      title: 'Remove this guest?',
      message: 'Their RSVP is deleted. If there is a waitlist, the next guest is promoted automatically.',
      confirmLabel: 'Remove',
      danger: true,
      onConfirm: () => {
        setConfirmState(null);
        setRsvps(prev => prev.filter(r => r.id !== rsvpId));
        deleteRSVP(rsvpId);
        // A spot may have freed up — auto-promote the next waitlisted guest.
        promoteWaitlist(event?.id || eventId);
        setRsvps(getRSVPs(event?.id || eventId));
        showToast('Guest removed.');
      },
    });
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
      payment_deadline_hours: event.payment_deadline_hours != null ? String(event.payment_deadline_hours) : '12',
    });
    setShowEditParty(true);
  }

  // ---- Photo handlers ----
  async function handlePhotoUpload(e) {
    const files = e.target.files;
    if (!files?.length) return;

    const evId = event?.id || eventId;
    showToast('Uploading…');

    for (const file of Array.from(files)) {
      // Prefer Supabase Storage (real hosting); fall back to an inline base64 copy.
      const uploaded = await uploadPhotoFile(file, evId);
      const photoUrl =
        uploaded?.url ||
        (await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        }));

      const newPhoto = {
        id: `photo_${generateId()}`,
        event_id: evId,
        uploaded_by: currentUser?.name || 'Guest',
        uploaded_by_id: currentUser?.id || null,
        storage_path: uploaded?.path || null,
        photo_url: photoUrl,
        caption: file.name.split('.')[0],
        filter: 'raw',
        created_at: new Date().toISOString(),
      };
      addPhoto(newPhoto);
      setPhotos(prev => [...prev, newPhoto]);
    }

    showToast('Photo uploaded!');
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
    updateRSVP(rsvpId, { plus_one_approved: approved });
    showToast(approved ? '+1 approved!' : '+1 denied');
  }

  // ---- Door check-in ----
  const checkedInCount = goingRsvps.filter(r => r.checked_in).length;
  function handleToggleCheckIn(rsvp) {
    const checked_in = !rsvp.checked_in;
    setRsvps(prev => prev.map(r => (r.id === rsvp.id ? { ...r, checked_in } : r)));
    updateRSVP(rsvp.id, { checked_in });
    showToast(checked_in ? `${rsvp.guest_name} checked in` : `${rsvp.guest_name} check-in undone`);
  }

  // ---- Host / co-host gate — the scanner and payment approvals are their business ----
  const isManager = isPartyManager(event, currentUser?.id);

  // ---- Door scanner: decode a guest's entry QR and check them in ----
  function handleScanDecode(text) {
    const parsed = parseCheckInToken(text);
    if (!parsed || parsed.eventId !== (event?.id || eventId)) {
      showToast('That QR is not a valid ticket for this party.');
      return;
    }
    // Ignore rapid repeat scans of the same code (the camera reads every frame).
    const now = new Date().getTime();
    if (lastScanRef.current.token === parsed.rsvpId && now - lastScanRef.current.atMs < 4000) return;
    lastScanRef.current = { token: parsed.rsvpId, atMs: now };

    const rsvp = rsvps.find(r => r.id === parsed.rsvpId);
    if (!rsvp) {
      showToast('Ticket not found for this party.');
      return;
    }
    if (rsvp.checked_in) {
      showToast(`${rsvp.guest_name} is already checked in.`);
      return;
    }
    if (event.cover_charge > 0 && !rsvp.cover_paid) {
      showToast(`${rsvp.guest_name}'s payment hasn't been approved yet.`);
      return;
    }
    handleToggleCheckIn(rsvp);
  }

  // ---- Waitlist ----
  const waitlistRsvps = rsvps.filter(r => r.status === 'waitlist');

  // ---- Payment approvals ----
  const approvalRows = payments
    .filter(p => (p.status || 'pending') === approvalSubTab)
    .filter(p => {
      const q = approvalSearch.trim().toLowerCase();
      if (!q) return true;
      return [p.paid_by, p.phone, p.transaction_id].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const approvalCounts = {
    pending: payments.filter(p => (p.status || 'pending') === 'pending').length,
    approved: payments.filter(p => p.status === 'approved').length,
    declined: payments.filter(p => p.status === 'declined').length,
  };

  function decidePayment(paymentId, status) {
    const updated = updatePayment(paymentId, status);
    if (!updated) return;
    setPayments(prev => prev.map(p => (p.id === paymentId ? { ...p, status } : p)));
    if (updated.rsvp_id) {
      setRsvps(prev => prev.map(r => (r.id === updated.rsvp_id ? { ...r, cover_paid: status === 'approved' } : r)));
    }
    showToast(status === 'approved' ? 'Payment approved.' : 'Payment declined.');
  }

  // ---- Co-hosts (added by email; linked to a profile when one exists) ----
  // Entries are { email, id, username, name }. Legacy parties may still hold
  // plain name strings — normalize so both shapes render.
  const normalizeCoHost = (c) =>
    typeof c === 'string' ? { name: c, email: null, id: null, username: null } : c;
  const coHostKey = (c) => c.email || c.name;
  const coHostLabel = (c) => (c.username ? `@${c.username}` : c.name || c.email);
  const coHosts = (event?.co_hosts || []).map(normalizeCoHost);

  function addCoHost() {
    const email = coHostInput.trim().toLowerCase();
    if (!email) return;
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      showToast('Enter a valid email address.');
      return;
    }
    if (currentUser?.email && email === currentUser.email.toLowerCase()) {
      showToast("That's you — you're already the host.");
      return;
    }
    if (coHosts.some(c => (c.email || '').toLowerCase() === email)) {
      showToast('Already a co-host.');
      return;
    }
    const profile = findProfileByEmail(email);
    const entry = {
      email,
      id: profile?.id || null,
      username: profile?.username || null,
      name: profile?.name || null,
    };
    const updated = { ...event, co_hosts: [...(event.co_hosts || []), entry] };
    setEvent(updated);
    saveEvent(updated);
    setCoHostInput('');
    showToast(profile
      ? `${coHostLabel(entry)} added as co-host`
      : `${email} added — no LowKey account yet`);
  }
  function removeCoHost(key) {
    const updated = {
      ...event,
      co_hosts: (event.co_hosts || []).filter(c => coHostKey(normalizeCoHost(c)) !== key),
    };
    setEvent(updated);
    saveEvent(updated);
  }

  // ---- Post-party recap (event date is in the past) ----
  const isPast = !!(event?.date && event.date < new Date().toISOString().split('T')[0]);

  // ---- Lifecycle: over? started? ----
  const over = isEventOver(event);
  const started = !!event?.started;

  function handleStartParty() {
    const updated = startEvent(event.id);
    if (updated) {
      setEvent(updated);
      showToast('Party started — guest QRs are now active!');
    }
  }
  function handleDeleteParty() {
    if (over && !event.archived) return; // a finished party must be archived first
    setConfirmState({
      title: 'Delete this party permanently?',
      message: 'This removes all RSVPs, expenses and photos. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        setConfirmState(null);
        deleteEvent(event.id);
        navigate('/');
      },
    });
  }
  function handleArchiveParty() {
    if (!over) return; // archive only after it's done
    setConfirmState({
      title: 'Archive this party?',
      message: 'It stays in your records but is hidden from discovery.',
      confirmLabel: 'Archive',
      onConfirm: () => {
        setConfirmState(null);
        archiveEvent(event.id);
        showToast('Party archived.');
        navigate('/');
      },
    });
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
              {Number(editEvent.cover_charge) > 0 && (
                <div className="dashboard-edit-field">
                  <label className="dashboard-edit-label">Payment window (hours)</label>
                  <input className="dashboard-add-expense__input" type="number" min="1" value={editEvent.payment_deadline_hours} onChange={e => setEditEvent(p => ({...p, payment_deadline_hours: e.target.value}))} placeholder="12" />
                  <small className="dashboard-cohosts__hint">Unpaid RSVPs auto-expire after this — the freed spot goes to the next waitlisted guest, who then gets 1 hour to pay.</small>
                </div>
              )}
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
                    payment_deadline_hours: Number(editEvent.payment_deadline_hours) || 12,
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
          {!over && (
            <button
              className="dashboard-header__edit-btn"
              type="button"
              onClick={openEditParty}
              title="Edit party details"
            >
              Edit Party
            </button>
          )}
        </div>
        <span className={`dashboard-header__badge dashboard-header__badge--${over ? 'over' : started ? 'live' : 'soon'}`}>
          <span className="dashboard-header__badge-dot" />
          {over ? 'WRAPPED' : started ? 'LIVE' : 'NOT STARTED'}
        </span>
        <p className="dashboard-header__subtitle">
          {formatDate(event.date)} · {formatTime(event.time_start)} – {formatTime(event.time_end)}
        </p>

        {/* Start party — activates guest entry QRs */}
        {!started && !over && (
          <div className="dashboard-start-row">
            <Btn variant="lime" onClick={handleStartParty}>▶ Start Party</Btn>
            <span className="dashboard-start-hint">Guest entry QRs stay locked until you start.</span>
          </div>
        )}
      </header>

      {/* ========== TAB BAR ========== */}
      <nav className="dashboard-tabs">
        <div className="tab-bar">
          {(isManager ? [...TABS, { key: 'approvals', label: 'Approvals' }] : TABS).map(tab => (
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
                  <CountdownTimer targetDate={event.date} targetTime={event.time_start} isOver={over} />
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
                      {safeUrl(event.dj_profile_url) && (
                        <a href={safeUrl(event.dj_profile_url)} target="_blank" rel="noreferrer">Profile</a>
                      )}
                      {safeUrl(event.dj_instagram) && (
                        <a href={safeUrl(event.dj_instagram)} target="_blank" rel="noreferrer">Instagram</a>
                      )}
                    </div>
                  </div>
                )}
              </Card>

              {/* Venue map + directions (OpenStreetMap) */}
              {(event.location_name || event.location_address) && (
                <div style={{ marginTop: 'var(--space-lg)' }}>
                  <MapPreview
                    lat={event.location_lat}
                    lng={event.location_lng}
                    name={event.location_name}
                    address={event.location_address}
                    compact
                  />
                </div>
              )}

              {/* Live vibe wall (optional) */}
              {event.vibe_wall_enabled !== false && (
                <div style={{ marginTop: 'var(--space-lg)' }}>
                  <h3 className="dashboard-section-subtitle" style={{ marginBottom: 'var(--space-sm)' }}>Vibe Wall</h3>
                  <Card>
                    <VibeWall
                      eventId={event.id}
                      authorName={currentUser ? currentUser.name : event.host_name}
                      authorId={currentUser ? currentUser.id : null}
                      hostId={event.host_id}
                      closesAt={event.vibe_wall_closes_at}
                    />
                  </Card>
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

              {/* Post-party recap */}
              {isPast && (
                <>
                  <p className="dashboard-section-title">Party Recap</p>
                  <Card className="dashboard-guest-list__card" style={{ marginBottom: 'var(--space-lg)' }}>
                    <div className="dashboard-recap">
                      <div className="dashboard-recap__stat"><b>{goingRsvps.length}</b><span>showed up</span></div>
                      <div className="dashboard-recap__stat"><b>{photos.length}</b><span>photos</span></div>
                      <div className="dashboard-recap__stat"><b>{checkedInCount}</b><span>checked in</span></div>
                      <div className="dashboard-recap__stat"><b>{formatINR(totalExpenses)}</b><span>spent</span></div>
                    </div>
                    {photos.length > 0 && (
                      <div className="dashboard-recap__strip">
                        {photos.slice(0, 6).map(p => (
                          <img key={p.id} src={safeImageSrc(p.photo_url)} alt={p.caption || 'party'} />
                        ))}
                      </div>
                    )}
                    <p className="dashboard-recap__caption">That's a wrap — relive the night</p>
                  </Card>
                </>
              )}

              {/* Co-hosts */}
              <p className="dashboard-section-title">Co-hosts</p>
              <Card className="dashboard-guest-list__card" style={{ marginBottom: 'var(--space-lg)' }}>
                <div className="dashboard-cohosts">
                  {coHosts.length > 0 && (
                    <div className="dashboard-cohosts__list">
                      {coHosts.map(c => {
                        const key = coHostKey(c);
                        const label = coHostLabel(c);
                        return (
                          <span key={key} className="dashboard-cohost-chip">
                            {c.id ? (
                              <button
                                type="button"
                                className="dashboard-cohost-chip__name"
                                title={`View ${label}'s profile`}
                                onClick={() => openPeek(c.id, c.name || label)}
                              >
                                {label}
                              </button>
                            ) : (
                              label
                            )}
                            <button type="button" onClick={() => removeCoHost(key)} aria-label={`Remove ${label}`}>×</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  <div className="dashboard-cohosts__add">
                    <input
                      className="dashboard-add-expense__input"
                      type="email"
                      placeholder="Add a co-host by email…"
                      value={coHostInput}
                      onChange={e => setCoHostInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCoHost(); } }}
                    />
                    <Btn variant="purple" onClick={addCoHost}>Add</Btn>
                  </div>
                  <small className="dashboard-cohosts__hint">Added by email — with a LowKey account their username shows, and everyone at the party can view their profile.</small>
                </div>
              </Card>

              {/* Broadcast announcements */}
              <p className="dashboard-section-title">Announcements</p>
              <Card className="dashboard-guest-list__card" style={{ marginBottom: 'var(--space-lg)' }}>
                <AnnouncementsPanel eventId={event.id} canPost authorName={event.host_name} />
              </Card>

              {/* Guest List */}
              <div className="dashboard-guestlist-head">
                <p className="dashboard-section-title" style={{ margin: 0 }}>Guest List</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  {isManager && (
                    <button type="button" className="dashboard-scan-btn" onClick={() => setShowScanner(true)}>
                      Scan Entry QR
                    </button>
                  )}
                  <span className="dashboard-checkin-count">{checkedInCount}/{goingRsvps.length} arrived</span>
                </div>
              </div>
              {waitlistRsvps.length > 0 && (
                <p className="dashboard-waitlist-note">{waitlistRsvps.length} on the waitlist — removing a guest auto-promotes the next.</p>
              )}
              <Card className="dashboard-guest-list__card">
                <div className="dashboard-guest-list">
                  {rsvps.map(rsvp => {
                    const isEditing = rsvp.id === editingGuestId;
                    return (
                      <div className={`dashboard-guest-row ${isEditing ? 'editing' : ''}`} key={rsvp.id}>
                        <button
                          type="button"
                          className="dashboard-guest-row__avatar"
                          style={{ background: getAvatarGradient(rsvp.guest_name) }}
                          onClick={() => openPeek(rsvp.user_id, rsvp.guest_name)}
                          disabled={!rsvp.user_id}
                          title={rsvp.user_id ? `View ${rsvp.guest_name}'s profile` : undefined}
                          aria-label={rsvp.user_id ? `View ${rsvp.guest_name}'s profile` : rsvp.guest_name}
                        >
                          {getInitials(rsvp.guest_name)}
                        </button>
                        
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
                                {rsvp.plus_one_requested && (
                                  <span
                                    className="dashboard-poll-badge"
                                    title={`+1: ${rsvp.plus_one_name || 'guest'}`}
                                  >
                                    +1 {rsvp.plus_one_approved === true ? '✓' : rsvp.plus_one_approved === false ? '✗' : '⏳'}
                                  </span>
                                )}
                              </div>
                              {rsvp.plus_one_requested && rsvp.plus_one_approved === null && (
                                <div className="dashboard-plusone-actions">
                                  <span className="dashboard-plusone-label">+1 {rsvp.plus_one_name || ''}?</span>
                                  <button type="button" className="dashboard-plusone-btn dashboard-plusone-btn--yes" onClick={() => handlePlusOneDecision(rsvp.id, true)}>Approve</button>
                                  <button type="button" className="dashboard-plusone-btn" onClick={() => handlePlusOneDecision(rsvp.id, false)}>Deny</button>
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                              {rsvp.status === 'going' && (
                                <button
                                  className={`dashboard-checkin-btn ${rsvp.checked_in ? 'is-in' : ''}`}
                                  type="button"
                                  title={rsvp.checked_in ? 'Checked in — tap to undo' : 'Check in at the door'}
                                  onClick={() => handleToggleCheckIn(rsvp)}
                                >
                                  {rsvp.checked_in ? '✅ In' : 'Check in'}
                                </button>
                              )}
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

              {/* Manage party — delete before it's over, archive after */}
              <p className="dashboard-section-title" style={{ marginTop: 'var(--space-xl)' }}>Manage Party</p>
              <Card className="dashboard-guest-list__card">
                <div className="dashboard-manage">
                  {event.archived ? (
                    <>
                      <p className="dashboard-manage__note">This party is archived. You can delete it permanently to clear it from your records — this also removes its RSVPs, expenses and photos.</p>
                      <button type="button" className="dashboard-manage__btn dashboard-manage__btn--delete" onClick={handleDeleteParty}>
                        🗑 Delete party
                      </button>
                    </>
                  ) : over ? (
                    <>
                      <p className="dashboard-manage__note">This party is over. You can archive it to tidy up your list — it stays in your records.</p>
                      <button type="button" className="dashboard-manage__btn dashboard-manage__btn--archive" onClick={handleArchiveParty}>
                        🗄️ Archive party
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="dashboard-manage__note">Cancelled the plan? You can delete this party while it's still upcoming. Once it's over you'll archive it instead.</p>
                      <button type="button" className="dashboard-manage__btn dashboard-manage__btn--delete" onClick={handleDeleteParty}>
                        🗑 Delete party
                      </button>
                    </>
                  )}
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

                    {/* Split type + receipt */}
                    <div className="dashboard-split-controls">
                      <div className="dashboard-split-toggle">
                        <button
                          type="button"
                          className={expenseSplitType === 'equal' ? 'active' : ''}
                          onClick={() => setExpenseSplitType('equal')}
                        >
                          Split equally
                        </button>
                        <button
                          type="button"
                          className={expenseSplitType === 'custom' ? 'active' : ''}
                          onClick={() => {
                            const amt = Number(expenseAmount) || 0;
                            const per = Math.round(amt / (goingRsvps.length || 1));
                            const shares = {};
                            goingRsvps.forEach(r => { shares[r.id] = per; });
                            setExpenseShares(shares);
                            setExpenseSplitType('custom');
                          }}
                        >
                          Custom split
                        </button>
                      </div>

                      {expenseSplitType === 'custom' && (
                        goingRsvps.length === 0 ? (
                          <p className="dashboard-custom-split__empty">No going guests to split between yet.</p>
                        ) : (
                          <div className="dashboard-custom-split">
                            {goingRsvps.map(r => (
                              <div className="dashboard-custom-split__row" key={r.id}>
                                <span className="dashboard-custom-split__name">{r.guest_name}</span>
                                <div className="dashboard-custom-split__amt">
                                  <span>₹</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={expenseShares[r.id] ?? ''}
                                    onChange={e => setExpenseShares(s => ({ ...s, [r.id]: e.target.value }))}
                                  />
                                </div>
                              </div>
                            ))}
                            <div
                              className="dashboard-custom-split__total"
                              style={{ color: customSplitSum === (Number(expenseAmount) || 0) ? 'var(--neon-lime)' : 'var(--neon-pink)' }}
                            >
                              Assigned ₹{customSplitSum} / ₹{Number(expenseAmount) || 0}
                            </div>
                          </div>
                        )
                      )}

                      <button type="button" className="dashboard-receipt-btn" onClick={() => receiptInputRef.current?.click()}>
                        {expenseReceipt ? '🧾 Receipt attached ✓' : '🧾 Attach receipt (optional)'}
                      </button>
                      <input ref={receiptInputRef} type="file" accept="image/*" hidden onChange={handleReceiptUpload} />
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
                    Pay Split Share
                  </Btn>
                </div>
              </div>

              {/* Settlement tracker — who's paid their share */}
              {goingRsvps.length > 0 && (
                <div className="dashboard-settle">
                  <div className="dashboard-settle__head">
                    <h4 className="dashboard-settle__title">Settlements</h4>
                    <span className="dashboard-settle__count">
                      {goingRsvps.filter(r => r.settled).length}/{goingRsvps.length} paid
                    </span>
                  </div>
                  <div className="dashboard-settle__bar">
                    <div
                      className="dashboard-settle__bar-fill"
                      style={{ width: `${Math.round((goingRsvps.filter(r => r.settled).length / goingRsvps.length) * 100)}%` }}
                    />
                  </div>
                  <ul className="dashboard-settle__list">
                    {goingRsvps.map(r => {
                      const owed = splitAmount * (r.guest_count || 1);
                      return (
                        <li key={r.id} className={`dashboard-settle__row ${r.settled ? 'is-paid' : ''}`}>
                          <span className="dashboard-settle__name">{r.guest_name}</span>
                          <span className="dashboard-settle__amt">{formatINR(owed)}</span>
                          <button
                            type="button"
                            className={`dashboard-settle__toggle ${r.settled ? 'is-paid' : ''}`}
                            onClick={() => handleToggleSettled(r)}
                            aria-pressed={!!r.settled}
                          >
                            {r.settled ? '✓ Paid' : 'Mark paid'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---- TAB 3: CAMERA ROLL 📸 ---- */}
        {activeTab === 'camera' && (
          <div className="dashboard-tab-panel" key="camera">
            <div className="dashboard-panel-col">
              {/* External Link Overlay */}
              {safeUrl(event?.external_photo_link) ? (
                <div className="dashboard-external-photo-link" style={{ textAlign: 'center', padding: 'var(--space-2xl)', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '48px', marginBottom: 'var(--space-md)' }}>📸</div>
                  <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 'var(--space-sm)' }}>External Photo Dump</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)' }}>Photos for this party are hosted externally. Upload and view them there!</p>
                  <a href={safeUrl(event.external_photo_link)} target="_blank" rel="noreferrer" style={{ display: 'inline-block', padding: '12px 24px', background: 'var(--gradient-primary)', color: '#fff', borderRadius: 'var(--radius-md)', textDecoration: 'none', fontWeight: 'bold' }}>Open Photo Folder ↗</a>
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
                        Keep vibing, stop scrolling
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
                  timeRemaining={getPhotoDumpTimeRemaining(event)}
                />
              ) : (
                /* Placeholder photo cards */
                !event?.external_photo_link && (
                  <div className="dashboard-photo-placeholder-grid">
                    {(photos.length > 0 ? photos : PLACEHOLDER_PHOTOS).map(photo => (
                      <div className="dashboard-photo-placeholder" key={photo.id}>
                        <div className="dashboard-photo-placeholder__img">
                          {safeImageSrc(photo.photo_url) ? (
                            <img
                              src={safeImageSrc(photo.photo_url)}
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

        {/* ---- TAB 5: PAYMENT APPROVALS (host/co-host only) ---- */}
        {activeTab === 'approvals' && isManager && (
          <div className="dashboard-tab-panel" key="approvals">
            <div className="dashboard-approvals">
              <div className="dashboard-approval-tabs">
                {['pending', 'approved', 'declined'].map(tab => (
                  <button
                    key={tab}
                    type="button"
                    className={`dashboard-approval-tab${approvalSubTab === tab ? ' is-active' : ''}`}
                    onClick={() => setApprovalSubTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    <span className="dashboard-approval-tab__count">{approvalCounts[tab]}</span>
                  </button>
                ))}
              </div>

              <input
                className="dashboard-approval-search"
                type="search"
                value={approvalSearch}
                onChange={e => setApprovalSearch(e.target.value)}
                placeholder="Search by phone number, name, or UTR…"
                aria-label="Search payments"
              />

              {approvalRows.length === 0 ? (
                <p className="dashboard-approval-empty">
                  {approvalSearch.trim() ? `No ${approvalSubTab} payments match "${approvalSearch.trim()}".` : `No ${approvalSubTab} payments.`}
                </p>
              ) : (
                <div className="dashboard-approval-list">
                  {approvalRows.map(p => (
                    <div className="dashboard-approval-row" key={p.id}>
                      <div className="dashboard-approval-row__info">
                        <span className="dashboard-approval-row__name">{p.paid_by || 'Guest'}</span>
                        <span className="dashboard-approval-row__amount">{formatINR(p.amount || 0)}</span>
                        {p.phone && <span className="dashboard-approval-row__meta">Phone: {p.phone}</span>}
                        <span className="dashboard-approval-row__meta">UTR: {p.transaction_id}</span>
                      </div>
                      <div className="dashboard-approval-row__actions">
                        {approvalSubTab !== 'approved' && (
                          <button type="button" className="dashboard-approval-btn dashboard-approval-btn--approve" onClick={() => decidePayment(p.id, 'approved')}>
                            Approve
                          </button>
                        )}
                        {approvalSubTab !== 'declined' && (
                          <button type="button" className="dashboard-approval-btn dashboard-approval-btn--decline" onClick={() => decidePayment(p.id, 'declined')}>
                            Decline
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========== TOAST ========== */}
      {toast && <div className="dashboard-toast">{toast}</div>}

      {/* ========== In-app confirmation (replaces window.confirm) ========== */}
      <ConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        danger={!!confirmState?.danger}
        onConfirm={confirmState?.onConfirm}
        onCancel={() => setConfirmState(null)}
      />

      {/* ========== Party-member profile peek ========== */}
      <ProfilePeek open={!!peek} person={peek} onClose={() => setPeek(null)} />

      {/* ========== Door scanner (host/co-host only) ========== */}
      {isManager && (
        <QRScanner open={showScanner} onDecode={handleScanDecode} onClose={() => setShowScanner(false)} />
      )}

      {/* ========== Payment Checkout Modal ========== */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        amount={splitAmount}
        upiId={event.upi_id || 'lowkey@okaxis'}
        payeeName={event.host_name || 'LowKey Host'}
        note={`Split Settlement: ${event.name}`}
        defaultPhone={currentUser?.phone || ''}
        onPaymentSubmitted={handlePaymentSubmitted}
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
