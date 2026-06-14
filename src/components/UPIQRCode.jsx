import { useState, useEffect } from 'react';
import { generateUPIQR, initiateUPIPayment } from '../utils/upi.js';
import { formatINR } from '../utils/helpers.js';
import GlowButton from './GlowButton.jsx';
import './UPIQRCode.css';

/**
 * UPIQRCode — Dynamic UPI QR code display with pay button
 *
 * @param {Object} props
 * @param {string} props.upiId - Payee UPI address (e.g. 'name@okicici')
 * @param {string} props.payeeName - Display name of payee
 * @param {number} props.amount - Amount in INR
 * @param {string} [props.note] - Transaction note
 */
export default function UPIQRCode({ upiId, payeeName, amount, note }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    generateUPIQR({ vpa: upiId, name: payeeName, amount, note })
      .then((dataUrl) => {
        if (!cancelled) {
          setQrDataUrl(dataUrl);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError('Failed to generate QR');
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [upiId, payeeName, amount, note]);

  const handlePay = () => {
    initiateUPIPayment({ vpa: upiId, name: payeeName, amount, note });
  };

  return (
    <div className="upi-qr">
      <div className="upi-qr__image-wrap">
        {loading ? (
          <div className="upi-qr__loading">
            <div className="upi-qr__loading-spinner" />
          </div>
        ) : error ? (
          <div className="upi-qr__loading">
            <span className="upi-qr__error">{error}</span>
          </div>
        ) : (
          <img className="upi-qr__image" src={qrDataUrl} alt={`UPI QR code for ${payeeName}`} />
        )}
      </div>

      <div className="upi-qr__details">
        {amount > 0 && <span className="upi-qr__amount">{formatINR(amount)}</span>}
        <span className="upi-qr__upi-id">{upiId}</span>
        {note && <span className="upi-qr__note">{note}</span>}
      </div>

      <div className="upi-qr__action">
        <GlowButton variant="purple" size="md" fullWidth onClick={handlePay}>
          Pay Now
        </GlowButton>
      </div>
    </div>
  );
}
