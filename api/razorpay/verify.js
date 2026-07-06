import crypto from 'crypto';

/**
 * POST /api/razorpay/verify
 * Verifies a Razorpay payment signature server-side (HMAC-SHA256 of
 * `${order_id}|${payment_id}` with the secret key).
 *
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Returns: { valid: boolean }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    return res.status(501).json({ error: 'Razorpay is not configured on the server.' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing verification fields' });
  }

  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  // Constant-time compare (guard against length mismatch, which would throw).
  const a = Buffer.from(expected);
  const b = Buffer.from(razorpay_signature);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);

  return res.status(200).json({ valid });
}
