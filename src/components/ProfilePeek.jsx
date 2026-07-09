import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getInitials, getAvatarGradient, safeImageSrc } from '../utils/helpers';
import './ProfilePeek.css';

// Track the last pointer-down position (capture phase, so it's recorded before the
// click handler that opens the peek runs). Lets the card anchor to wherever the
// profile was clicked — no need to thread coordinates through every call site.
let lastPointer = null;
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => { lastPointer = { x: e.clientX, y: e.clientY }; },
    true
  );
}

/**
 * ProfilePeek — small profile card popover so people at a party can view each
 * other (host, co-hosts, guests with accounts). Shows only synced public
 * profile fields; never the email. Anchors next to wherever it was opened.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Object|null} props.person - { id?, name, username?, profile_pic_b64?, achievements? }
 * @param {() => void} props.onClose
 */
export default function ProfilePeek({ open, person, onClose }) {
  const cardRef = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Position the card beside the click point, clamped to stay on-screen.
  useLayoutEffect(() => {
    if (!open) return;
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const m = 12;
    const anchor = lastPointer || { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    let left = anchor.x + m;
    if (left + rect.width + m > window.innerWidth) left = anchor.x - rect.width - m; // flip left
    left = Math.max(m, Math.min(left, window.innerWidth - rect.width - m));

    let top = anchor.y + m;
    top = Math.max(m, Math.min(top, window.innerHeight - rect.height - m));

    setPos({ left, top });
  }, [open, person]);

  if (!open || !person) return null;

  const name = person.name || 'Guest';
  const badgeCount = Array.isArray(person.achievements) ? person.achievements.length : 0;

  return (
    <div className="peek-overlay" role="dialog" aria-modal="true" aria-label={`Profile of ${name}`}>
      <div className="peek-backdrop" onClick={onClose} />
      <div
        ref={cardRef}
        className="peek-card peek-card--anchored animate-scale-in"
        style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden' }}
      >
        <button className="peek-card__close" onClick={onClose} aria-label="Close" type="button">×</button>
        {safeImageSrc(person.profile_pic_b64, { allowRemote: false }) ? (
          <img className="peek-card__pic" src={safeImageSrc(person.profile_pic_b64, { allowRemote: false })} alt={name} />
        ) : (
          <div className="peek-card__avatar" style={{ background: getAvatarGradient(name) }}>
            {getInitials(name)}
          </div>
        )}
        <h3 className="peek-card__name">{name}</h3>
        {person.username && <p className="peek-card__username">@{person.username}</p>}
        <p className="peek-card__meta">
          {badgeCount > 0 ? `${badgeCount} badge${badgeCount > 1 ? 's' : ''} earned` : 'No badges yet'}
        </p>
      </div>
    </div>
  );
}
