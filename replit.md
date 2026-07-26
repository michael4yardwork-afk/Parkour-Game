# Delta Rush

A high-speed 3D parkour racing game built for the web. Features a course builder, community-shared levels, competitive leaderboards, real-time multiplayer racing, and ghost replay racing.

## Stack

- **Frontend:** React 19 + TypeScript + Three.js (WebGL 3D), Vite dev server on port 5000
- **Backend:** Node.js + Express API on port 3001 (proxied via Vite `/api`)
- **Database:** PostgreSQL (external Supabase instance via `DATABASE_URL` secret)
- **Auth:** JWT tokens (signed with `JWT_SECRET` secret), bcrypt password hashing
- **Realtime:** WebSocket on `/ws` for multiplayer race matchmaking

## Running on Replit

The workflow `Start application` runs both servers in parallel:
```
npm install && (npm run server & npm run dev)
```

**Required secrets (set in Replit Secrets):**
| Secret | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase direct connection, port 5432) |
| `JWT_SECRET` | Secret for signing auth tokens |
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — used server-side to create/verify auth users |

The database schema is auto-initialized on server startup (`server/db.ts`). No manual migrations needed — new columns are added with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.

## Architecture

- `src/` — React frontend
  - `components/GameCanvas.tsx` — 3D game engine (Three.js), ghost replay system, physics
  - `components/Leaderboard.tsx` — world rankings + personal runs, ghost racing, velocity charts
  - `components/Races.tsx` — multiplayer race lobby
  - `App.tsx` — top-level routing and state
- `server/` — Express backend
  - `routes/leaderboard.ts` — run submission, ghost frame storage, rankings
  - `routes/auth.ts` — signup/login/JWT
  - `routes/community.ts` — community course publishing
  - `ws.ts` — WebSocket matchmaking server

## Ghost Replay System

- **PR ghost (blue wireframe):** Stored in `localStorage` as `ghost_replay_{levelId}`, updated on every new personal best
- **Race ghost (amber/orange solid):** Loaded from server when user clicks the ▶ "Race Ghost" button in the leaderboard. Frames are stored server-side (downsampled every 3rd frame) alongside each leaderboard entry. Both ghosts can be visible simultaneously.

## Account Recovery (Password Reset)

The recovery system uses Supabase's admin API + SMTP email to ensure the reset link always points to the real app URL (not localhost).

### Why the link used to go to localhost:3000
Supabase has a **Site URL** setting. If it's set to `localhost:3000`, every recovery email uses that URL — even when the code sends the correct app URL as `redirectTo`. The preferred fix is to either:
- **Configure SMTP** (recommended for full control), OR
- **Update the Supabase Site URL** in the dashboard

### Option A — Configure SMTP (fixes the redirect without dashboard changes)
Set these secrets in your deployment environment (Railway/Hostinger Variables or Replit Secrets):

| Secret | Example |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` or `smtp.resend.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` (use `true` for port 465) |
| `SMTP_USER` | your SMTP login |
| `SMTP_PASS` | Gmail app password or SMTP password |
| `SMTP_FROM` | `"Delta Rush <no-reply@deltarush.win>"` |

With SMTP configured, the server uses `supabaseAdmin.auth.admin.generateLink` (admin API, not subject to URL allowlist) to generate the recovery link with the correct app URL, then sends the email itself.

**Gmail:** Enable 2FA → generate an App Password at myaccount.google.com/apppasswords. Use `smtp.gmail.com`, port `587`.
**Resend:** Get a free API key at resend.com. Use `smtp.resend.com`, port `587`, user `resend`, pass = API key.

### Option B — Fix the Supabase Site URL (simplest if you only have one domain)
1. Go to your [Supabase project dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication → URL Configuration**
3. Change **Site URL** to your actual app URL (e.g. `https://deltarush.win`)
4. Add your app URL and Replit dev domain to **Redirect URLs**:
   - `https://deltarush.win`
   - `https://*.replit.dev` (covers all Replit dev domains)
5. Save changes

## User Preferences

- Keep existing project structure and stack
- Do not migrate the database to a different provider without explicit request
- Do not push to GitHub on the user's behalf — the user pushes manually themselves
