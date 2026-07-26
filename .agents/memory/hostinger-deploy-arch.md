---
name: Hostinger deployment architecture
description: How Hostinger actually serves the site and what must stay in git on main
---

# Hostinger Deploy Architecture

## How it works
- Hostinger deploys **directly from the `main` branch** — it serves `dist/` as-is from the repo.
- `dist/` and `server.cjs` **must be committed to `main`** for the site to load. Removing them from main breaks production immediately.
- Hostinger must deploy from `main`; do not route production through a separate `deploy` branch.

## Reliability constraints
- External CI must resolve dependencies from the public npm registry; Replit-internal registry hosts cannot be used outside Replit.
- The production start command must build from source before serving so Hostinger does not depend on a separately committed or separately generated `dist/` snapshot.

## Rule: build before serving on Hostinger
After any source code change, push the source to `main`; Hostinger's `npm start` build step regenerates `dist/` before serving.

**Why:** Hostinger's Node.js entrypoint runs the package `start` script, so building there prevents stale committed frontend artifacts from being served.

**How to apply:** Keep `npm start` as the Hostinger entrypoint and ensure it runs `npm run build` before the server process.

## Lockfile maintenance
After any `npm install` inside Replit, run:
```bash
sed -i 's#http://package-firewall.replit.local/npm/#https://registry.npmjs.org/#g' package-lock.json
```
before committing, so external builds don't break.
