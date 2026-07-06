import { useState, useEffect, useRef } from 'react';
import { generateUPIQR, initiateUPIPayment } from '../utils/upi.js';
import { formatINR } from '../utils/helpers.js';
import GlowButton from './GlowButton.jsx';
import GlassCard from './GlassCard.jsx';
import './PaymentModal.css';

/**
 * PaymentModal — Checkout modal supporting Zero MDR UPI and Razorpay Test Mode
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the modal is open
 * @param {function} props.onClose - Close handler
 * @param {number} props.amount - Amount in INR
 * @param {string} props.upiId - Payee UPI address (e.g. 'name@okicici')
 * @param {string} props.payeeName - Display name of payee
 * @param {string} props.note - Transaction note / party name
 * @param {function} props.onPaymentSuccess - Callback on success with payment details { gateway, transactionId }
 */
export default function PaymentModal({ isOpen, onClose, amount, upiId, payeeName, note, onPaymentSuccess }) {
  const [activeMethod, setActiveMethod] = useState('upi'); // 'upi' or 'razorpay'
  const [utrNumber, setUtrNumber] = useState('');
  const [upiError, setUpiError] = useState('');
  
  // UPI QR states
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [qrError, setQrError] = useState(null);

  // Razorpay states
  const [razorpayLoading, setRazorpayLoading] = useState(false);
  const [razorpayError, setRazorpayError] = useState('');

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

  // 1. Generate QR Code
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

  // 2. Direct Mobile App Trigger
  const handleUpiMobilePay = () => {
    initiateUPIPayment({ vpa: upiId, name: payeeName, amount, note });
  };

  // 3. Manual UPI Verification
  const handleUpiSubmit = (e) => {
    e.preventDefault();
    setUpiError('');
    const trimmed = utrNumber.trim();
    if (!trimmed) {
      setUpiError('Please enter the UPI UTR / Ref Number.');
      return;
    }
    if (trimmed.length < 6) {
      setUpiError('Transaction reference is too short.');
      return;
    }
    
    // Simulate payment transaction recording
    onPaymentSuccess({
      gateway: 'upi',
      transactionId: trimmed
    });
  };

  // 4. Load the real Razorpay Checkout script on demand.
  const loadCheckoutScript = () =>
    new Promise((resolve) => {
      if (window.Razorpay) return resolve(true);
      const existing = document.getElementById('razorpay-checkout-js');
      if (existing) {
        existing.addEventListener('load', () => resolve(true));
        existing.addEventListener('error', () => resolve(false));
        return;
      }
      const s = document.createElement('script');
      s.id = 'razorpay-checkout-js';
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });

  // Fallback used when the serverless backend isn't configured (e.g. local dev).
  const simulateRazorpay = () =>
    new Promise((resolve) => {
      setTimeout(() => {
        setRazorpayLoading(false);
        onPaymentSuccess({
          gateway: 'razorpay-sim',
          transactionId: 'rzp_sim_' + Date.now().toString(36),
        });
        resolve();
      }, 1500);
    });

  // 5. Trigger Razorpay checkout — real order via /api, graceful fallback to sim.
  const handleRazorpayPay = async () => {
    setRazorpayLoading(true);
    setRazorpayError('');

    try {
      // 1) Ask our serverless function to create an order.
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, receipt: note }),
      }).catch(() => null);

      // Backend missing/not configured (404/501/offline) → simulate.
      if (!orderRes || !orderRes.ok) {
        await simulateRazorpay();
        return;
      }

      const order = await orderRes.json();
      const loaded = await loadCheckoutScript();
      if (!loaded || !window.Razorpay) {
        await simulateRazorpay();
        return;
      }

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.orderId,
        name: 'LowKey Parties',
        description: note,
        handler: async (response) => {
          // 2) Verify the signature server-side before trusting the payment.
          const verifyRes = await fetch('/api/razorpay/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(response),
          }).catch(() => null);
          const verified = verifyRes && verifyRes.ok ? (await verifyRes.json()).valid : false;
          setRazorpayLoading(false);
          if (verified) {
            onPaymentSuccess({ gateway: 'razorpay', transactionId: response.razorpay_payment_id });
          } else {
            setRazorpayError('Payment could not be verified. If you were charged, contact the host.');
          }
        },
        prefill: { name: 'Guest User' },
        notes: { event_note: note },
        theme: { color: '#8B5CF6' },
        modal: { ondismiss: () => setRazorpayLoading(false) },
      });
      rzp.open();
    } catch (err) {
      console.error(err);
      setRazorpayError('Failed to open Razorpay payment interface.');
      setRazorpayLoading(false);
    }
  };

  return (
    <div className="payment-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
      <div className="payment-modal-backdrop" onClick={onClose} />
      <div className="payment-modal-container animate-fade-in-up" ref={dialogRef}>
        <GlassCard className="payment-modal-card">
          {/* Header */}
          <div className="payment-modal-header">
            <div>
              <h3 className="payment-modal-title" id="payment-modal-title">Secure Checkout</h3>
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

          {/* Tabs */}
          <div className="payment-method-tabs">
            <button
              className={`payment-tab-btn ${activeMethod === 'upi' ? 'active' : ''}`}
              onClick={() => setActiveMethod('upi')}
              type="button"
            >
              📱 UPI Transfer (0% Fee)
            </button>
            <button
              className={`payment-tab-btn ${activeMethod === 'razorpay' ? 'active' : ''}`}
              onClick={() => setActiveMethod('razorpay')}
              type="button"
            >
              💳 Card / Netbanking (Test)
            </button>
          </div>

          {/* Tab Content */}
          <div className="payment-modal-body">
            {activeMethod === 'upi' ? (
              <div className="payment-method-upi">
                <p className="method-instruction">
                  Scan QR with Google Pay, PhonePe, Paytm, or BHIM. Zero transaction fees.
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
                    ⚡ Open UPI App on Phone
                  </GlowButton>
                </div>

                {/* Verification Form */}
                <form className="payment-verify-form" onSubmit={handleUpiSubmit}>
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
                      Confirm Payment Ref
                    </GlowButton>
                  </div>
                </form>
              </div>
            ) : (
              <div className="payment-method-razorpay">
                <p className="method-instruction">
                  Simulate standard payment gateway transactions. Supports credit cards, netbanking, and wallets in Test Mode.
                </p>
                
                <div className="razorpay-checkout-wrap">
                  {razorpayError && <p className="payment-error-text" role="alert">{razorpayError}</p>}
                  <GlowButton
                    variant="pink"
                    onClick={handleRazorpayPay}
                    disabled={razorpayLoading}
                    fullWidth
                  >
                    {razorpayLoading ? 'Loading Checkout...' : 'Pay with Razorpay'}
                  </GlowButton>
                  <small className="razorpay-helper-text">
                    This runs in Razorpay Test Mode. You can enter any 4111-xxxx card number to simulate success.
                  </small>
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
