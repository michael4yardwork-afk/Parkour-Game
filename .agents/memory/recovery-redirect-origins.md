---
name: Recovery redirect origins
description: Password-reset redirect handling behind Replit's Vite/Express proxy
---

Password-recovery links must resolve to the public browser/deployment origin rather than the backend request host. The backend may see an internal localhost host behind the proxy, while the browser has the reachable Replit or production origin.

**Why:** Supabase recovery emails generated from the proxied backend previously redirected users to `localhost`, which is not reachable from the user's browser.

**How to apply:** Have the browser send its current origin, validate it against configured public deployment origins (`APP_URL`, `REPLIT_DEV_DOMAIN`, or `REPLIT_DOMAINS`), and only allow localhost when explicitly running standalone local development. Keep the reset token in the URL hash until the frontend consumes it, then remove it from the address bar.