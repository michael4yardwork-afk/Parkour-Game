import { Router, Request, Response } from 'express';
import pool from '../db';
import { getStripeClient, isStripeConfigured, getPriceId } from '../stripe';
import { getAuthenticatedAccount } from '../authIdentity';
import { syncSubscriptionEntitlement } from '../billingEntitlements';

const router = Router();
// Where to send the browser back to after Stripe Checkout. Never trust
// browser-supplied Origin/Referer values for payment redirects.
function appOrigin(req: Request): string {
  const configured = process.env.APP_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Ignore an invalid configured URL and use the current request host.
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

    const account = await getAuthenticatedAccount(req);
    if (!account) return res.status(401).json({ error: 'Unauthorized.' });

    const { cycle } = req.body as { cycle?: 'monthly' | 'yearly' };
    if (cycle !== 'monthly' && cycle !== 'yearly') {
      return res.status(400).json({ error: 'Invalid billing cycle.' });
    }

    const stripe = getStripeClient();

    const userRes = await pool.query(
      `SELECT id, username, email, stripe_customer_id
              , subscription_status
       FROM users
       WHERE id = $1`,
      [account.id]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const user = userRes.rows[0];

    if (['active', 'trialing', 'past_due', 'incomplete'].includes(user.subscription_status)) {
      return res.status(409).json({ error: 'This account already has a billing subscription.' });
    }

    let customerId = user.stripe_customer_id as string | null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name: user.username,
        email: user.email || undefined,
        metadata: { userId: String(user.id), username: user.username },
      });
      customerId = customer.id;
      try {
        const saved = await pool.query(
          `UPDATE users
           SET stripe_customer_id = $1
           WHERE id = $2 AND stripe_customer_id IS NULL
           RETURNING stripe_customer_id`,
          [customerId, user.id]
        );
        if (saved.rows.length === 0) {
          customerId = user.stripe_customer_id;
        }
      } catch (saveError: any) {
        // A concurrent checkout may have won the unique customer claim.
        if (saveError?.code !== '23505') throw saveError;
        const current = await pool.query(
          'SELECT stripe_customer_id FROM users WHERE id = $1',
          [user.id]
        );
        customerId = current.rows[0]?.stripe_customer_id;
      }
    }

    if (!customerId) return res.status(409).json({ error: 'Could not assign a payment account. Please try again.' });

    const origin = appOrigin(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: getPriceId(cycle), quantity: 1 }],
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      client_reference_id: String(user.id),
      metadata: { userId: String(user.id), username: user.username, cycle },
      subscription_data: { metadata: { userId: String(user.id), username: user.username, cycle } },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('Checkout session error:', err);
    res.status(500).json({ error: err.message || 'Server error.' });
  }
});

/**
 * Confirms a completed Checkout Session from Stripe and applies its
 * subscription entitlement immediately. This closes the redirect/webhook
 * timing gap; Stripe webhooks still handle all later lifecycle changes.
 */
router.get('/checkout/confirm', async (req: Request, res: Response) => {
  try {
    if (!isStripeConfigured()) {
      return res.status(503).json({ error: 'Payments are not configured yet.' });
    }

    const account = await getAuthenticatedAccount(req);
    if (!account) return res.status(401).json({ error: 'Unauthorized.' });

    const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id : '';
    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
      return res.status(400).json({ error: 'Invalid checkout session.' });
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const sessionCustomerId = typeof session.customer === 'string'
      ? session.customer
      : session.customer?.id;

    const owner = await pool.query(
      'SELECT id, stripe_customer_id FROM users WHERE id = $1',
      [account.id]
    );
    if (
      owner.rows.length === 0 ||
      !owner.rows[0].stripe_customer_id ||
      owner.rows[0].stripe_customer_id !== sessionCustomerId
    ) {
      return res.status(403).json({ error: 'Checkout session does not belong to this account.' });
    }

    if (session.mode !== 'subscription' || session.status !== 'complete' || !session.subscription) {
      return res.status(409).json({ error: 'Checkout has not completed.' });
    }

    const subscriptionId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const syncedAccount = await syncSubscriptionEntitlement(subscription);
    if (!syncedAccount || syncedAccount.id !== account.id) {
      return res.status(409).json({ error: 'Subscription ownership could not be confirmed.' });
    }

    res.json({
      confirmed: true,
      isPlatinum: subscription.status === 'active' || subscription.status === 'trialing',
      status: subscription.status,
      plan: (subscription.metadata?.cycle as string) || null,
      currentPeriodEnd: subscription.items.data[0]?.current_period_end
        ? subscription.items.data[0].current_period_end * 1000
        : null,
    });
  } catch (err) {
    console.error('Checkout confirmation error:', err);
    res.status(500).json({ error: 'Could not confirm checkout.' });
  }
});

/**
 * GET /api/billing/status
 * Returns the logged-in user's current subscription status. Purely
 * informational for now — no features are gated on this yet.
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const account = await getAuthenticatedAccount(req);
    if (!account) return res.status(401).json({ error: 'Unauthorized.' });

    // Reconcile directly with Stripe when possible. This is a safe fallback
    // for delayed/missed webhooks and ensures an account is granted or
    // removed from Platinum based on Stripe's current subscription state.
    const billingIdentity = await pool.query(
      `SELECT stripe_customer_id
       FROM users
       WHERE id = $1`,
      [account.id]
    );
    const customerId = billingIdentity.rows[0]?.stripe_customer_id as string | null | undefined;
    if (customerId && isStripeConfigured()) {
      try {
        const stripe = getStripeClient();
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: 'all',
          limit: 10,
        });

        const currentSubscription =
          subscriptions.data.find(subscription =>
            subscription.status === 'active' || subscription.status === 'trialing'
          ) ?? subscriptions.data[0];

        if (currentSubscription) {
          await syncSubscriptionEntitlement(currentSubscription);
        }
      } catch (reconcileError) {
        // Keep serving the last known database state during a temporary Stripe
        // outage. Webhooks or the next status request can reconcile later.
        console.error('Billing reconciliation error:', reconcileError);
      }
    }

    const result = await pool.query(
      `SELECT subscription_status, subscription_plan, subscription_current_period_end
       FROM users WHERE id = $1`,
      [account.id]
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

/**
 * GET /api/billing/history
 * Returns only lifecycle/payment records owned by the authenticated account.
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const account = await getAuthenticatedAccount(req);
    if (!account) return res.status(401).json({ error: 'Unauthorized.' });

    const result = await pool.query(
      `SELECT id, plan, amount_cents, currency, event_type,
              subscription_status, period_start, period_end, recorded_at
       FROM platinum_purchases
       WHERE user_id = $1
       ORDER BY recorded_at DESC
       LIMIT 100`,
      [account.id]
    );

    res.json({
      history: result.rows.map(row => ({
        id: row.id,
        plan: row.plan,
        amountCents: row.amount_cents,
        currency: row.currency,
        eventType: row.event_type,
        subscriptionStatus: row.subscription_status,
        periodStart: row.period_start ? Number(row.period_start) : null,
        periodEnd: row.period_end ? Number(row.period_end) : null,
        recordedAt: Number(row.recorded_at),
      })),
    });
  } catch (err) {
    console.error('Billing history error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
