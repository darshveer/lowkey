import { useState, useEffect, useRef } from 'react';
import { generateUPIQR, initiateUPIPayment } from '../utils/upi.js';
import { formatINR } from '../utils/helpers.js';
import GlowButton from './GlowButton.jsx';
import GlassCard from './GlassCard.jsx';
import './PaymentModal.css';

/**
 * PaymentModal — UPI checkout. Guests pay via any UPI app and submit their
 * UTR as proof; the host (or a co-host) reviews and approves it from the
 * party dashboard's Approvals tab. This is not an instant success — it
 * hands off to a human, so onPaymentSubmitted fires on submission, not on
 * confirmed payment.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {function} props.onClose - Close handler
 * @param {number} props.amount - Amount in INR
 * @param {string} props.upiId - Payee UPI address (e.g. 'name@okicici')
 * @param {string} props.payeeName - Display name of payee
 * @param {string} props.note - Transaction note / party name
 * @param {string} [props.defaultPhone] - Prefills the phone field (e.g. from the signed-in profile)
 * @param {function} props.onPaymentSubmitted - Callback once a UTR is submitted, with { transactionId, phone }
 */
export default function PaymentModal({ isOpen, onClose, amount, upiId, payeeName, note, defaultPhone = '', onPaymentSubmitted }) {
  const [utrNumber, setUtrNumber] = useState('');
  const [phone, setPhone] = useState(defaultPhone);
  const [upiError, setUpiError] = useState('');

  // Keep the phone field in sync if a signed-in profile's number loads late.
  // Deferred to a microtask so we don't setState synchronously in the effect body.
  useEffect(() => {
    if (!defaultPhone) return;
    const t = setTimeout(() => setPhone(defaultPhone), 0);
    return () => clearTimeout(t);
  }, [defaultPhone]);

  // UPI QR states
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState(null);

  const dialogRef = useRef(null);

  // Accessibility: Esc to close, focus trap, and restore focus on close.
  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement;
    const node = dialogRef.current;
    const focusables = () =>
      node
        ? Array.from(
            node.querySelectorAll(
              'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])'
            )
          )
        : [];

    // Move focus into the dialog
    const first = focusables()[0];
    if (first) first.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'Tab') {
        const items = focusables();
        if (items.length === 0) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);
    // Lock background scroll while the modal is open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [isOpen, onClose]);

  // Generate the UPI QR code
  useEffect(() => {
    if (!isOpen || !upiId) return;

    let cancelled = false;

    // Kick off generation on the microtask queue so we avoid a synchronous
    // setState inside the effect body (which triggers cascading renders).
    Promise.resolve()
      .then(() => {
        if (cancelled) return null;
        setQrLoading(true);
        setQrError(null);
        return generateUPIQR({ vpa: upiId, name: payeeName, amount, note });
      })
      .then((dataUrl) => {
        if (!cancelled && dataUrl) {
          setQrDataUrl(dataUrl);
          setQrLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setQrError('Failed to generate UPI QR code');
          setQrLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [isOpen, upiId, payeeName, amount, note]);

  if (!isOpen) return null;

  const handleUpiMobilePay = () => {
    initiateUPIPayment({ vpa: upiId, name: payeeName, amount, note });
  };

  const handleUpiSubmit = (e) => {
    e.preventDefault();
    setUpiError('');
    const trimmed = utrNumber.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      setUpiError('Please enter a phone number so the host can verify your payment.');
      return;
    }
    if (!trimmed) {
      setUpiError('Please enter the UPI UTR / Ref Number.');
      return;
    }
    if (trimmed.length < 6) {
      setUpiError('Transaction reference is too short.');
      return;
    }

    // Hands off to the host for manual approval — not a confirmed payment yet.
    onPaymentSubmitted({ transactionId: trimmed, phone: trimmedPhone });
  };

  return (
    <div className="payment-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
      <div className="payment-modal-backdrop" onClick={onClose} />
      <div className="payment-modal-container animate-fade-in-up" ref={dialogRef}>
        <GlassCard className="payment-modal-card">
          {/* Header */}
          <div className="payment-modal-header">
            <div>
              <h3 className="payment-modal-title" id="payment-modal-title">Pay via UPI</h3>
              <p className="payment-modal-desc">{note}</p>
            </div>
            <button className="payment-modal-close" onClick={onClose} aria-label="Close modal">
              &times;
            </button>
          </div>

          {/* Amount Badge */}
          <div className="payment-modal-amount">
            <span className="payment-amount-label">Amount Due</span>
            <span className="payment-amount-value">{formatINR(amount)}</span>
          </div>

          <div className="payment-modal-body">
            <div className="payment-method-upi">
              <p className="method-instruction">
                Scan with Google Pay, PhonePe, Paytm, or BHIM, then submit your UTR below —
                the host reviews and approves it.
              </p>

              {/* QR Code display */}
              <div className="payment-qr-container">
                {qrLoading ? (
                  <div className="payment-qr-loading">
                    <div className="payment-qr-spinner" />
                  </div>
                ) : qrError ? (
                  <div className="payment-qr-error">{qrError}</div>
                ) : (
                  <img className="payment-qr-image" src={qrDataUrl} alt={`UPI QR Code for ${payeeName}`} />
                )}
              </div>

              <div className="payment-qr-details">
                <div className="payee-name">Host: <strong>{payeeName}</strong></div>
                <div className="payee-vpa">UPI ID: <code>{upiId}</code></div>
              </div>

              {/* Mobile Deep Link */}
              <div className="mobile-only-pay-btn">
                <GlowButton variant="purple" onClick={handleUpiMobilePay} fullWidth>
                  Open UPI App on Phone
                </GlowButton>
              </div>

              {/* Verification Form */}
              <form className="payment-verify-form" onSubmit={handleUpiSubmit}>
                <label htmlFor="payer-phone" className="utr-label">
                  Your Phone Number *
                </label>
                <input
                  id="payer-phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="For the host to verify your payment"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="utr-input"
                  maxLength={20}
                />
                <label htmlFor="utr-number" className="utr-label">
                  Enter UPI Ref / UTR No. (12-digits) *
                </label>
                <input
                  id="utr-number"
                  type="text"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="e.g. 416528790134"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  className="utr-input"
                  maxLength={16}
                />
                {upiError && <p className="payment-error-text" role="alert">{upiError}</p>}
                <div className="verify-submit-btn">
                  <GlowButton variant="lime" type="submit" fullWidth>
                    Submit for Approval
                  </GlowButton>
                </div>
              </form>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
