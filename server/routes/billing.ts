import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db';
import { getStripeClient, isStripeConfigured, getPriceId } from '../stripe';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'delta-rush-secret-key-change-in-production';

function getAuth(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  try {
    const decoded: any = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    return decoded.username;
  } catch {
    return null;
  }
}

// Where to send the browser back to after Stripe Checkout. In development
// this is the Vite dev server origin; in production it's the app's own
// origin, so we just use the request's own Origin/Referer header.
function appOrigin(req: Request): string {
  const origin = req.headers.origin || req.headers.referer;
  if (typeof origin === 'string' && origin) {
    try {
      return new URL(origin).origin;
    } catch {
      // fall through
    }
  }
  return `${req.protocol}://${req.get('host')}`;
}

/**
 * POST /api/billing/checkout
 * Body: { cycle: 'monthly' | 'yearly' }
 * Creates (or reuses) a Stripe customer for the logged-in user and starts a
 * Checkout Session for the Platinum subscription. Returns the Checkout URL
 * to redirect the browser to.
 */
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'Payments are not configured yet.' });
    }

    const username = getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    const { cycle } = req.body as { cycle?: 'monthly' | 'yearly' };
    if (cycle !== 'monthly' && cycle !== 'yearly') {
      return res.status(400).json({ error: 'Invalid billing cycle.' });
    }

    const stripe = getStripeClient();

    const userRes = await pool.query(
      'SELECT id, username, stripe_customer_id FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const user = userRes.rows[0];

    let customerId = user.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: user.username,
        metadata: { username: user.username },
      });
      customerId = customer.id;
      await pool.query('UPDATE users SET stripe_customer_id = $1 WHERE id = $2', [customerId, user.id]);
    }

    const origin = appOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: getPriceId(cycle), quantity: 1 }],
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      client_reference_id: user.username,
      metadata: { username: user.username, cycle },
      subscription_data: { metadata: { username: user.username, cycle } },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout session error:', err);
    res.status(500).json({ error: err.message || 'Server error.' });
  }
});

/**
 * GET /api/billing/status
 * Returns the logged-in user's current subscription status. Purely
 * informational for now — no features are gated on this yet.
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const username = getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    const result = await pool.query(
      `SELECT subscription_status, subscription_plan, subscription_current_period_end
       FROM users WHERE LOWER(username) = LOWER($1)`,
      [username]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    const row = result.rows[0];
    const isPlatinum = row.subscription_status === 'active' || row.subscription_status === 'trialing';
    res.json({
      isPlatinum,
      status: row.subscription_status,
      plan: row.subscription_plan,
      currentPeriodEnd: row.subscription_current_period_end ? parseInt(row.subscription_current_period_end) : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
