/**
 * UPI Payment Utilities
 * Generates UPI deep links and QR code data for Indian payment apps
 */

/**
 * Build a UPI deep link URI
 * @param {Object} params
 * @param {string} params.vpa - Payee UPI address (e.g. 'name@okicici')
 * @param {string} params.name - Payee display name
 * @param {number} [params.amount] - Amount in INR
 * @param {string} [params.note] - Transaction note
 * @param {string} [params.txnRef] - Transaction reference ID
 * @returns {string} UPI URI string
 */
export function buildUPILink({ vpa, name, amount, note, txnRef }) {
  const params = new URLSearchParams({
    pa: vpa,
    pn: name,
    cu: 'INR',
  });
  if (amount) params.set('am', parseFloat(amount).toFixed(2));
  if (note) params.set('tn', note);
  if (txnRef) params.set('tr', txnRef);

  return `upi://pay?${params.toString()}`;
}

/**
 * Generate a UPI QR code as a data URL using the qrcode library
 * @param {Object} params - Same as buildUPILink
 * @returns {Promise<string>} Base64 data URL of QR code image
 */
export async function generateUPIQR(params) {
  const QRCode = await import('qrcode');
  const upiString = buildUPILink(params);
  
  const dataUrl = await QRCode.toDataURL(upiString, {
    width: 280,
    margin: 2,
    color: {
      dark: '#F4F4F4',
      light: '#FFFFFF', // solid white background
    },
    errorCorrectionLevel: 'H',
  });
  
  return dataUrl;
}

/**
 * Open UPI payment intent on mobile
 * Falls back to showing QR for desktop
 * @param {Object} params - Same as buildUPILink
 */
export function initiateUPIPayment(params) {
  const upiLink = buildUPILink(params);
  
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = upiLink;
  }
  
  return upiLink;
}

/**
 * Calculate equal split amount
 * @param {number} totalAmount - Total bill in INR
 * @param {number} numPeople - Number of people to split among
 * @returns {number} Per-person amount (rounded up to nearest rupee)
 */
export function calculateSplit(totalAmount, numPeople) {
  if (numPeople <= 0) return 0;
  return Math.ceil(totalAmount / numPeople);
}
