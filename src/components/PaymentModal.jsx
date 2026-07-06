import { useState, useEffect } from 'react';
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

  // 4. Load Mock Razorpay script (simulated)
  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      // Create a mock Razorpay checkout instance
      window.Razorpay = function(options) {
        this.open = function() {
           // Simulate user filling out the modal and paying successfully after 1.5s
           setTimeout(() => {
              if (options.handler) {
                options.handler({ razorpay_payment_id: 'rzp_sim_' + Math.random().toString(36).substring(2, 11) });
              }
           }, 1500);
        };
      };
      resolve(true);
    });
  };

  // 5. Trigger Razorpay test checkout
  const handleRazorpayPay = async () => {
    setRazorpayLoading(true);
    setRazorpayError('');

    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded) {
      setRazorpayError('Failed to load Razorpay payment portal.');
      setRazorpayLoading(false);
      return;
    }

    const options = {
      key: 'rzp_test_dummykey', // Standard test key
      amount: Math.round(amount * 100), // in paise
      currency: 'INR',
      name: 'LowKey Parties',
      description: note,
      image: 'https://cdn.pixabay.com/photo/2016/11/18/17/47/house-1836070_1280.jpg',
      handler: function (response) {
        setRazorpayLoading(false);
        onPaymentSuccess({
          gateway: 'razorpay',
          transactionId: response.razorpay_payment_id || 'rzp_sim_' + Math.random().toString(36).substring(2, 11)
        });
      },
      prefill: {
        name: 'Guest User',
        email: 'guest@lowkey.com',
        contact: '9999999999'
      },
      notes: {
        event_note: note
      },
      theme: {
        color: '#8B5CF6' // LowKey primary purple
      },
      modal: {
        ondismiss: function () {
          setRazorpayLoading(false);
        }
      }
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err);
      setRazorpayError('Failed to open Razorpay payment interface.');
      setRazorpayLoading(false);
    }
  };

  return (
    <div className="payment-modal-overlay" role="dialog" aria-modal="true">
      <div className="payment-modal-backdrop" onClick={onClose} />
      <div className="payment-modal-container animate-fade-in-up">
        <GlassCard className="payment-modal-card">
          {/* Header */}
          <div className="payment-modal-header">
            <div>
              <h3 className="payment-modal-title">Secure Checkout</h3>
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
