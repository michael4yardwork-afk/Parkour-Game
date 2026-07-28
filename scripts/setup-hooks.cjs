#!/usr/bin/env node
// Configures git to use the committed .githooks/ directory and wires the
// credential helper so HTTPS pushes to GitHub work after container rebuilds.
// Runs automatically via the postinstall npm script.
const { execSync } = require('child_process');
const path = require('path');

try {
  // Point git at the committed hooks directory.
  execSync('git config core.hooksPath .githooks', { stdio: 'inherit' });
  console.log('[setup-hooks] git hooks path set to .githooks');

  // Re-wire the GITHUB_TOKEN credential helper (survives container rebuilds
  // because GITHUB_TOKEN is stored as a Replit Secret).
  const repoRoot = path.resolve(__dirname, '..');
  const helperPath = path.join(repoRoot, 'scripts', 'git-credential-helper.sh');
  execSync(`git config credential.https://github.com.helper "${helperPath}"`, { stdio: 'inherit' });
  console.log('[setup-hooks] GitHub credential helper configured');

  // Always rebase (not merge) when pulling, to keep a clean linear history.
  execSync('git config pull.rebase true', { stdio: 'inherit' });
  console.log('[setup-hooks] pull.rebase set to true');
} catch {
  // Not inside a git repo (e.g. CI install without .git) — silently skip.
}
