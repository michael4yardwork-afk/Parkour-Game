---
name: Production deployment setup
description: How Delta Rush is configured for production Railway deployment with Neon PostgreSQL and Hostinger domain
---

# Production Deployment

## Architecture
- **Single Railway service** — Express server serves both `/api/*` routes and the built React frontend from `dist/`
- **Database** — Neon (free PostgreSQL, `neon.tech`). Connection via `DATABASE_URL` env var
- **Domain** — Hostinger domain pointed at Railway via DNS CNAME record

## Key config
- `server/index.ts`: In `NODE_ENV=production`, serves `dist/` as static + SPA fallback on `*`
- `package.json` `start` script: `tsx server/index.ts` (tsx is in dependencies, not just devDependencies)
- `PORT` env var: Railway injects this; server uses `process.env.PORT || 3001`
- `DATABASE_URL` missing → server exits with clear error message at startup

## Required env vars on Railway
- `DATABASE_URL` — Neon connection string
- `JWT_SECRET` — long random string
- `NODE_ENV` — `production`

## Build command on Railway
`npm run build` (builds Vite frontend to dist/) then `npm start`

**Why:** Shared Hostinger hosting can't run Node.js. Railway auto-deploys from GitHub on push — zero manual steps after initial setup. Domain works via DNS CNAME, not file transfer.
