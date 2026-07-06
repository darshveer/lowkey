/**
 * POST /api/razorpay/create-order
 * Creates a Razorpay order using server-side keys. The secret NEVER reaches
 * the client — only the public key id + order id are returned.
 *
 * Env (set in Vercel → Project → Settings → Environment Variables):
 *   RAZORPAY_KEY_ID      — public key id (rzp_live_… / rzp_test_…)
 *   RAZORPAY_KEY_SECRET  — secret key (server only)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    // Signal "not configured" so the client falls back to simulation.
    return res.status(501).json({ error: 'Razorpay is not configured on the server.' });
  }

  const { amount, currency = 'INR', receipt } = req.body || {};
  const rupees = Number(amount);
  if (!rupees || rupees <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  // SECURITY NOTE (payment integrity): the amount is currently taken from the
  // client. For production, look up the event server-side (Supabase service key)
  // and derive the authoritative amount from the event's cover_charge so a user
  // can't tamper with what they owe. Left as-is while payments are demo/simulated.
  if (rupees > 1_000_000) {
    return res.status(400).json({ error: 'Amount exceeds allowed limit' });
  }

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(rupees * 100), // paise
        currency,
        receipt: (receipt || `rcpt_${Date.now()}`).slice(0, 40),
        payment_capture: 1,
      }),
    });

    const data = await rzpRes.json();
    if (!rzpRes.ok) {
      return res.status(rzpRes.status).json({ error: data?.error?.description || 'Order creation failed' });
    }

    return res.status(200).json({
      orderId: data.id,
      amount: data.amount,
      currency: data.currency,
      keyId, // public key id — safe to send
    });
  } catch (err) {
    console.error('create-order error:', err);
    return res.status(500).json({ error: 'Unexpected error creating order' });
  }
}
