import { googleCalendarUrl, downloadICS } from '../utils/calendar';
import './CalendarButton.css';

/** Add-to-calendar row: Google Calendar link + .ics download. */
export default function CalendarButton({ event }) {
  if (!event?.date) return null;
  return (
    <div className="cal-btns">
      <a
        className="cal-btn"
        href={googleCalendarUrl(event)}
        target="_blank"
        rel="noreferrer"
      >
        <span aria-hidden="true">📅</span> Google Calendar
      </a>
      <button type="button" className="cal-btn" onClick={() => downloadICS(event)}>
        <span aria-hidden="true">⬇️</span> Apple / .ics
      </button>
    </div>
  );
}
