# Delta Rush Payment and Account Threat Model

## Scope

This review covers local account authentication, the Express API, PostgreSQL,
Stripe Checkout, Stripe webhooks, and the account payment-history screen.

## Assets

- Account credentials, JWT session tokens, and email addresses.
- Stripe customer and subscription identifiers.
- Subscription state and payment/lifecycle history.
- Platinum entitlements and account-owned course limits.
- Stripe secret and webhook-signing secrets.

## Trust Boundaries

1. **Browser → API:** the browser is untrusted. Checkout cycle, account identity,
   and payment-history requests must be validated server-side.
2. **API → PostgreSQL:** account and payment queries use parameterized SQL.
   Billing history is filtered by the authenticated immutable account ID.
3. **API → Stripe:** Stripe secret operations occur only on the server.
   Checkout sessions are created for the account's stored Stripe customer.
4. **Stripe → API webhook:** only verified Stripe webhook payloads may update
   subscription state or append payment history.
5. **Authenticated account → another account:** no billing endpoint accepts a
   user-selected account ID or username for ownership.

## Security Guarantees

- New JWTs contain the database account ID and are signed with the configured
  `JWT_SECRET` or `SESSION_SECRET`; insecure hard-coded signing fallbacks are
  not used.
- Billing status, checkout, and payment history resolve the account from the
  verified token and query by `users.id`.
- Each account has its own stored Stripe customer ID. Checkout metadata carries
  the account ID, while webhook ownership is resolved from Stripe customer ID.
- Payment history rows carry `platinum_purchases.user_id`; legacy rows are
  backfilled only on an exact username match and unmatched rows are hidden.
- Replayed webhook events are idempotent through the payment-event primary key.
- Webhook signatures are verified against the raw request body before JSON
  parsing.
- A payment history request returns only the current account's rows and never
  exposes Stripe IDs or internal usernames.

## Residual Risks and Operational Requirements

- Production must configure `JWT_SECRET` or `SESSION_SECRET`, Stripe secrets,
  `DATABASE_URL`, and a trusted `APP_URL`.
- Stripe webhook delivery must remain configured with the matching signing
  secret and should be monitored for failed deliveries.
- Existing legacy JWTs without an account ID are accepted only after signature
  verification and database username resolution; users should be prompted to
  log in again after a secret rotation.
- The application should use HTTPS in production and keep secrets out of
  client bundles and logs.

## Scan Anchors

- `server/authIdentity.ts` — token verification and account resolution.
- `server/routes/billing.ts` — checkout, status, and account-scoped history.
- `server/routes/stripeWebhook.ts` — signature verification and ownership sync.
- `server/db.ts` — billing schema and legacy payment-row binding.