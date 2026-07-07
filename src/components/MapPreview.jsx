import { getOSMEmbedUrl, getGoogleDirectionsUrl, getOSMMarkerUrl } from '../utils/geo';
import './MapPreview.css';

/**
 * MapPreview — OpenStreetMap embed with a marker plus a directions CTA.
 * Gracefully degrades to an address-search link when no coordinates exist.
 *
 * @param {Object} props
 * @param {number} [props.lat]
 * @param {number} [props.lng]
 * @param {string} [props.name] - Venue label (e.g. "Arjun's Terrace")
 * @param {string} [props.address] - Full address (used for the no-coords fallback)
 * @param {boolean} [props.compact] - Shorter map height
 */
export default function MapPreview({ lat, lng, name, address, compact = false }) {
  const hasCoords = isFinite(lat) && isFinite(lng);
  const embedUrl = getOSMEmbedUrl({ lat, lng });
  const directionsUrl = getGoogleDirectionsUrl({ lat, lng, address });
  const markerUrl = getOSMMarkerUrl({ lat, lng });

  return (
    <div className={`map-preview ${compact ? 'map-preview--compact' : ''}`}>
      {hasCoords && embedUrl ? (
        <div className="map-preview__frame">
          <iframe
            title={`Map of ${name || 'the venue'}`}
            className="map-preview__iframe"
            src={embedUrl}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      ) : (
        <div className="map-preview__placeholder">
          <span className="map-preview__placeholder-icon" aria-hidden="true">🗺️</span>
          <p className="map-preview__placeholder-text">
            {address || name || 'Location shared closer to the day.'}
          </p>
        </div>
      )}

      <div className="map-preview__meta">
        <div className="map-preview__label">
          {name && <span className="map-preview__name">{name}</span>}
          {address && <span className="map-preview__addr">{address}</span>}
        </div>
        <div className="map-preview__actions">
          <a
            className="map-preview__btn map-preview__btn--primary"
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
          >
            <span aria-hidden="true">🧭</span> Directions
          </a>
          {hasCoords && (
            <a
              className="map-preview__btn"
              href={markerUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open map
            </a>
          )}
        </div>
      </div>
      <p className="map-preview__attribution">© OpenStreetMap contributors</p>
    </div>
  );
}
