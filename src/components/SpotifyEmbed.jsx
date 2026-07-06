import { safeUrl } from '../utils/helpers';
import './SpotifyEmbed.css';

/**
 * SpotifyEmbed — Spotify playlist embed or compact styled link
 *
 * @param {Object} props
 * @param {string} props.playlistUrl - Full Spotify playlist URL
 * @param {boolean} [props.compact=false] - Show as compact link button instead of iframe
 */
export default function SpotifyEmbed({ playlistUrl, compact = false }) {
  /**
   * Extract playlist ID from URL
   * Handles: https://open.spotify.com/playlist/PLAYLIST_ID?si=...
   */
  const extractPlaylistId = (url) => {
    if (!url) return null;
    const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  };

  const playlistId = extractPlaylistId(playlistUrl);

  if (!playlistId) {
    return null;
  }

  const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`;

  if (compact) {
    return (
      <div className="spotify-embed">
        <a
          className="spotify-embed__link"
          href={safeUrl(playlistUrl) || `https://open.spotify.com/playlist/${playlistId}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="spotify-embed__icon" aria-hidden="true">🎵</span>
          Party Playlist
        </a>
      </div>
    );
  }

  return (
    <div className="spotify-embed">
      <div className="spotify-embed__iframe-wrap">
        <iframe
          className="spotify-embed__iframe"
          src={embedUrl}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          title="Spotify Playlist"
        />
      </div>
    </div>
  );
}
