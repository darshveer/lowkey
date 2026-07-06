import { useState, useEffect } from 'react';
import { getComments, addComment, subscribeToEvent } from '../utils/storage';
import { getInitials, getAvatarGradient } from '../utils/helpers';
import { useToast } from '../hooks/useToast';
import './VibeWall.css';

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

/**
 * VibeWall — a live comment wall for a party. Guests drop hype, hosts see it
 * update in realtime. Persists via storage.addComment (localStorage + Supabase).
 *
 * @param {Object} props
 * @param {string} props.eventId
 * @param {string} [props.authorName]
 * @param {string} [props.authorId]
 */
export default function VibeWall({ eventId, authorName, authorId }) {
  const [comments, setComments] = useState(() => getComments(eventId));
  const [text, setText] = useState('');
  const { show } = useToast();

  // Live updates from other guests
  useEffect(() => {
    if (!eventId) return;
    return subscribeToEvent(eventId, {
      onComment: (payload) => {
        const row = payload.new;
        if (!row || payload.eventType === 'DELETE') return;
        setComments((prev) => (prev.some((c) => c.id === row.id) ? prev : [row, ...prev]));
      },
    });
  }, [eventId]);

  const submit = (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const name = (authorName || '').trim() || 'Anon';
    const created = addComment({ event_id: eventId, author_name: name, author_id: authorId || null, body });
    setComments((prev) => [created, ...prev]);
    setText('');
    show('Dropped on the wall 🎉', 'success');
  };

  return (
    <div className="vibe-wall">
      <form className="vibe-wall__form" onSubmit={submit}>
        <input
          className="vibe-wall__input"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="drop some hype…"
          maxLength={180}
          aria-label="Add a comment to the vibe wall"
        />
        <button className="vibe-wall__send" type="submit" disabled={!text.trim()}>
          Post
        </button>
      </form>

      {comments.length === 0 ? (
        <p className="vibe-wall__empty">Be the first to set the vibe ✨</p>
      ) : (
        <ul className="vibe-wall__list">
          {comments.map((c) => (
            <li key={c.id} className="vibe-wall__item">
              <div
                className="vibe-wall__avatar"
                style={{ background: getAvatarGradient(c.author_name || 'Anon') }}
              >
                {getInitials(c.author_name || 'Anon')}
              </div>
              <div className="vibe-wall__bubble">
                <div className="vibe-wall__meta">
                  <span className="vibe-wall__name">{c.author_name || 'Anon'}</span>
                  <span className="vibe-wall__time">{timeAgo(c.created_at)}</span>
                </div>
                <p className="vibe-wall__body">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
