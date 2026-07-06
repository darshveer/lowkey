import { useState, useEffect, useRef } from 'react';
import { searchAddress, reverseGeocode, getCurrentPosition } from '../utils/geo';
import './AddressSearch.css';

/**
 * AddressSearch — OpenStreetMap (Nominatim) powered address autocomplete.
 *
 * Debounces input, shows a dropdown of matches, and on select emits the chosen
 * place with coordinates so the host's event gets real lat/lng for maps/directions.
 *
 * @param {Object} props
 * @param {string} props.value - Controlled text value (the address string)
 * @param {(v: string) => void} props.onChange - Fires on raw text edits
 * @param {(place: { name: string, label: string, lat: number, lng: number }) => void} props.onSelect
 * @param {string} [props.placeholder]
 */
export default function AddressSearch({ value, onChange, onSelect, placeholder }) {
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const [justPicked, setJustPicked] = useState(false);
  const [locating, setLocating] = useState(false);

  const wrapRef = useRef(null);
  const abortRef = useRef(null);

  // Debounced Nominatim search. All state updates happen inside the timeout
  // callback (never synchronously in the effect body) to avoid cascading renders.
  useEffect(() => {
    const q = (value || '').trim();
    const shouldClear = justPicked || q.length < 3;

    const handle = setTimeout(() => {
      if (shouldClear) {
        setResults([]);
        setOpen(false);
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError('');
      searchAddress(q, { signal: controller.signal })
        .then((places) => {
          setResults(places);
          setOpen(places.length > 0);
          setActiveIndex(-1);
        })
        .catch((err) => {
          if (err.name !== 'AbortError') setError('Could not reach map search.');
        })
        .finally(() => setLoading(false));
    }, shouldClear ? 0 : 400);

    return () => clearTimeout(handle);
  }, [value, justPicked]);

  // Close dropdown on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const pick = (place) => {
    setJustPicked(true);
    onSelect(place);
    setOpen(false);
    setResults([]);
  };

  const useMyLocation = async () => {
    setError('');
    setLocating(true);
    try {
      const { lat, lng } = await getCurrentPosition();
      const place = await reverseGeocode(lat, lng);
      if (place) {
        pick(place);
      } else {
        pick({ id: 'geo', name: 'My location', label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng });
      }
    } catch (err) {
      setError(
        err && err.code === 1
          ? 'Location permission denied. Enable it or search manually.'
          : 'Could not get your location. Try searching instead.'
      );
    } finally {
      setLocating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      pick(results[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="address-search" ref={wrapRef}>
      <div className="address-search__input-wrap">
        <span className="address-search__icon" aria-hidden="true">📍</span>
        <input
          className="input-glass address-search__input"
          type="text"
          placeholder={placeholder || 'Search address on OpenStreetMap…'}
          value={value}
          onChange={(e) => {
            setJustPicked(false);
            onChange(e.target.value);
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="address-search-list"
        />
        {loading && <span className="address-search__spinner" aria-hidden="true" />}
      </div>

      <button
        type="button"
        className="address-search__locate"
        onClick={useMyLocation}
        disabled={locating}
      >
        {locating ? (
          <>
            <span className="address-search__spinner address-search__spinner--inline" aria-hidden="true" />
            Locating…
          </>
        ) : (
          <>📡 Use my current location</>
        )}
      </button>

      {open && (
        <ul className="address-search__dropdown" id="address-search-list" role="listbox">
          {results.map((place, i) => (
            <li
              key={place.id}
              role="option"
              aria-selected={i === activeIndex}
              className={`address-search__option ${i === activeIndex ? 'is-active' : ''}`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(place);
              }}
            >
              <span className="address-search__option-name">{place.name}</span>
              <span className="address-search__option-label">{place.label}</span>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="address-search__error">{error}</p>}
    </div>
  );
}
