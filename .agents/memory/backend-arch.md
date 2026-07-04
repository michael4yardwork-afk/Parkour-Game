---
name: Backend architecture
description: Express + PostgreSQL backend setup for Delta Rush, proxied via Vite, JWT auth.
---

## Setup
- Express API runs on port 3001 (`npm run server` → `tsx server/index.ts`)
- Vite dev server on port 5000 proxies `/api/*` to `http://localhost:3001`
- Frontend uses relative `/api` base URL (not hardcoded localhost)
- Both "Start application" (webview, port 5000) and "Backend server" (console, port 3001) workflows must be running

## Auth
- JWT token stored in `localStorage` as `delta_rush_token`
- `src/api.ts` auto-attaches token via `authHeaders()`
- bcrypt for password hashing in `server/routes/auth.ts`
- JWT_SECRET env var with fallback hardcoded default

## Data split
- **Backend DB**: users, leaderboard_entries, community_courses, course_likes, course_bookmarks, notifications, user_follows, race_history, user_ratings
- **LocalStorage (stays local)**: `best_time_<levelId>`, `ghost_replay_<levelId>`, `custom_parkour_levels` (draft courses), `momentum_builder_draft`, `momentum_current_user` (session cache), `delta_rush_token`

**Why:** Personal best times and ghost replays are private/device-specific. Draft courses (unpublished) live locally to avoid server round-trips during editing.

## Important quirk
- Backend must bind on `0.0.0.0` not `localhost` for Replit's port detection to work
- Leaderboard submit failures are gracefully caught with `console.warn` to not interrupt game flow
