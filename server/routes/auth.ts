import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import pool from '../db';
import { supabaseAdmin } from '../supabase';
import { getAuthenticatedAccount, signAuthToken } from '../authIdentity';
import { isConfigured as smtpConfigured, sendMail } from '../email';

const router = Router();

function originFromUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function isLocalOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
  } catch {
    return true;
  }
}

function configuredPublicOrigins(): Set<string> {
  const origins = new Set<string>();

  for (const domain of [
    process.env.REPLIT_DEV_DOMAIN,
    ...(process.env.REPLIT_DOMAINS || '').split(','),
  ]) {
    if (!domain?.trim()) continue;
    const origin = originFromUrl(
      domain.trim().startsWith('http') ? domain.trim() : `https://${domain.trim()}`
    );
    if (origin) origins.add(origin);
  }

  const configuredUrl = originFromUrl(process.env.APP_URL);
  if (
    configuredUrl &&
    (!isLocalOrigin(configuredUrl) || process.env.NODE_ENV !== 'production')
  ) {
    origins.add(configuredUrl);
  }

  return origins;
}

function forwardedPublicOrigin(req: Request): string | null {
  const forwardedProto = String(req.get('x-forwarded-proto') || '')
    .split(',')[0]
    .trim();
  const forwardedHost = String(req.get('x-forwarded-host') || '')
    .split(',')[0]
    .trim();

  if (
    (forwardedProto !== 'http' && forwardedProto !== 'https') ||
    !forwardedHost
  ) {
    return null;
  }

  return originFromUrl(`${forwardedProto}://${forwardedHost}`);
}

function recoveryRedirectOrigin(req: Request, requestedRedirectTo: unknown): string {
  const requestedOrigin = originFromUrl(requestedRedirectTo);
  const configuredOrigins = configuredPublicOrigins();
  const forwardedOrigin = forwardedPublicOrigin(req);
  const requestOrigin = originFromUrl(`${req.protocol}://${req.get('host')}`);
  const publicRequestOrigin = forwardedOrigin ?? requestOrigin;

  // The frontend supplies window.location.origin. Accept it only when it is
  // one of the deployment's known origins. When no public origin is
  // configured, only accept the origin that the request itself arrived on;
  // this prevents an arbitrary body value from becoming an open redirect.
  if (requestedOrigin && configuredOrigins.has(requestedOrigin)) {
    return requestedOrigin;
  }
  if (
    requestedOrigin &&
    configuredOrigins.size === 0 &&
    publicRequestOrigin === requestedOrigin
  ) {
    return requestedOrigin;
  }

  const configuredUrl = originFromUrl(process.env.APP_URL);
  if (
    configuredUrl &&
    (!isLocalOrigin(configuredUrl) || process.env.NODE_ENV !== 'production')
  ) {
    return configuredUrl;
  }
  if (configuredOrigins.size > 0) return [...configuredOrigins][0];

  // A forwarded public origin is the safest fallback behind a reverse proxy.
  if (forwardedOrigin) return forwardedOrigin;

  // Keep standalone local development working. A non-local request origin
  // without an explicit public URL is unsafe because it may be an internal
  // host supplied by a reverse proxy. Fail instead of sending a broken email.
  if (requestOrigin && isLocalOrigin(requestOrigin)) return requestOrigin;
  throw new Error('No safe public recovery origin is configured.');
}

router.get('/check-username', async (req: Request, res: Response) => {
  const { username } = req.query;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Missing username.' });
  }
  try {
    const result = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    res.json({ taken: result.rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/signup', async (req: Request, res: Response) => {
  try {
    const { username, password, avatar, avatarBg, device, email } = req.body;

    if (!username || !password || username.length < 3 || password.length < 6) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    // Check username uniqueness
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username is already taken.' });
    }

    // Check email uniqueness
    const emailCheck = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    // Create Supabase auth user (email + password)
    let supabaseUserId: string | null = null;
    if (supabaseAdmin) {
      try {
        const { data: sbData, error: sbError } = await supabaseAdmin.auth.admin.createUser({
          email: email.toLowerCase().trim(),
          password,
          email_confirm: true, // mark as confirmed — we handle our own verification
          user_metadata: { username }
        });
        if (sbError) {
          console.error('[supabase] createUser error:', sbError.message);
          // If email already exists in Supabase, surface a clear error
          if (sbError.message?.toLowerCase().includes('already')) {
            return res.status(409).json({ error: 'An account with that email already exists.' });
          }
          // Other Supabase errors are non-fatal — we still create the local account
        } else {
          supabaseUserId = sbData.user?.id ?? null;
        }
      } catch (sbErr: any) {
        console.error('[supabase] createUser exception:', sbErr?.message || sbErr);
        // Non-fatal: continue with local account creation
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, avatar, avatar_bg, device, created_at, email, supabase_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, username, avatar, avatar_bg, device, created_at`,
      [
        username,
        passwordHash,
        avatar || '🚀',
        avatarBg || 'bg-indigo-500',
        device || null,
        Date.now(),
        email.toLowerCase().trim(),
        supabaseUserId
      ]
    );

    const user = result.rows[0];
    const token = signAuthToken({ id: user.id, username: user.username });

    res.json({
      token,
      user: {
        username: user.username,
        avatar: user.avatar,
        avatarBg: user.avatar_bg,
        device: user.device ?? null,
        createdAt: parseInt(user.created_at),
        passwordHash: ''
      }
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Internal server error during sign up.' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Account not found. Check spelling or create a new account.' });
    }

    const user = result.rows[0];

    // Primary verification: bcrypt (always runs, works for all accounts)
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid password. Please inspect your inputs and try again.' });
    }

    // Secondary: sync with Supabase auth for accounts that have an email + Supabase user
    // This is fire-and-forget — a Supabase failure never blocks login
    if (supabaseAdmin && user.email && user.supabase_user_id) {
      supabaseAdmin.auth.signInWithPassword({
        email: user.email,
        password
      }).then(({ error }) => {
        if (error) {
          console.warn('[supabase] signInWithPassword sync failed:', error.message);
        }
      }).catch((e: any) => {
        console.warn('[supabase] signInWithPassword exception:', e?.message || e);
      });
    }

    const token = signAuthToken({ id: user.id, username: user.username });

    res.json({
      token,
      user: {
        username: user.username,
        avatar: user.avatar,
        avatarBg: user.avatar_bg,
        device: user.device ?? null,
        createdAt: parseInt(user.created_at),
        passwordHash: ''
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

router.get('/user/:username', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT username, avatar, avatar_bg, created_at FROM users WHERE LOWER(username) = LOWER($1)',
      [req.params.username]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const u = result.rows[0];
    res.json({
      username: u.username,
      avatar: u.avatar,
      avatarBg: u.avatar_bg,
      createdAt: parseInt(u.created_at),
      passwordHash: ''
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── Account Recovery ─────────────────────────────────────────────────────────

// Maximum failed verify/reset attempts before a code is locked out.
const MAX_CODE_ATTEMPTS = 5;
// Maximum new code requests per email per 15-minute window.
const MAX_CODE_REQUESTS_PER_WINDOW = 3;
// Window duration in ms (must match the code TTL).
const CODE_WINDOW_MS = 15 * 60 * 1000;

/** Generate a cryptographically random 6-digit code (000000–999999). */
function generateResetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

// POST /api/auth/forgot-password
// Accepts { email }, generates a 6-digit verification code, persists it, and
// emails it to the user. Always returns 200 with a generic message so callers
// cannot distinguish "email found" from "email not found" (enumeration guard).
// Rate-limited to MAX_CODE_REQUESTS_PER_WINDOW requests per email per window.
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Look up user — if not found, still return success to avoid email enumeration
    const userResult = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (userResult.rows.length > 0) {
      // Rate-limit: count how many codes were issued in the current window
      const windowStart = Date.now() - CODE_WINDOW_MS;
      const recentCount = await pool.query(
        'SELECT COUNT(*) FROM password_reset_codes WHERE email = $1 AND created_at > $2',
        [normalizedEmail, windowStart]
      );
      if (parseInt(recentCount.rows[0].count, 10) >= MAX_CODE_REQUESTS_PER_WINDOW) {
        // Return the same generic message — don't reveal the rate-limit to callers
        return res.json({ message: 'If an account with that email exists, a 6-digit verification code has been sent.' });
      }

      const code = generateResetCode();
      const expiresAt = Date.now() + CODE_WINDOW_MS;

      // Invalidate any previous unused codes for this email
      await pool.query(
        'UPDATE password_reset_codes SET used = TRUE WHERE email = $1 AND used = FALSE',
        [normalizedEmail]
      );

      // Store the new code
      await pool.query(
        'INSERT INTO password_reset_codes (email, code, expires_at) VALUES ($1, $2, $3)',
        [normalizedEmail, code, expiresAt]
      );

      if (!smtpConfigured) {
        // Do not report success after persisting a code that the user cannot
        // receive. Remove it so the next request can retry after mail is fixed.
        await pool.query(
          'DELETE FROM password_reset_codes WHERE email = $1 AND code = $2',
          [normalizedEmail, code]
        );
        console.error(
          '[auth] forgot-password unavailable: SMTP_HOST, SMTP_USER, and SMTP_PASS are required to send recovery email.'
        );
        return res.status(503).json({
          error: 'Account recovery email is temporarily unavailable. Please contact the site administrator.'
        });
      }

      try {
        await sendMail({
          to: normalizedEmail,
          subject: 'Your Delta Rush verification code',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#6366f1">Delta Rush — Password Reset</h2>
              <p>Someone requested a password reset for your account. Use the code below to verify your identity and set a new password.</p>
              <div style="margin:32px 0;text-align:center">
                <span style="display:inline-block;background:#1e1b4b;color:#a5b4fc;font-size:36px;font-weight:700;letter-spacing:12px;padding:16px 32px;border-radius:12px;border:2px solid #4f46e5;font-family:monospace">
                  ${code}
                </span>
              </div>
              <p style="color:#888;font-size:13px">
                This code expires in <strong>15 minutes</strong>. If you didn't request a reset, you can safely ignore this email.
              </p>
              <p style="color:#888;font-size:13px">
                Never share this code with anyone.
              </p>
            </div>
          `,
          text: `Your Delta Rush password reset code is: ${code}\n\nThis code expires in 15 minutes. If you didn't request a reset, ignore this email.`,
        });
      } catch (mailError) {
        await pool.query(
          'DELETE FROM password_reset_codes WHERE email = $1 AND code = $2',
          [normalizedEmail, code]
        );
        throw mailError;
      }
      console.log('[auth] forgot-password: verification code sent via SMTP to', normalizedEmail);
    }

    // Generic response regardless of outcome
    res.json({ message: 'If an account with that email exists, a 6-digit verification code has been sent.' });
  } catch (err) {
    console.error('Forgot-password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

/**
 * Look up the most recent active (unused, unexpired, under attempt cap) code
 * for the given email. Returns the row on success, or an error string to return
 * to the caller. On a failed guess the attempts counter is incremented so the
 * same row cannot be retried indefinitely.
 *
 * Strategy:
 *  1. Fetch the most-recently-created unused code for this email.
 *  2. If none found (or all used/expired/locked) → reject.
 *  3. If the code doesn't match → increment attempts; if now >= MAX_CODE_ATTEMPTS
 *     mark it used (locked) to prevent further retries; reject with a generic error.
 *  4. If expired → reject with an expiry-specific error.
 *  5. If locked (attempts >= MAX_CODE_ATTEMPTS) → reject.
 *  6. On match → return the row for the caller to consume.
 */
async function lookupActiveCode(
  normalizedEmail: string,
  trimmedCode: string
): Promise<{ id: number; expires_at: string | number } | string> {
  // Fetch the most recent unused code, regardless of whether the submitted code matches,
  // so we can increment the attempt counter on a wrong guess.
  const result = await pool.query(
    `SELECT id, code, expires_at, attempts FROM password_reset_codes
     WHERE email = $1 AND used = FALSE
     ORDER BY created_at DESC LIMIT 1`,
    [normalizedEmail]
  );

  if (result.rows.length === 0) {
    return 'Invalid or expired verification code. Please request a new one.';
  }

  const row = result.rows[0];

  // Check attempt cap first — a locked row is rejected even on a correct guess.
  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    return 'Too many incorrect attempts. Please request a new verification code.';
  }

  // Wrong code — increment the attempt counter, then lock if cap is reached.
  if (row.code !== trimmedCode) {
    const newAttempts = row.attempts + 1;
    if (newAttempts >= MAX_CODE_ATTEMPTS) {
      await pool.query(
        'UPDATE password_reset_codes SET attempts = $1, used = TRUE WHERE id = $2',
        [newAttempts, row.id]
      );
      return 'Too many incorrect attempts. Please request a new verification code.';
    } else {
      await pool.query(
        'UPDATE password_reset_codes SET attempts = $1 WHERE id = $2',
        [newAttempts, row.id]
      );
      return 'Invalid or expired verification code. Please request a new one.';
    }
  }

  // Correct code — check expiry.
  if (Date.now() > Number(row.expires_at)) {
    return 'This code has expired. Please request a new one.';
  }

  return { id: row.id, expires_at: row.expires_at };
}

// POST /api/auth/verify-reset-code
// Accepts { email, code } and checks whether the code is valid and unexpired.
// Returns { valid: true } on success so the frontend can advance to the
// new-password step without yet consuming the code.
// Failed guesses increment the per-code attempt counter; after MAX_CODE_ATTEMPTS
// the code is permanently locked regardless of subsequent submissions.
router.post('/verify-reset-code', async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required.' });
    }
    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit code.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    const lookup = await lookupActiveCode(normalizedEmail, trimmedCode);
    if (typeof lookup === 'string') {
      return res.status(401).json({ error: lookup });
    }

    res.json({ valid: true });
  } catch (err) {
    console.error('Verify-reset-code error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/reset-password
// Accepts { email, code, newPassword }.
// Verifies the code (with attempt tracking), marks it used, updates the
// password, and returns a JWT so the frontend can auto-login immediately.
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email is required.' });
    }
    if (!code || typeof code !== 'string' || !/^\d{6}$/.test(code.trim())) {
      return res.status(400).json({ error: 'Please enter a valid 6-digit code.' });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedCode = code.trim();

    // Verify the code (with attempt tracking and lockout)
    const lookup = await lookupActiveCode(normalizedEmail, trimmedCode);
    if (typeof lookup === 'string') {
      return res.status(401).json({ error: lookup });
    }
    const codeRow = lookup;

    // Mark the code as used atomically before touching the password
    await pool.query(
      'UPDATE password_reset_codes SET used = TRUE WHERE id = $1',
      [codeRow.id]
    );

    // Find the local user record
    const localResult = await pool.query(
      'SELECT id, username, supabase_user_id FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (localResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found.' });
    }

    const localUser = localResult.rows[0];

    // Hash the new password and update the local record
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, localUser.id]);

    // Optionally sync the new password to Supabase (non-fatal)
    if (supabaseAdmin && localUser.supabase_user_id) {
      supabaseAdmin.auth.admin.updateUserById(localUser.supabase_user_id, {
        password: newPassword,
      }).then(({ error }) => {
        if (error) console.warn('[supabase] updateUserById password sync failed:', error.message);
      }).catch((e: any) => {
        console.warn('[supabase] updateUserById exception:', e?.message || e);
      });
    }

    // Fetch the full user row and issue a JWT so the frontend can auto-login
    const fullUserResult = await pool.query(
      'SELECT username, avatar, avatar_bg, device, created_at FROM users WHERE id = $1',
      [localUser.id]
    );
    const fullUser = fullUserResult.rows[0];
    const token = signAuthToken({ id: localUser.id, username: localUser.username });

    res.json({
      message: 'Password updated successfully.',
      token,
      user: {
        username: fullUser.username,
        avatar: fullUser.avatar,
        avatarBg: fullUser.avatar_bg,
        device: fullUser.device ?? null,
        createdAt: parseInt(fullUser.created_at),
        passwordHash: '',
      },
    });
  } catch (err) {
    console.error('Reset-password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/users', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT username, avatar, avatar_bg, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows.map(u => ({
      username: u.username,
      avatar: u.avatar,
      avatarBg: u.avatar_bg,
      createdAt: parseInt(u.created_at),
      passwordHash: ''
    })));
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.patch('/user/:username', async (req: Request, res: Response) => {
  try {
    const account = await getAuthenticatedAccount(req);
    if (!account) return res.status(401).json({ error: 'Invalid token.' });

    if (account.username.toLowerCase() !== req.params.username.toLowerCase()) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    const { avatar, avatarBg } = req.body;
    const result = await pool.query(
      `UPDATE users SET avatar = COALESCE($1, avatar), avatar_bg = COALESCE($2, avatar_bg)
       WHERE LOWER(username) = LOWER($3)
       RETURNING username, avatar, avatar_bg, created_at`,
      [avatar, avatarBg, req.params.username]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found.' });
    const u = result.rows[0];
    res.json({
      username: u.username,
      avatar: u.avatar,
      avatarBg: u.avatar_bg,
      createdAt: parseInt(u.created_at),
      passwordHash: ''
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
