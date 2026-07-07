import { useState, useEffect } from 'react';
import { getComments, addComment, deleteComment, removeLocalComment, subscribeToEvent } from '../utils/storage';
import { getInitials, getAvatarGradient } from '../utils/helpers';
import { useToast } from '../hooks/useToast';
import ConfirmDialog from './ConfirmDialog';
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

/** Friendly "closes in …" label from two millisecond timestamps. */
function closesInLabel(closeMs, nowMs) {
  const diff = closeMs - nowMs;
  if (diff <= 0) return null;
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `Wall closes in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Wall closes in ${hrs}h ${mins % 60}m`;
  return `Wall closes in ${Math.floor(hrs / 24)}d`;
}

/**
 * VibeWall — a live comment wall for a party. Guests drop hype, hosts see it
 * update in realtime. Persists via storage.addComment (localStorage + Supabase).
 *
 * @param {Object} props
 * @param {string} props.eventId
 * @param {string} [props.authorName]
 * @param {string} [props.authorId]
 * @param {string} [props.hostId] - the party host's id (may delete any post)
 * @param {string} [props.closesAt] - ISO time after which new posts are locked
 */
export default function VibeWall({ eventId, authorName, authorId, hostId, closesAt }) {
  const [comments, setComments] = useState(() => getComments(eventId));
  const [text, setText] = useState('');
  const [nowMs, setNowMs] = useState(0);
  const [pendingDelete, setPendingDelete] = useState(null);
  const { show } = useToast();

  // Only the host and a post's own author may delete it. Anonymous posts
  // (author_id null) are host-moderated only — matches the RLS policy.
  const isHost = !!authorId && !!hostId && authorId === hostId;
  const canDelete = (c) => isHost || (!!authorId && c.author_id === authorId);

  // Live updates from other guests
  useEffect(() => {
    if (!eventId) return;
    return subscribeToEvent(eventId, {
      onComment: (payload) => {
        if (payload.eventType === 'DELETE') {
          const deletedId = payload.old?.id;
          if (!deletedId) return;
          removeLocalComment(deletedId);
          setComments((prev) => prev.filter((c) => c.id !== deletedId));
          return;
        }
        const row = payload.new;
        if (!row) return;
        setComments((prev) => (prev.some((c) => c.id === row.id) ? prev : [row, ...prev]));
      },
    });
  }, [eventId]);

  // Tick the clock for the auto-close timer (deferred so no setState in effect body).
  useEffect(() => {
    if (!closesAt) return;
    let inner;
    const outer = setTimeout(function tick() {
      setNowMs(Date.now());
      inner = setTimeout(tick, 30000);
    }, 0);
    return () => { clearTimeout(outer); clearTimeout(inner); };
  }, [closesAt]);

  const closeMs = closesAt ? new Date(closesAt).getTime() : null;
  const closed = closeMs != null && nowMs > 0 && nowMs >= closeMs;
  const closesSoon = closeMs != null && nowMs > 0 && !closed ? closesInLabel(closeMs, nowMs) : null;

  const submit = (e) => {
    e.preventDefault();
    if (closed) return;
    const body = text.trim();
    if (!body) return;
    const name = (authorName || '').trim() || 'Anon';
    const created = addComment({ event_id: eventId, author_name: name, author_id: authorId || null, body });
    setComments((prev) => [created, ...prev]);
    setText('');
    show('Dropped on the wall', 'success');
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    deleteComment(pendingDelete.id);
    setComments((prev) => prev.filter((c) => c.id !== pendingDelete.id));
    setPendingDelete(null);
    show('Post removed', 'success');
  };

  return (
    <div className="vibe-wall">
      {closed ? (
        <div className="vibe-wall__closed">🔒 The vibe wall has closed for this party.</div>
      ) : (
        <>
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
          {closesSoon && <p className="vibe-wall__timer">⏳ {closesSoon}</p>}
        </>
      )}

      {comments.length === 0 ? (
        <p className="vibe-wall__empty">Be the first to set the vibe</p>
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
                  {canDelete(c) && (
                    <button
                      className="vibe-wall__delete"
                      type="button"
                      title="Delete post"
                      aria-label={`Delete post by ${c.author_name || 'Anon'}`}
                      onClick={() => setPendingDelete(c)}
                    >
                      🗑
                    </button>
                  )}
                </div>
                <p className="vibe-wall__body">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this post?"
        message={
          pendingDelete
            ? `"${String(pendingDelete.body || '').slice(0, 80)}" will be removed from the vibe wall for everyone.`
            : ''
        }
        confirmLabel="Delete"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
