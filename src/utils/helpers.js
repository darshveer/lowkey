import { nanoid } from 'nanoid';

/**
 * Generate a short unique ID (10 chars, URL-safe)
 * @returns {string}
 */
export function generateId() {
  return nanoid(10);
}

/**
 * Format a date string to a human-friendly display
 * @param {string} dateStr - ISO date string or YYYY-MM-DD
 * @returns {string} e.g. "Sat, 14 Jun"
 */
export function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format a date to long format
 * @param {string} dateStr
 * @returns {string} e.g. "Saturday, 14 June 2025"
 */
export function formatDateLong(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format time string (HH:mm) to 12-hour
 * @param {string} time - "HH:mm" format
 * @returns {string} e.g. "8:00 PM"
 */
export function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, '0')} ${ampm}`;
}

/**
 * Get countdown to a date+time
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} timeStr - HH:mm
 * @returns {{ days: number, hours: number, minutes: number, seconds: number, isPast: boolean }}
 */
export function getCountdown(dateStr, timeStr) {
  const target = new Date(`${dateStr}T${timeStr}:00`);
  const now = new Date();
  const diff = target - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true };
  }

  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    isPast: false,
  };
}

/**
 * Check if party is in "active mode" (2 hours before start)
 * @param {string} dateStr
 * @param {string} timeStr
 * @returns {boolean}
 */
export function isPartyActive(dateStr, timeStr) {
  const target = new Date(`${dateStr}T${timeStr}:00`);
  const now = new Date();
  const twoHoursBefore = new Date(target.getTime() - 2 * 60 * 60 * 1000);
  return now >= twoHoursBefore;
}

/**
 * Check if photo dump should be unlocked (after 2 AM)
 * @param {string} dateStr - Party date
 * @returns {boolean}
 */
export function isPhotoDumpUnlocked(dateStr) {
  const now = new Date();
  const partyDate = new Date(dateStr);
  const unlockTime = new Date(partyDate);
  unlockTime.setDate(unlockTime.getDate() + 1);
  unlockTime.setHours(2, 0, 0, 0);
  return now >= unlockTime;
}

/**
 * Countdown label for how long the shared photo dump stays open.
 * The album lives for 3 days after the party ends.
 * @param {Object} event - Event with date / time_end / time_end_next_day
 * @returns {string|null} e.g. "2d 5h", "expired", or null if no date
 */
export function getPhotoDumpTimeRemaining(event) {
  if (!event?.date) return null;
  const eventEndDate = new Date(event.date);
  if (event.time_end) {
    const [h, m] = event.time_end.split(':').map(Number);
    eventEndDate.setHours(h, m, 0, 0);
    if (event.time_end_next_day) eventEndDate.setDate(eventEndDate.getDate() + 1);
  } else {
    eventEndDate.setDate(eventEndDate.getDate() + 1);
  }
  const diffMs = (eventEndDate.getTime() + 3 * 24 * 60 * 60 * 1000) - new Date().getTime();
  if (diffMs <= 0) return 'expired';
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return `${days}d ${hours}h`;
}

/**
 * Generate Google Maps directions URL
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
export function getDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

/**
 * Generate Google Maps search URL
 * @param {number} lat
 * @param {number} lng
 * @returns {string}
 */
export function getMapsUrl(lat, lng) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/**
 * Share via Web Share API or fallback
 * @param {Object} data - { title, text, url }
 */
export async function shareLink(data) {
  if (navigator.share) {
    try {
      await navigator.share(data);
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
    }
  }
  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(data.url || data.text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Share to WhatsApp directly
 * @param {string} text
 * @param {string} url
 */
export function shareToWhatsApp(text, url) {
  const message = encodeURIComponent(`${text}\n${url}`);
  window.open(`https://wa.me/?text=${message}`, '_blank');
}

/**
 * Get initials from a name (for avatar)
 * @param {string} name
 * @returns {string} Up to 2 characters
 */
export function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Get a deterministic color for a name (for avatar backgrounds)
 * @param {string} name
 * @returns {string} CSS gradient
 */
export function getAvatarGradient(name) {
  const gradients = [
    'linear-gradient(135deg, #4D7CFF, #8B5CF6)',
    'linear-gradient(135deg, #8B5CF6, #FF007F)',
    'linear-gradient(135deg, #FF007F, #FF6B6B)',
    'linear-gradient(135deg, #CCFF00, #00D4FF)',
    'linear-gradient(135deg, #00D4FF, #4D7CFF)',
    'linear-gradient(135deg, #FF6B6B, #CCFF00)',
    'linear-gradient(135deg, #E6E6FA, #8B5CF6)',
    'linear-gradient(135deg, #FF007F, #8B5CF6)',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

/**
 * Format currency in INR
 * @param {number} amount
 * @returns {string} e.g. "₹1,234"
 */
export function formatINR(amount) {
  return '₹' + amount.toLocaleString('en-IN');
}

/** Strip everything but digits (for phone-number inputs). */
export function digitsOnly(value) {
  return (value || '').replace(/\D/g, '');
}

/** True when the value is exactly 10 digits — an Indian mobile number, no country code. */
export function isTenDigitPhone(value) {
  return /^\d{10}$/.test(digitsOnly(value));
}

/**
 * Resolve a party's end Date from its date + time fields.
 * @param {Object} event
 * @returns {Date|null}
 */
export function getEventEnd(event) {
  if (!event?.date) return null;
  const start = new Date(`${event.date}T${event.time_start || '19:00'}:00`);
  let end;
  if (event.time_end) {
    end = new Date(`${event.date}T${event.time_end}:00`);
    if (event.time_end_next_day || end <= start) end.setDate(end.getDate() + 1);
  } else {
    end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  }
  return end;
}

/**
 * Whether a party is over (its end time has passed).
 * @param {Object} event
 * @returns {boolean}
 */
export function isEventOver(event) {
  const end = getEventEnd(event);
  return end ? new Date() > end : false;
}

/**
 * An ISO timestamp `hours` from now — used for payment approval windows.
 * @param {number} hours
 * @returns {string}
 */
export function computePaymentDeadline(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

/**
 * Whether now is within 1 day of a party's start time.
 * @param {Object} event
 * @returns {boolean}
 */
export function isWithinOneDayOfParty(event) {
  if (!event?.date) return false;
  const start = new Date(`${event.date}T${event.time_start || '19:00'}:00`);
  return start - new Date() <= 24 * 60 * 60 * 1000;
}

/**
 * Entry-QR gating for a guest's ticket. It's only generated (and scannable)
 * once any cover charge has been host-approved AND the party is within 1 day
 * — before that it stays locked, with a reason so the UI can explain why.
 * @param {Object} event
 * @param {Object} rsvp
 * @returns {{ unlocked: boolean, reason: 'payment'|'time'|null }}
 */
export function getEntryQrState(event, rsvp) {
  if (!event || !rsvp || rsvp.status !== 'going') return { unlocked: false, reason: 'payment' };
  const needsPayment = Number(event.cover_charge) > 0;
  const paid = !needsPayment || rsvp.cover_paid === true;
  if (!paid) return { unlocked: false, reason: 'payment' };
  if (!isWithinOneDayOfParty(event)) return { unlocked: false, reason: 'time' };
  return { unlocked: true, reason: null };
}

/**
 * Whether a user manages a party — the host, or listed as a co-host by id.
 * @param {Object} event
 * @param {string} userId
 * @returns {boolean}
 */
export function isPartyManager(event, userId) {
  if (!event || !userId) return false;
  if (event.host_id === userId) return true;
  return (event.co_hosts || []).some((c) => typeof c === 'object' && c.id === userId);
}

/**
 * Sanitize a user-supplied URL for use in href/src. Only http(s) links are
 * allowed — this blocks `javascript:`, `data:`, `vbscript:` etc. which would
 * otherwise enable stored XSS via host-controlled fields (DJ links, playlists…).
 * @param {string} url
 * @returns {string|undefined} the URL if safe, else undefined (renders no link)
 */
export function safeUrl(url) {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return undefined;
}

/**
 * Sanitize a user-supplied image source for use in `<img src>`.
 *
 * Default (allowRemote = true): permits http(s) URLs and inline
 * `data:image/...` payloads — for the photo dump, whose URLs are hosted on
 * Supabase Storage with a base64 fallback.
 *
 * allowRemote = false: permits ONLY `data:image/...`. Used for profile
 * pictures, which this app always produces as base64 data URLs — so a hosted
 * URL there could only be a malicious value set to beacon the viewer's IP
 * when their profile is displayed. Restricting to data: closes that.
 *
 * Either way this blocks `data:text/html`, `javascript:`, and other schemes.
 * @param {string} src
 * @param {{ allowRemote?: boolean }} [opts]
 * @returns {string|undefined} the src if safe, else undefined
 */
export function safeImageSrc(src, { allowRemote = true } = {}) {
  if (!src || typeof src !== 'string') return undefined;
  const trimmed = src.trim();
  if (/^data:image\//i.test(trimmed)) return trimmed;
  if (allowRemote && /^https?:\/\//i.test(trimmed)) return trimmed;
  return undefined;
}
