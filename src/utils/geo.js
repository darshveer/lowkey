/**
 * geo.js — OpenStreetMap helpers (Nominatim search + OSM map/directions links).
 *
 * All free & keyless. Nominatim usage policy: keep volume low, debounce input,
 * and identify the app. See https://operations.osmfoundation.org/policies/nominatim/
 */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

/**
 * Search for addresses / places matching a free-text query.
 * @param {string} query
 * @param {Object} [opts]
 * @param {AbortSignal} [opts.signal] - to cancel in-flight requests
 * @param {number} [opts.limit=5]
 * @returns {Promise<Array<{ id: string, label: string, name: string, lat: number, lng: number }>>}
 */
export async function searchAddress(query, { signal, limit = 5 } = {}) {
  const q = (query || '').trim();
  if (q.length < 3) return [];

  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    addressdetails: '1',
    limit: String(limit),
    countrycodes: 'in', // bias toward India (LowKey's launch market)
  });

  const res = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Nominatim search failed (${res.status})`);

  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((item) => ({
    id: String(item.place_id),
    label: item.display_name,
    name: item.name || item.display_name.split(',')[0],
    lat: Number(item.lat),
    lng: Number(item.lon),
  }));
}

/**
 * Reverse-geocode coordinates into a place via Nominatim.
 * @param {number} lat
 * @param {number} lng
 * @param {Object} [opts]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{ label: string, name: string, lat: number, lng: number }|null>}
 */
export async function reverseGeocode(lat, lng, { signal } = {}) {
  if (!isFinite(lat) || !isFinite(lng)) return null;
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '1',
  });
  const res = await fetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Nominatim reverse failed (${res.status})`);
  const item = await res.json();
  if (!item || item.error) return null;
  return {
    label: item.display_name,
    name: item.name || (item.display_name || '').split(',')[0],
    lat: Number(item.lat) || lat,
    lng: Number(item.lon) || lng,
  };
}

/**
 * Ask the browser for the user's current position (Promise wrapper).
 * @returns {Promise<{ lat: number, lng: number }>}
 */
export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Geolocation is not supported on this device.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  });
}

/**
 * Build an embeddable OSM map iframe URL centered on a marker.
 * @param {{ lat: number, lng: number }} coords
 * @param {number} [span=0.008] - lat/lng padding for the bounding box (~zoom)
 * @returns {string|null}
 */
export function getOSMEmbedUrl({ lat, lng } = {}, span = 0.008) {
  if (!isFinite(lat) || !isFinite(lng)) return null;
  const bbox = [lng - span, lat - span, lng + span, lat + span]
    .map((n) => n.toFixed(6))
    .join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

/**
 * OSM "view this marker" link (opens full map with a pin).
 * @param {{ lat: number, lng: number }} coords
 * @returns {string|null}
 */
export function getOSMMarkerUrl({ lat, lng } = {}) {
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}

/**
 * OSM turn-by-turn directions link to a destination (car profile).
 * Falls back to a plain text search when coordinates are unavailable.
 * @param {{ lat?: number, lng?: number, address?: string }} dest
 * @returns {string}
 */
export function getOSMDirectionsUrl({ lat, lng, address } = {}) {
  if (isFinite(lat) && isFinite(lng)) {
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B${lat}%2C${lng}`;
  }
  return `https://www.openstreetmap.org/search?query=${encodeURIComponent(address || '')}`;
}
