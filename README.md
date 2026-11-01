# Delta Rush

A high-speed 3D parkour racing game built for the web. Features a course builder, community-shared levels, competitive leaderboards, and a race mode.

**Stack:** React 19 + TypeScript + Three.js (frontend) · Node.js + Express (backend) · PostgreSQL

---

## Deploy to Railway (recommended)

Railway deploys automatically from GitHub on every push. The Express server serves both the API and the built React frontend from a single service.

### 1. Get your Supabase connection string

1. Go to your [Supabase project dashboard](https://supabase.com/dashboard)
2. Navigate to **Settings → Database → Connection string → URI**
3. Copy the **Direct connection** string (port 5432) — it looks like:
   `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres`

   > Use the **direct connection** (port 5432), not the transaction pooler (port 6543), since the app manages its own connection pool via `pg.Pool`.

### 2. Deploy to Railway

1. Go to [railway.app](https://railway.app) and sign up with GitHub
2. Click **New Project → Deploy from GitHub repo** and select this repository
3. Railway will detect Node.js automatically. Set the following in **Variables**:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Paste your Supabase direct connection string |
   | `JWT_SECRET` | A long random string (generate at [generate-secret.vercel.app/64](https://generate-secret.vercel.app/64)) |
   | `APP_URL` | The public HTTPS URL of this app, for example `https://deltarush.win` |
   | `NODE_ENV` | `production` |

4. In **Settings → Build & Deploy**, confirm:
   - **Build command:** `npm run build`
   - **Start command:** `npm start`
5. Click **Deploy**. Railway builds the frontend, starts the server, and gives you a public URL.

### 3. Point your Hostinger domain to Railway

1. In Railway, go to your service → **Settings → Networking → Custom Domain** → add your domain (e.g. `deltarush.win`)
2. In Hostinger DNS settings, add a **CNAME record**:
   - **Name:** `@` (or `www`)
   - **Value:** the Railway domain shown (e.g. `xyz.up.railway.app`)
3. DNS propagates within a few minutes. Your domain will now serve the app.

### Hostinger Node.js deployment

If running the app directly on Hostinger instead of pointing DNS to Railway:

1. Upload the complete project, including `dist/` and the generated `server.cjs`.
2. Run `npm install` and `npm run build` after every code update.
3. Start the app with `npm start` (the current server is `dist/index.cjs`).
4. Configure these environment variables in Hostinger's Node.js application settings
   or in a server-side `.env` file:

   | Variable | Purpose |
   |---|---|
   | `DATABASE_URL` | PostgreSQL connection string |
   | `JWT_SECRET` | Long random JWT signing secret |
   | `STRIPE_SECRET_KEY` | Stripe secret API key |
   | `STRIPE_WEBHOOK_SECRET` | Signing secret for the webhook endpoint |
   | `STRIPE_PAYMENT_LINK_MONTHLY` | Live monthly Platinum Payment Link |
   | `STRIPE_PAYMENT_LINK_YEARLY` | Live yearly Platinum Payment Link |
   | `SUPABASE_URL` | Supabase project URL |
   | `SUPABASE_ANON_KEY` | Supabase public anon/publishable key used for recovery emails |
   | `APP_URL` | Public HTTPS app URL, for example `https://deltarush.win` |
   | `NODE_ENV` | `production` |

### Production security settings

- `APP_URL` should be the canonical HTTPS origin and must also be allowed as a
  redirect URL in Supabase Auth. Use `ALLOWED_ORIGINS` for any additional
  exact origins; wildcard CORS is disabled.
- Forwarded proxy headers are trusted only for the peer IPs listed in
  `TRUSTED_PROXY_IPS`. Use exact addresses documented by the hosting provider;
  do not add a wildcard. If the hosting proxy does not provide stable peer IPs,
  leave this unset and configure rate limiting with the platform's supported
  trusted-proxy mechanism before scaling beyond one server.
- PostgreSQL TLS certificate verification is enabled by default.
  `DATABASE_SSL_CA` can hold a provider CA certificate. `DATABASE_SSL=false`
  is rejected in production and should only be used for local development.
- The server applies idempotent, additive schema changes at startup, including
  session versioning, reset-link replay protection, shared rate limits, and
  Stripe webhook event receipts. No existing account or purchase rows are
  deleted by these changes.

5. In Stripe, configure the webhook URL as:
   `https://your-domain.example/api/billing/webhook`
   and enable `checkout.session.completed`, `customer.subscription.created`,
   `customer.subscription.updated`, `customer.subscription.deleted`, and
   `invoice.payment_succeeded`.

The server loads `.env` when present, but Hostinger environment variables are
preferred. Do not expose Stripe secret values in frontend code.

After changing recovery code or environment variables, rebuild and restart the
deployed server before requesting a new recovery email. Check
`https://your-domain.example/api/health`: `recovery.supabaseRecoveryConfigured`
must be `true`, `recovery.appUrlConfigured` must be `true`, and
`recovery.appUrlIsLocalhost` must be `false`. Existing emails cannot be
repaired because their redirect destination is already embedded in the link.

Verify the Hostinger runtime before testing a purchase by opening
`https://your-domain.example/api/health`. The response must show both Payment
Link flags and both Stripe secret flags as `true`. If either Stripe secret is
`false`, Platinum cannot activate.

---

## Run locally

**Prerequisites:** Node.js 20+, a PostgreSQL database

```bash
# 1. Install dependencies
npm install

# 2. Copy the example env file and fill in your values
cp .env.example .env
# Edit .env — set DATABASE_URL and JWT_SECRET

# 3. Start the backend and frontend dev servers
npm run server &   # Express API on :3001
npm run dev        # Vite dev server on :5000
```

Open [http://localhost:5000](http://localhost:5000).

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `JWT_SECRET` | ✅ | Secret for signing auth tokens |
| `NODE_ENV` | production only | Set to `production` when deploying |
| `APP_URL` | recommended | Public HTTPS app URL used for password-recovery redirects |
| `STRIPE_CUSTOMER_PORTAL_URL` | recommended | Public Stripe Customer Portal login link read at runtime by the Upgrade tab |
| `VITE_STRIPE_CUSTOMER_PORTAL_URL` | recommended | Public Stripe Customer Portal login link shown in the Upgrade tab; set before building the frontend |
