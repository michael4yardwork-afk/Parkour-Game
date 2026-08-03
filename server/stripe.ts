import Stripe from 'stripe';
import crypto from 'node:crypto';

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
  return (['monthly', 'yearly'] as const).every(cycle => {
    const link = cycle === 'monthly'
      ? process.env.STRIPE_PAYMENT_LINK_MONTHLY
      : process.env.STRIPE_PAYMENT_LINK_YEARLY;
    if (!link) return false;
    try {
      const parsed = new URL(link);
      return parsed.protocol === 'https:' && parsed.hostname === 'buy.stripe.com';
    } catch {
      return false;
    }
  });
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

type PaymentLinkReference = {
  userId: number;
  cycle: 'monthly' | 'yearly';
};

export function createPaymentLinkReference(userId: number, cycle: PaymentLinkReference['cycle']): string {
  const secret = paymentLinkReferenceSecret();
  if (!secret) throw new Error('JWT_SECRET or SESSION_SECRET is not configured.');
  const expiresAt = Math.floor(Date.now() / 1000) + 30 * 60;
  const payload = `${userId}:${cycle}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  // Stripe accepts only alphanumeric characters, dashes, and underscores in
  // client_reference_id. Keep the reference compact and independently signed.
  return `${userId}_${cycle}_${expiresAt}_${signature}`;
}

export function verifyPaymentLinkReference(reference: string): PaymentLinkReference | null {
  const secret = paymentLinkReferenceSecret();
  if (!secret) return null;

  const parts = reference.split('_');
  if (parts.length !== 4) return null;
  const [userIdText, cycle, expiresAtText, signature] = parts;
  if (
    !/^\d+$/.test(userIdText) ||
    (cycle !== 'monthly' && cycle !== 'yearly') ||
    !/^\d+$/.test(expiresAtText) ||
    !/^[A-Za-z0-9]+$/.test(signature)
  ) {
    return null;
  }

  const userId = Number(userIdText);
  const expiresAt = Number(expiresAtText);
  if (!Number.isSafeInteger(userId) || !Number.isSafeInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return null;
  }

  try {
    const payload = `${userId}:${cycle}:${expiresAt}`;
    const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const provided = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) {
      return null;
    }
    return { userId, cycle };
  } catch {
    return null;
  }
}
