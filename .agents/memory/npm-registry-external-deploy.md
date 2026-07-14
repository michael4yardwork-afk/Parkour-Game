---
name: npm registry breaks external deploys
description: Replit's internal npm proxy (package-firewall.replit.local) can get baked into a committed package-lock.json, breaking npm install on external hosts (Railway, Hostinger, etc).
---

Replit sets `NPM_CONFIG_REGISTRY`/`npm_config_registry` to an internal proxy
(`http://package-firewall.replit.local/npm/`) for all npm installs run inside
the Replit container. If `package-lock.json` is regenerated inside Replit
(e.g. `rm -f package-lock.json && npm install`, or any fresh `npm install`
that rewrites `resolved` fields) and then committed, every `resolved` URL in
the lockfile points at that Replit-only hostname. External build hosts
(Railway, Hostinger, Vercel, CI, etc.) can't resolve it, so `npm ci`/`npm
install` fails there with `ENOTFOUND package-firewall.replit.local` even
though the build works fine inside Replit.

**Why:** the registry override is env-based, not project config, so it's
invisible when reading the repo — the only symptom is external-only build
failures with an unfamiliar hostname in the error.

**How to apply:** if an external deploy fails with an ENOTFOUND/DNS error
mentioning `package-firewall.replit.local` (or similar internal-looking
hostnames) in `package-lock.json`, fix by rewriting the `resolved` URLs back
to the public registry, e.g.:
`sed -i 's#http://package-firewall\.replit\.local/npm/#https://registry.npmjs.org/#g' package-lock.json`
then verify with `npm ci` using an explicit public registry
(`NPM_CONFIG_REGISTRY=https://registry.npmjs.org/ npm ci`) before committing.
Integrity hashes are unaffected since the tarball content is identical either
way.
