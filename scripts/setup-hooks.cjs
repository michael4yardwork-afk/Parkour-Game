#!/usr/bin/env node
// Configures git to use the committed .githooks/ directory.
// Runs automatically via the postinstall npm script.
const { execSync } = require('child_process');
try {
  execSync('git config core.hooksPath .githooks', { stdio: 'inherit' });
  console.log('[setup-hooks] git hooks path set to .githooks');
} catch {
  // Not inside a git repo (e.g. CI install without .git) — silently skip.
}
