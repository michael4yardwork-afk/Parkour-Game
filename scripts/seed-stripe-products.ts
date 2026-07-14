/**
 * One-time setup script: creates the "Delta Rush Platinum" product and its
 * monthly/yearly recurring prices in your own Stripe account.
 *
 * Usage:
 *   npx tsx scripts/seed-stripe-products.ts
 *
 * Requires STRIPE_SECRET_KEY to be set. Prints the created price IDs —
 * copy them into the STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY secrets.
 *
 * Safe to re-run: if a "Delta Rush Platinum" product already exists, it
 * reuses it and only creates prices that don't already exist yet.
 */
import 'dotenv/config';
import Stripe from 'stripe';

const PRODUCT_NAME = 'Delta Rush Platinum';
const MONTHLY_AMOUNT = 299; // $2.99
const YEARLY_AMOUNT = 2499; // $24.99

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error('STRIPE_SECRET_KEY is not set.');
    process.exit(1);
  }
  const stripe = new Stripe(key);

  const existing = await stripe.products.search({ query: `name:'${PRODUCT_NAME}'` });
  let product = existing.data[0];
  if (!product) {
    product = await stripe.products.create({
      name: PRODUCT_NAME,
      description: 'Unlimited course publishing, ghost racing, performance graphs, and more.',
    });
    console.log('Created product:', product.id);
  } else {
    console.log('Reusing existing product:', product.id);
  }

  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });

  let monthly = prices.data.find(
    (p) => p.recurring?.interval === 'month' && p.unit_amount === MONTHLY_AMOUNT
  );
  if (!monthly) {
    monthly = await stripe.prices.create({
      product: product.id,
      unit_amount: MONTHLY_AMOUNT,
      currency: 'usd',
      recurring: { interval: 'month' },
      nickname: 'Platinum Monthly',
    });
    console.log('Created monthly price:', monthly.id);
  } else {
    console.log('Reusing existing monthly price:', monthly.id);
  }

  let yearly = prices.data.find(
    (p) => p.recurring?.interval === 'year' && p.unit_amount === YEARLY_AMOUNT
  );
  if (!yearly) {
    yearly = await stripe.prices.create({
      product: product.id,
      unit_amount: YEARLY_AMOUNT,
      currency: 'usd',
      recurring: { interval: 'year' },
      nickname: 'Platinum Yearly',
    });
    console.log('Created yearly price:', yearly.id);
  } else {
    console.log('Reusing existing yearly price:', yearly.id);
  }

  console.log('\nSet these as secrets:');
  console.log(`STRIPE_PRICE_MONTHLY=${monthly.id}`);
  console.log(`STRIPE_PRICE_YEARLY=${yearly.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
