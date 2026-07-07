import { useState } from 'react';
import { getSongRequests, addSongRequest, voteSongRequest } from '../utils/storage';
import { useToast } from '../hooks/useToast';
import './SongRequestQueue.css';

/**
 * SongRequestQueue — guests request tracks and upvote each other's; the queue
 * is ordered by votes so the host knows what to play next.
 */
export default function SongRequestQueue({ eventId, requesterName }) {
  const [songs, setSongs] = useState(() => getSongRequests(eventId));
  const [title, setTitle] = useState('');
  const { show } = useToast();

  const add = (e) => {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    addSongRequest({ event_id: eventId, title: t, requested_by: requesterName || 'Guest' });
    setSongs(getSongRequests(eventId));
    setTitle('');
    show('Added to the queue', 'success');
  };

  const vote = (id) => {
    voteSongRequest(id);
    setSongs(getSongRequests(eventId));
  };

  return (
    <div className="song-queue">
      <form className="song-queue__form" onSubmit={add}>
        <input
          className="song-queue__input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="request a track…"
          maxLength={120}
          aria-label="Request a song"
        />
        <button className="song-queue__add" type="submit" disabled={!title.trim()}>Add</button>
      </form>

      {songs.length === 0 ? (
        <p className="song-queue__empty">No requests yet — kick off the queue</p>
      ) : (
        <ul className="song-queue__list">
          {songs.map((s, i) => (
            <li key={s.id} className="song-queue__item">
              <span className="song-queue__rank">{i + 1}</span>
              <div className="song-queue__meta">
                <span className="song-queue__title">{s.title}</span>
                <span className="song-queue__by">{s.requested_by}</span>
              </div>
              <button className="song-queue__vote" onClick={() => vote(s.id)} type="button" aria-label="Upvote">
                ▲ {s.votes || 0}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
