import Stripe from 'stripe';
import jwt from 'jsonwebtoken';

let stripeClient: Stripe | null = null;

/**
 * Lazily-initialized Stripe client using the merchant's own Stripe account
 * (secret key provided via the STRIPE_SECRET_KEY secret). This project does
 * NOT use Replit's managed Stripe integration — keys are supplied directly
 * by the project owner.
 */
export function getStripeClient(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set — Stripe billing is disabled.');
    }
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

export function isPaymentLinksConfigured(): boolean {
  return Boolean(process.env.STRIPE_PAYMENT_LINK_MONTHLY && process.env.STRIPE_PAYMENT_LINK_YEARLY);
}

export function getPaymentLink(cycle: 'monthly' | 'yearly'): string {
  const link = cycle === 'monthly'
    ? process.env.STRIPE_PAYMENT_LINK_MONTHLY
    : process.env.STRIPE_PAYMENT_LINK_YEARLY;
  if (!link) {
    throw new Error(`STRIPE_PAYMENT_LINK_${cycle.toUpperCase()} is not set.`);
  }

  try {
    const parsed = new URL(link);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'buy.stripe.com') {
      throw new Error('Payment link must be a Stripe Payment Link URL.');
    }
  } catch {
    throw new Error(`STRIPE_PAYMENT_LINK_${cycle.toUpperCase()} must be a valid https://buy.stripe.com/ URL.`);
  }

  return link;
}

function paymentLinkReferenceSecret(): string {
  return process.env.JWT_SECRET || process.env.SESSION_SECRET || '';
}

export function createPaymentLinkReference(userId: number): string {
  const secret = paymentLinkReferenceSecret();
  if (!secret) throw new Error('JWT_SECRET or SESSION_SECRET is not configured.');
  return jwt.sign(
    { purpose: 'stripe_payment_link', userId: String(userId) },
    secret,
    { expiresIn: '30m' }
  );
}

export function verifyPaymentLinkReference(reference: string): number | null {
  const secret = paymentLinkReferenceSecret();
  if (!secret) return null;
  try {
    const payload = jwt.verify(reference, secret) as { purpose?: string; userId?: string };
    if (payload.purpose !== 'stripe_payment_link' || !payload.userId || !/^\d+$/.test(payload.userId)) {
      return null;
    }
    return Number(payload.userId);
  } catch {
    return null;
  }
}
