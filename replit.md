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

## Hostinger deployment sync

Hostinger deploys from the `main` branch. The `npm start` script rebuilds both the frontend and bundled server before launching, so a Hostinger deployment always generates `dist/` from the source files currently on `main`.

The GitHub Actions workflows are kept unchanged so normal Replit GitHub authentication can push without requiring the special GitHub OAuth `workflow` scope. Do not change the Hostinger source branch to the temporary `deploy` branch.

**Required secrets (set in Replit Secrets):**
| Secret | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase direct connection, port 5432) |
| `JWT_SECRET` | Secret for signing auth tokens |
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_ANON_KEY` | Supabase public anon/publishable key used for recovery emails |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key — used server-side to create/verify auth users |
| `APP_URL` | Public HTTPS URL used for recovery redirects |

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

The recovery system uses Supabase's native password-recovery email when
`SUPABASE_URL` and `SUPABASE_ANON_KEY` are configured. Supabase sends a signed
recovery link, and the app synchronizes the new password to both Supabase Auth
and the local account before logging the user in.

If the public Supabase settings are unavailable, the legacy 6-digit code path
requires SMTP settings (`SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS`) and is kept
as a fallback for existing deployments. Replit Secrets do not automatically
sync to a separately hosted Hostinger server; configure the same values in
Hostinger's Node.js environment.

### Why the link used to go to localhost:3000
Supabase has a **Site URL** setting. If it's set to `localhost:3000`, every recovery email can use that URL — even when the code sends the correct app URL as `redirectTo`. The app now refuses to send a production recovery request unless it has a trusted public origin, but Supabase still requires that origin to be allowlisted:
- **Configure SMTP** (recommended for full control), OR
- **Update the Supabase Site URL** in the dashboard

The app now sends the browser's current public origin and also honors forwarded
public hosts when it is behind a proxy. In Supabase, the destination still must
be allowed under **Authentication → URL Configuration → Redirect URLs**:

1. Set **Site URL** to the app's real public URL (not `localhost:3000`).
2. Add the same public URL as a redirect URL.
3. For Replit development, add the current `https://<your-repl-domain>.replit.dev`
   URL as a redirect URL.

Existing emails that already contain `http://localhost:3000` cannot be repaired
after they were generated; request a new recovery email after updating the
Supabase URL configuration and redeploying the backend. Changes made in this
Replit workspace do not update a separately hosted Railway/Hostinger server
until that deployment rebuilds from the updated source.

### Legacy option — Configure SMTP (only if native Supabase recovery is unavailable)
Set these secrets in your deployment environment (Railway/Hostinger Variables or Replit Secrets):

| Secret | Example |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` or `smtp.resend.com` |
| `SMTP_PORT` | `587` |
| `SMTP_SECURE` | `false` (use `true` for port 465) |
| `SMTP_USER` | your SMTP login |
| `SMTP_PASS` | Gmail app password or SMTP password |
| `SMTP_FROM` | `"Delta Rush <no-reply@deltarush.win>"` |

Supabase must have the app origin configured under **Authentication → URL
Configuration**. Set the **Site URL** to the deployed app URL and add the
Replit development URL to **Redirect URLs** while testing. The server sends the
browser's current public origin as `redirectTo`, after validating it against
the deployment origin.

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

## Pushing to GitHub

### How it works

Every `git push` runs a pre-push hook (`.githooks/pre-push`) that does two things automatically:

1. **Syncs with remote** — fetches `origin/main` and rebases your local commits on top, so you never push stale code.
2. **Rebuilds `dist/`** — runs `npm run build` and, if the output changed, commits the updated `dist/` and `server.cjs` as a separate `build: update dist for deployment` commit. This keeps the Hostinger deployment in sync without any manual steps.

### Why pushes were failing (and the fix)

The old hook used `git commit --amend` to fold the build output into your last commit. Amending rewrites the commit's SHA — but git had already resolved that SHA before running the hook, so it tried to push the old (now non-existent) SHA and got a non-fast-forward rejection.

The fix: the hook now creates a **new** commit for the build output instead of amending. Git sees a clean linear history and the push succeeds every time.

### If a push still fails

| Error message | Cause | Fix |
|---|---|---|
| `Updates were rejected … non-fast-forward` | Someone else pushed to `main` between your last pull and your push | Run `git pull` (it will rebase automatically), then push again |
| `error: GITHUB_TOKEN secret is not set` | The `GITHUB_TOKEN` Replit Secret is missing or expired | Go to **Tools → Secrets** in Replit and add/refresh `GITHUB_TOKEN` with a valid GitHub personal access token (needs `repo` scope) |
| `Rebase failed. Resolve conflicts` | Your changes conflict with commits already on `main` | Follow the on-screen instructions: fix conflicts → `git add` → `git rebase --continue` → push again |
| Build errors during hook | `npm run build` failed | Fix the TypeScript/build error, commit, then push again |

### Never amend commits that have already been pushed

Amending a commit that exists on the remote will always cause a non-fast-forward failure. If you need to change the last commit after pushing, make a new commit instead.

---

## User Preferences

- Keep existing project structure and stack
- Do not migrate the database to a different provider without explicit request
- Do not push to GitHub on the user's behalf — the user pushes manually themselves
