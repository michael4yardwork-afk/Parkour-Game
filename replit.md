# Delta Rush

A high-speed 3D parkour racing game built for the web. Features a course builder, community-shared levels, competitive leaderboards, real-time multiplayer racing, and ghost replay racing.

## Stack

- **Frontend:** React 19 + TypeScript + Three.js (WebGL 3D), Vite dev server on port 5000
- **Backend:** Node.js + Express API on port 3001 (proxied via Vite `/api`)
- **Database:** PostgreSQL (external Neon instance via `DATABASE_URL` secret)
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
| `DATABASE_URL` | PostgreSQL connection string (Neon or any PostgreSQL provider) |
| `JWT_SECRET` | Secret for signing auth tokens |

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

## User Preferences

- Keep existing project structure and stack
- Do not migrate the database to a different provider without explicit request
