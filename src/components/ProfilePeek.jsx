import { useEffect } from 'react';
import { getInitials, getAvatarGradient, safeImageSrc } from '../utils/helpers';
import './ProfilePeek.css';

/**
 * ProfilePeek — small profile card modal so people at a party can view each
 * other (host, co-hosts, guests with accounts). Shows only synced public
 * profile fields; never the email.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Object|null} props.person - { id?, name, username?, profile_pic_b64?, achievements? }
 * @param {() => void} props.onClose
 */
export default function ProfilePeek({ open, person, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !person) return null;

  const name = person.name || 'Guest';
  const badgeCount = Array.isArray(person.achievements) ? person.achievements.length : 0;

  return (
    <div className="peek-overlay" role="dialog" aria-modal="true" aria-label={`Profile of ${name}`}>
      <div className="peek-backdrop" onClick={onClose} />
      <div className="peek-card animate-scale-in">
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
