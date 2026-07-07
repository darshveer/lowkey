import { useState } from 'react';
import { getAnnouncements, addAnnouncement } from '../utils/storage';
import { useToast } from '../hooks/useToast';
import './AnnouncementsPanel.css';

function timeAgo(iso) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * AnnouncementsPanel — host broadcasts that notify all going guests.
 * @param {boolean} props.canPost - show the composer (host only)
 */
export default function AnnouncementsPanel({ eventId, canPost = false, authorName }) {
  const [items, setItems] = useState(() => getAnnouncements(eventId));
  const [text, setText] = useState('');
  const { show } = useToast();

  const post = (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    addAnnouncement({ event_id: eventId, body, author_name: authorName });
    setItems(getAnnouncements(eventId));
    setText('');
    show('Announcement sent to all guests', 'success');
  };

  // For guests with nothing to show, render nothing.
  if (!canPost && items.length === 0) return null;

  return (
    <div className="announce">
      {canPost && (
        <form className="announce__form" onSubmit={post}>
          <input
            className="announce__input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Broadcast an update to all going guests…"
            maxLength={240}
            aria-label="Write an announcement"
          />
          <button className="announce__send" type="submit" disabled={!text.trim()}>Send</button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="announce__empty">No announcements yet.</p>
      ) : (
        <ul className="announce__list">
          {items.map((a) => (
            <li key={a.id} className="announce__item">
              <span className="announce__icon" aria-hidden="true">📣</span>
              <div className="announce__body">
                <p className="announce__text">{a.body}</p>
                <span className="announce__time">{a.author_name || 'Host'} · {timeAgo(a.created_at)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
