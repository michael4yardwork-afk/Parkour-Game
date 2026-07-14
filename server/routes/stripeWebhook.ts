import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import pool from '../db';
import { getStripeClient, isStripeConfigured } from '../stripe';

const router = Router();

/**
 * Applies a subscription's current status/plan/period-end to the user it
 * belongs to (matched by Stripe customer id).
 */
async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const plan = (subscription.metadata?.cycle as string) || null;
  const periodEndItem = subscription.items.data[0];
  const currentPeriodEnd = periodEndItem?.current_period_end
    ? periodEndItem.current_period_end * 1000
    : null;

  await pool.query(
    `UPDATE users
     SET stripe_subscription_id = $1,
         subscription_status = $2,
         subscription_plan = COALESCE($3, subscription_plan),
         subscription_current_period_end = $4
     WHERE stripe_customer_id = $5`,
    [subscription.id, subscription.status, plan, currentPeriodEnd, customerId]
  );
}

/**
 * POST /api/billing/webhook
 * Registered with express.raw() BEFORE express.json() in index.ts so the
 * signature can be verified against the exact raw request body.
 */
router.post('/', async (req: Request, res: Response) => {
  if (!isStripeConfigured()) return res.status(503).send('Stripe not configured.');

  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) {
    return res.status(400).send('Missing signature or webhook secret.');
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature as string, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && session.subscription) {
          const stripe = getStripeClient();
          const subscriptionId =
            typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscription(subscription);
        }
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handling error:', err);
    res.status(500).send('Webhook handler error.');
  }
});

export default router;
