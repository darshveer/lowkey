import { useEffect, useState } from 'react';
import { generateQR, checkInToken } from '../utils/qr';
import { getEntryQrState } from '../utils/helpers';
import './QRTicket.css';

/**
 * QRTicket — a guest's entry pass. Encodes a check-in token the host or a
 * co-host scans at the door. Shown on the invite once a guest has RSVP'd.
 *
 * The QR is only generated (and scannable) once any cover charge has been
 * host-approved AND the party is within 1 day — before that it stays
 * locked, since a scan reads the same token whether or not it's "active"
 * and the underlying rules (payment, timing) are what actually gate entry.
 */
export default function QRTicket({ event, rsvp, paymentSubmitted = true }) {
  const [dataUrl, setDataUrl] = useState(null);
  const { unlocked, reason } = getEntryQrState(event, rsvp);

  useEffect(() => {
    if (!event?.id || !rsvp?.id || !unlocked) return;
    let cancelled = false;
    generateQR(checkInToken(event.id, rsvp.id))
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [event?.id, rsvp?.id, unlocked]);

  if (!rsvp) return null;

  const lockedText =
    reason === 'payment'
      ? (paymentSubmitted ? 'Locked — awaiting payment approval' : 'Locked — payment required')
      : 'Unlocks 1 day before the party';

  return (
    <div className={`qr-ticket ${rsvp.checked_in ? 'qr-ticket--in' : ''} ${!unlocked ? 'qr-ticket--pending' : ''}`}>
      <div className="qr-ticket__stub">
        <span className="qr-ticket__label">Entry Pass</span>
        <span className="qr-ticket__name">{rsvp.guest_name}</span>
        <span className="qr-ticket__count">
          {rsvp.guest_count > 1 ? `${rsvp.guest_count} tickets` : '1 ticket'}
        </span>
      </div>
      <div className="qr-ticket__code">
        {rsvp.checked_in ? (
          <div className="qr-ticket__checked">✓<span>Checked in</span></div>
        ) : !unlocked ? (
          <div className="qr-ticket__locked">🔒<span>{lockedText}</span></div>
        ) : dataUrl ? (
          <img src={dataUrl} alt="Your entry QR code" />
        ) : (
          <div className="qr-ticket__loading" />
        )}
      </div>
      <p className="qr-ticket__hint">
        {rsvp.checked_in
          ? "You're in — have fun!"
          : unlocked
            ? 'Show this QR at the door'
            : reason === 'payment'
              ? (paymentSubmitted
                  ? 'Your QR unlocks once the host approves your payment'
                  : 'Submit your payment below to lock in your spot')
              : 'Your QR unlocks 1 day before the party (once payment is approved)'}
      </p>
    </div>
  );
}
