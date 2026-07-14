import Stripe from 'stripe';

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

// Price IDs for the Platinum plan, created once in the merchant's Stripe
// account (see scripts/seed-stripe-products.ts) and stored as secrets.
export function getPriceId(cycle: 'monthly' | 'yearly'): string {
  const id = cycle === 'monthly' ? process.env.STRIPE_PRICE_MONTHLY : process.env.STRIPE_PRICE_YEARLY;
  if (!id) {
    throw new Error(`STRIPE_PRICE_${cycle.toUpperCase()} is not set — run scripts/seed-stripe-products.ts first.`);
  }
  return id;
}
