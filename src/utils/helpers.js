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
