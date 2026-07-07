/** Generic QR data-URL generator (dark modules on white — always scannable). */
export async function generateQR(text, { width = 220 } = {}) {
  const QRCode = await import('qrcode');
  return QRCode.toDataURL(text, {
    width,
    margin: 2,
    color: { dark: '#0B0B14', light: '#FFFFFF' },
    errorCorrectionLevel: 'M',
  });
}

/** Encode/decode a check-in token embedded in a guest's QR ticket. */
export function checkInToken(eventId, rsvpId) {
  return `lowkey:${eventId}:${rsvpId}`;
}

export function parseCheckInToken(text) {
  const m = /^lowkey:([^:]+):([^:]+)$/.exec(String(text || '').trim());
  return m ? { eventId: m[1], rsvpId: m[2] } : null;
}
