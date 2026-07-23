---
name: Billing account isolation
description: Payment ownership is bound to immutable account IDs and Stripe customer IDs, not client-selected usernames.
---

Billing state and payment history must be resolved from a verified token to the
current `users.id`; never accept a username or account ID from the browser as
the owner of billing data. Stripe webhooks must map ownership through the
stored Stripe customer ID and payment history must filter by `user_id`.

**Why:** Payment records and subscription entitlements are sensitive account
data; mutable usernames and client-supplied identity create cross-account
disclosure and entitlement risks.

**How to apply:** Keep checkout, billing status, history, and webhook updates
server-authoritative. New tokens should carry the immutable account ID, and
legacy rows may be backfilled only on an exact verified account match.

Checkout completion must also reconcile the completed Stripe session server-side
and billing status should reconcile the stored customer with Stripe when
possible; webhook delivery alone is too asynchronous to drive immediate UI
entitlement activation.

**Why:** A successful Checkout redirect can arrive before a webhook, or a
webhook can be delayed or retried, leaving the client showing free-tier
features even though Stripe has an active subscription.

**How to apply:** Include Stripe's checkout session ID in the success redirect,
validate its customer against the authenticated account, sync the subscription,
then keep webhook processing for renewals, cancellations, and later changes.

Direct Hostinger deployments must rebuild and run the current generated bundle,
and must provide both Stripe secrets at runtime; price IDs alone do not enable
checkout or entitlement activation.

**Why:** The Hostinger startup artifact can lag behind `dist/index.cjs`, and a
missing `STRIPE_SECRET_KEY` disables all payment operations even when price IDs
are present.

**How to apply:** Run `npm run build` (which refreshes both production
entrypoints), use `npm start`, and verify `/api/health` reports all billing
configuration flags as true.