import Stripe from 'stripe';
import pool from './db';
import { verifyPaymentLinkReference } from './stripe';

/**
 * Associates a newly-created Stripe customer from an app-generated Payment
 * Link with the immutable local account encoded in the signed reference.
 *
 * A different active customer can never be overwritten. A terminal old
 * subscription may be replaced because Stripe Payment Links can create a new
 * customer for a later purchase.
 */
export async function associatePaymentLinkCustomer(
  session: Stripe.Checkout.Session,
  expectedUserId?: number
): Promise<{ userId: number; customerId: string; cycle: 'monthly' | 'yearly' } | null> {
  if (!session.client_reference_id) return null;

  const reference = verifyPaymentLinkReference(session.client_reference_id);
  if (!reference || (expectedUserId !== undefined && reference.userId !== expectedUserId)) {
    return null;
  }

  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id;
  if (!customerId) return null;

  try {
    const result = await pool.query(
      `UPDATE users
       SET stripe_customer_id = $1
       WHERE id = $2
         AND (
           stripe_customer_id IS NULL
           OR stripe_customer_id = $1
           OR subscription_status IN ('canceled', 'incomplete_expired')
         )
       RETURNING id`,
      [customerId, reference.userId]
    );

    if (result.rows.length === 0) return null;
    return { userId: reference.userId, customerId, cycle: reference.cycle };
  } catch (error: any) {
    // The unique customer index protects against binding one Stripe customer
    // to two accounts if a malformed or replayed event is ever received.
    if (error?.code === '23505') return null;
    throw error;
  }
}