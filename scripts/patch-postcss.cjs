#!/usr/bin/env node
/**
 * Patches PostCSS lib/previous-map.js to fix the path-traversal vulnerability
 * (CVE: sourceMappingURL directory traversal allows reading arbitrary .map files).
 *
 * Root cause: loadFile() only checked the file extension (.map) but allowed
 * "../../../" traversal outside the CSS file's directory.
 *
 * Fix: after the extension check, resolve both the CSS directory and the
 * candidate map path and reject anything that escapes the CSS directory.
 *
 * This script is idempotent — safe to run multiple times.
 */

const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', 'postcss', 'lib', 'previous-map.js');

if (!fs.existsSync(target)) {
  console.log('[patch-postcss] postcss not found, skipping.');
  process.exit(0);
}

let src = fs.readFileSync(target, 'utf8');

// ── Patch 1: add resolve + sep to the path import ─────────────────────────
const OLD_IMPORT = `let { dirname, join } = require('path')`;
const NEW_IMPORT = `let { dirname, join, resolve, sep } = require('path')`;

// ── Patch 2: add sandbox guard inside loadFile() ──────────────────────────
const OLD_LOAD_FILE = `  loadFile(path, cssFile, trusted) {
    /* c8 ignore next 5 */
    if (!trusted && !this.unsafeMap) {
      if (!/\\.map$/i.test(path)) {
        return undefined
      }
    }
    this.root = dirname(path)`;

const NEW_LOAD_FILE = `  loadFile(path, cssFile, trusted) {
    /* c8 ignore next 5 */
    if (!trusted && !this.unsafeMap) {
      if (!/\\.map$/i.test(path)) {
        return undefined
      }
      if (!cssFile) return undefined
      let root = resolve(dirname(cssFile))
      let resolvedPath = resolve(root, path)
      if (resolvedPath !== root && !resolvedPath.startsWith(root + sep)) {
        return undefined
      }
    }
    this.root = dirname(path)`;

let patched = src;
let changed = false;

if (!src.includes('resolve, sep')) {
  if (!src.includes(OLD_IMPORT)) {
    console.error('[patch-postcss] ERROR: Could not locate path import line — PostCSS may have changed. Manual review required.');
    process.exit(1);
  }
  patched = patched.replace(OLD_IMPORT, NEW_IMPORT);
  changed = true;
}

// Normalise whitespace differences before matching by checking key sentinel
if (!patched.includes('resolvedPath.startsWith(root + sep)')) {
  if (!patched.includes(OLD_LOAD_FILE)) {
    console.error('[patch-postcss] ERROR: Could not locate loadFile() body — PostCSS may have changed. Manual review required.');
    process.exit(1);
  }
  patched = patched.replace(OLD_LOAD_FILE, NEW_LOAD_FILE);
  changed = true;
}

if (changed) {
  fs.writeFileSync(target, patched, 'utf8');
  console.log('[patch-postcss] Applied path-traversal sandbox fix to postcss/lib/previous-map.js');
} else {
  console.log('[patch-postcss] postcss/lib/previous-map.js already patched, nothing to do.');
}
