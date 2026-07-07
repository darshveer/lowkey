import { useEffect, useState } from 'react';
import './WeatherWidget.css';

/** Map a WMO weather code to an emoji + short label. */
function describe(code) {
  if (code === 0) return ['☀️', 'Clear'];
  if (code <= 2) return ['🌤️', 'Mostly clear'];
  if (code === 3) return ['☁️', 'Cloudy'];
  if (code <= 48) return ['🌫️', 'Fog'];
  if (code <= 57) return ['🌦️', 'Drizzle'];
  if (code <= 67) return ['🌧️', 'Rain'];
  if (code <= 77) return ['🌨️', 'Snow'];
  if (code <= 82) return ['🌧️', 'Showers'];
  if (code <= 86) return ['🌨️', 'Snow showers'];
  return ['⛈️', 'Thunderstorm'];
}

/**
 * WeatherWidget — Open-Meteo forecast for the party's date & location (keyless).
 * Renders nothing if there's no location, or the date is outside the forecast
 * window (~16 days).
 */
export default function WeatherWidget({ lat, lng, date }) {
  const [wx, setWx] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    // No location/date → stay in the non-'ok' state (renders nothing).
    if (!isFinite(lat) || !isFinite(lng) || !date) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'auto',
      start_date: date,
      end_date: date,
    });
    fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('weather'))))
      .then((data) => {
        const d = data?.daily;
        if (!d || !d.time?.length) {
          setStatus('none');
          return;
        }
        setWx({
          code: d.weather_code[0],
          max: Math.round(d.temperature_2m_max[0]),
          min: Math.round(d.temperature_2m_min[0]),
          rain: d.precipitation_probability_max?.[0] ?? null,
        });
        setStatus('ok');
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setStatus('none');
      });
    return () => controller.abort();
  }, [lat, lng, date]);

  if (status !== 'ok' || !wx) return null;
  const [emoji, label] = describe(wx.code);

  return (
    <div className="weather-widget">
      <span className="weather-widget__emoji" aria-hidden="true">{emoji}</span>
      <div className="weather-widget__text">
        <span className="weather-widget__temp">{wx.max}° / {wx.min}°</span>
        <span className="weather-widget__label">
          {label}{wx.rain != null ? ` · ${wx.rain}% rain` : ''}
        </span>
      </div>
      <span className="weather-widget__tag">forecast</span>
    </div>
  );
}
