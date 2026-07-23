import Stripe from 'stripe';
import pool from './db';

/**
 * Applies the subscription's current state to the account identified by the
 * Stripe customer ID. The customer ID is resolved server-side; browser
 * metadata and usernames are never used as ownership proof.
 */
export async function syncSubscriptionEntitlement(
  subscription: Stripe.Subscription
): Promise<{ id: number; username: string } | null> {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;
  const plan = (subscription.metadata?.cycle as string) || null;
  const periodEndItem = subscription.items.data[0];
  const currentPeriodEnd = periodEndItem?.current_period_end
    ? periodEndItem.current_period_end * 1000
    : null;

  const result = await pool.query(
    `UPDATE users
     SET stripe_subscription_id = $1,
         subscription_status = $2,
         subscription_plan = COALESCE($3, subscription_plan),
         subscription_current_period_end = $4
     WHERE stripe_customer_id = $5
     RETURNING id, username`,
    [subscription.id, subscription.status, plan, currentPeriodEnd, customerId]
  );

  return result.rows[0] ?? null;
}