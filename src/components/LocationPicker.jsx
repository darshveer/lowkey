import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { reverseGeocode } from '../utils/geo';
import './LocationPicker.css';

const DEFAULT = { lat: 12.9716, lng: 77.5946 }; // Bengaluru

/**
 * LocationPicker — an interactive OpenStreetMap (Leaflet) pin-drop.
 * The pin stays fixed at the map center; dragging the map moves the pin, and
 * the address under it is reverse-geocoded live. "Confirm pin" locks it in.
 *
 * @param {Object} props
 * @param {{ lat:number, lng:number }|null} props.target - fly the map here (e.g. a search result)
 * @param {(loc:{ lat:number, lng:number, address:string }) => void} props.onConfirm
 */
export default function LocationPicker({ target, onConfirm }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const abortRef = useRef(null);
  const geoTimer = useRef(null);

  const [address, setAddress] = useState('');
  const [center, setCenter] = useState(target || DEFAULT);
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Initialize the map once.
  useEffect(() => {
    const start = target || DEFAULT;
    const map = L.map(elRef.current, {
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false, // avoid hijacking page scroll; user can pinch/+/-
    }).setView([start.lat, start.lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map);
    mapRef.current = map;

    // Reverse-geocode the current center (debounced) whenever the map settles.
    const onSettle = () => {
      const c = map.getCenter();
      setCenter({ lat: c.lat, lng: c.lng });
      setConfirmed(false);
      clearTimeout(geoTimer.current);
      geoTimer.current = setTimeout(() => {
        if (abortRef.current) abortRef.current.abort();
        const ctrl = new AbortController();
        abortRef.current = ctrl;
        setLoading(true);
        reverseGeocode(c.lat, c.lng, { signal: ctrl.signal })
          .then((r) => { if (r) setAddress(r.label); })
          .catch(() => {})
          .finally(() => setLoading(false));
      }, 450);
    };
    map.on('moveend', onSettle);

    // Leaflet needs a size recalc inside animated/flex containers; also do the
    // initial reverse geocode off the effect body (never setState synchronously).
    const initTimer = setTimeout(() => {
      map.invalidateSize();
      onSettle();
    }, 250);

    return () => {
      clearTimeout(initTimer);
      clearTimeout(geoTimer.current);
      if (abortRef.current) abortRef.current.abort();
      map.off('moveend', onSettle);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to a new search target when it changes.
  useEffect(() => {
    if (target && mapRef.current) {
      mapRef.current.flyTo([target.lat, target.lng], 16, { duration: 0.8 });
    }
  }, [target]);

  const confirm = () => {
    setConfirmed(true);
    onConfirm({ lat: center.lat, lng: center.lng, address });
  };

  return (
    <div className="loc-picker">
      <div className="loc-picker__map" ref={elRef} />
      {/* Fixed center pin — its tip points at the map center */}
      <div className="loc-picker__pin" aria-hidden="true">📍</div>
      <div className="loc-picker__hint" aria-hidden="true">Drag the map to move the pin</div>

      <div className="loc-picker__bar">
        <div className="loc-picker__addr">
          <span className="loc-picker__addr-label">
            {loading ? 'Finding address…' : 'Pin location'}
          </span>
          <span className="loc-picker__addr-text">
            {address || 'Drag the map or search above'}
          </span>
        </div>
        <button
          type="button"
          className={`loc-picker__confirm ${confirmed ? 'is-confirmed' : ''}`}
          onClick={confirm}
        >
          {confirmed ? '✓ Pinned' : 'Confirm pin'}
        </button>
      </div>
    </div>
  );
}
