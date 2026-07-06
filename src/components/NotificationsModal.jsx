import { useEffect, useRef } from 'react';
import './NotificationsModal.css';

const TYPE_ICON = {
  rsvp: '🎉',
  payment: '💸',
  comment: '💬',
  photo: '📸',
  achievement: '🏆',
  reminder: '⏰',
};

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * NotificationsModal — full list popup for a user's notifications.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {() => void} props.onClose
 * @param {Array} props.notifications
 * @param {() => void} props.onMarkAllRead
 * @param {(link: string) => void} props.onOpen - navigate to a notification's link
 */
export default function NotificationsModal({ isOpen, onClose, notifications = [], onMarkAllRead, onOpen }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="notif-modal-overlay" role="dialog" aria-modal="true" aria-label="Notifications">
      <div className="notif-modal-backdrop" onClick={onClose} />
      <div className="notif-modal glass-strong animate-scale-in" ref={ref}>
        <div className="notif-modal__header">
          <h3 className="notif-modal__title">Notifications</h3>
          <div className="notif-modal__actions">
            {unread > 0 && (
              <button className="notif-modal__mark" onClick={onMarkAllRead} type="button">
                Mark all read
              </button>
            )}
            <button className="notif-modal__close" onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>

        <div className="notif-modal__list">
          {notifications.length === 0 ? (
            <div className="notif-modal__empty">
              <span className="notif-modal__empty-icon" aria-hidden="true">🔔</span>
              <p>No notifications yet.</p>
              <p className="notif-modal__empty-sub">RSVPs, payments and hype will show up here.</p>
            </div>
          ) : (
            notifications.map((n) => (
              <button
                key={n.id}
                className={`notif-row ${n.read ? '' : 'notif-row--unread'}`}
                onClick={() => (n.link ? onOpen?.(n.link) : undefined)}
                type="button"
              >
                <span className="notif-row__icon" aria-hidden="true">{TYPE_ICON[n.type] || '✦'}</span>
                <span className="notif-row__body">
                  <span className="notif-row__title">{n.title}</span>
                  <span className="notif-row__text">{n.body}</span>
                  <span className="notif-row__time">{timeAgo(n.created_at)}</span>
                </span>
                {!n.read && <span className="notif-row__dot" aria-label="unread" />}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
