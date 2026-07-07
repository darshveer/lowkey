/**
 * Calendar export helpers — Google Calendar link + downloadable .ics file.
 */

function pad(n) {
  return String(n).padStart(2, '0');
}

function toUTCStamp(d) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;
}

/** Resolve an event's start/end Date objects from date + time fields. */
export function getEventTimes(event) {
  if (!event?.date) return null;
  const start = new Date(`${event.date}T${event.time_start || '19:00'}:00`);
  let end;
  if (event.time_end) {
    end = new Date(`${event.date}T${event.time_end}:00`);
    if (event.time_end_next_day || end <= start) end.setDate(end.getDate() + 1);
  } else {
    end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  }
  return { start, end };
}

/** "Add to Google Calendar" URL. */
export function googleCalendarUrl(event) {
  const t = getEventTimes(event);
  if (!t) return '#';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.name || 'Party',
    dates: `${toUTCStamp(t.start)}/${toUTCStamp(t.end)}`,
    details: `${event.tagline || ''}\nHosted by ${event.host_name || ''} on LowKey`,
    location: event.location_address || event.location_name || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildICS(event) {
  const t = getEventTimes(event);
  if (!t) return '';
  const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LowKey//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@lowkey`,
    `DTSTAMP:${toUTCStamp(new Date())}`,
    `DTSTART:${toUTCStamp(t.start)}`,
    `DTEND:${toUTCStamp(t.end)}`,
    `SUMMARY:${esc(event.name)}`,
    `DESCRIPTION:${esc(`${event.tagline || ''} — Hosted by ${event.host_name || ''} on LowKey`)}`,
    `LOCATION:${esc(event.location_address || event.location_name || '')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Trigger a download of the event as an .ics file. */
export function downloadICS(event) {
  const ics = buildICS(event);
  if (!ics) return;
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(event.name || 'party').replace(/\s+/g, '-').toLowerCase()}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
