---
name: Hostinger deployment architecture
description: How Hostinger actually serves the site and what must stay in git on main
---

# Hostinger Deploy Architecture

## How it works
- Hostinger deploys **directly from the `main` branch** — it serves `dist/` as-is from the repo.
- `dist/` and `server.cjs` **must be committed to `main`** for the site to load. Removing them from main breaks production immediately.
- There is also a `deploy.yml` GitHub Actions workflow that rebuilds and force-pushes to a `deploy` branch, but Hostinger does NOT use that branch.

## The stale-dist problem and its fix
- Before the fix, `package-lock.json` had Replit-internal npm URLs (`package-firewall.replit.local`) that broke `npm ci` on GitHub Actions, so the workflow never rebuilt dist/.
- Fix applied: replaced all internal URLs with `https://registry.npmjs.org/` via sed.
- Now `npm ci` works externally, so `dist/` can be rebuilt on any push.

## Rule: always rebuild before pushing to main
After any source code change, run `npm run build` and commit the result before pushing to main. Hostinger serves whatever dist/ is in main — stale dist = stale site.

**Why:** Hostinger shared/Node hosting can't run a build step; it serves the committed files directly.

**How to apply:** Any time you commit source changes, always run `npm run build` and `git add -f dist/ server.cjs` as part of the same commit. Never push source-only to main without rebuilding first.

## Lockfile maintenance
After any `npm install` inside Replit, run:
```bash
sed -i 's#http://package-firewall.replit.local/npm/#https://registry.npmjs.org/#g' package-lock.json
```
before committing, so external builds don't break.
