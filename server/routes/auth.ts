import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import pool from '../db';
import { createSupabasePublicClient, supabaseAdmin, supabasePublicConfigured } from '../supabase';
import { getAuthenticatedAccount, signAuthToken } from '../authIdentity';

const router = Router();

// Keep the server-side signup default varied even when an older client omits
// avatarBg. The frontend also chooses from this same set during signup.
const SIGNUP_AVATAR_BACKGROUNDS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-red-500',
  'bg-yellow-400',
  'bg-white',
  'bg-neutral-900',
] as const;

function randomSignupAvatarBackground(): string {
  return SIGNUP_AVATAR_BACKGROUNDS[
    Math.floor(Math.random() * SIGNUP_AVATAR_BACKGROUNDS.length)
  ];
}

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
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
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

export function recoveryRedirectOrigin(req: Request, requestedRedirectTo: unknown): string {
  const requestedOrigin = originFromUrl(requestedRedirectTo);
  const configuredOrigins = configuredPublicOrigins();
  const requestOrigin = originFromUrl(`${req.protocol}://${req.get('host')}`);

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
    process.env.NODE_ENV !== 'production' &&
    requestOrigin === requestedOrigin
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

  if (process.env.NODE_ENV !== 'production' && requestOrigin && isLocalOrigin(requestOrigin)) {
    return requestOrigin;
  }
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

    if (
      typeof username !== 'string' ||
      username.trim().length < 3 ||
      username.trim().length > 32 ||
      typeof password !== 'string' ||
      password.length < 12 ||
      Buffer.byteLength(password, 'utf8') > 72
    ) {
      return res.status(400).json({ error: 'Username must be 3–32 characters and password must be 12–72 bytes.' });
    }

    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();

    // Check username uniqueness
    const existing = await pool.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [normalizedUsername]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Username is already taken.' });
    }

    // Check email uniqueness
    const emailCheck = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
    if (emailCheck.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    // Create Supabase auth user (email + password)
    let supabaseUserId: string | null = null;
    if (supabaseAdmin) {
      try {
        const { data: sbData, error: sbError } = await supabaseAdmin.auth.admin.createUser({
          email: normalizedEmail,
          password,
          email_confirm: true, // mark as confirmed — we handle our own verification
          user_metadata: { username: normalizedUsername }
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

    const passwordHash = await bcrypt.hash(password, 12);
    const selectedAvatarBackground =
      typeof avatarBg === 'string' && SIGNUP_AVATAR_BACKGROUNDS.includes(avatarBg as typeof SIGNUP_AVATAR_BACKGROUNDS[number])
        ? avatarBg
        : randomSignupAvatarBackground();
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, avatar, avatar_bg, device, created_at, email, supabase_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, username, avatar, avatar_bg, device, created_at, token_version`,
      [
        normalizedUsername,
        passwordHash,
        avatar || '🚀',
        selectedAvatarBackground,
        device || null,
        Date.now(),
        normalizedEmail,
        supabaseUserId
      ]
    );

    const user = result.rows[0];
    const token = signAuthToken({ id: user.id, username: user.username, tokenVersion: user.token_version });

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
    if (
      typeof username !== 'string' ||
      username.length > 64 ||
      typeof password !== 'string' ||
      Buffer.byteLength(password, 'utf8') > 1024
    ) {
      return res.status(400).json({ error: 'Invalid username or password.' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const user = result.rows[0];

    // Primary verification: bcrypt (always runs, works for all accounts)
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password.' });
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

    const token = signAuthToken({ id: user.id, username: user.username, tokenVersion: user.token_version });

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

// POST /api/auth/forgot-password
// Accepts { email, redirectTo } and triggers a Supabase password-recovery email.
// Supabase sends a signed link that redirects back to the app; no SMTP config needed.
// Always returns 200 with a generic message to prevent email enumeration.
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email, redirectTo } = req.body;
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    if (!supabasePublicConfigured) {
      console.error('[auth] forgot-password: Supabase is not configured (SUPABASE_URL / SUPABASE_ANON_KEY missing).');
      return res.status(503).json({
        error: 'Account recovery is currently unavailable. Please contact the site administrator.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = createSupabasePublicClient();
    if (!supabase) {
      return res.status(503).json({
        error: 'Account recovery is currently unavailable. Please contact the site administrator.'
      });
    }

    const redirectOrigin = recoveryRedirectOrigin(req, req.body?.redirectTo);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${redirectOrigin}/`,
    });

    if (error) {
      console.error('[supabase] resetPasswordForEmail error:', error.message);
      return res.status(502).json({
        error: 'Account recovery email could not be sent. Please try again later.'
      });
    }

    return res.json({
      method: 'supabase-link',
      message: 'If an account with that email exists, a password recovery link has been sent.'
    });
  } catch (err) {
    console.error('Forgot-password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/reset-password-supabase
// Accepts a Supabase recovery session and synchronizes the new password to the
// local account after Supabase has verified the signed recovery token.
router.post('/reset-password-supabase', async (req: Request, res: Response) => {
  try {
    const { accessToken, refreshToken, newPassword } = req.body;
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(401).json({ error: 'The recovery link is invalid or expired. Please request a new one.' });
    }
    if (!refreshToken || typeof refreshToken !== 'string') {
      return res.status(401).json({ error: 'The recovery link is incomplete. Please request a new one.' });
    }
    if (
      typeof newPassword !== 'string' ||
      newPassword.length < 12 ||
      Buffer.byteLength(newPassword, 'utf8') > 72
    ) {
      return res.status(400).json({ error: 'New password must be 12–72 bytes.' });
    }
    if (!supabasePublicConfigured) {
      return res.status(503).json({
        error: 'Account recovery is temporarily unavailable. Please contact the site administrator.'
      });
    }

    const supabase = createSupabasePublicClient();
    if (!supabase) {
      return res.status(503).json({
        error: 'Account recovery is temporarily unavailable. Please contact the site administrator.'
      });
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) {
      console.error('[supabase] recovery session error:', sessionError.message);
      return res.status(401).json({ error: 'The recovery link is invalid or expired. Please request a new one.' });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(accessToken);
    if (userError || !userData.user?.email) {
      console.warn('[supabase] recovery token user verification failed.');
      return res.status(401).json({ error: 'The recovery link is invalid or expired. Please request a new one.' });
    }

    const normalizedEmail = userData.user.email.trim().toLowerCase();
    const localResult = await pool.query(
      'SELECT id, username FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );
    if (localResult.rows.length === 0) {
      return res.status(404).json({ error: 'No Delta Rush account is linked to this email address.' });
    }

    const localUser = localResult.rows[0];
    const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex');
    const consumed = await pool.query(
      `INSERT INTO password_reset_tokens (token_hash, created_at)
       VALUES ($1, $2)
       ON CONFLICT (token_hash) DO NOTHING
       RETURNING token_hash`,
      [tokenHash, Date.now()]
    );
    if (consumed.rows.length === 0) {
      return res.status(401).json({ error: 'This recovery link has already been used. Request a new one.' });
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      console.warn('[supabase] recovery password update failed.');
      return res.status(401).json({ error: 'The recovery link is invalid or expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const updatedUserResult = await pool.query(
      `UPDATE users
       SET password_hash = $1, token_version = token_version + 1
       WHERE id = $2
       RETURNING token_version`,
      [passwordHash, localUser.id]
    );

    const fullUserResult = await pool.query(
      'SELECT username, avatar, avatar_bg, device, created_at FROM users WHERE id = $1',
      [localUser.id]
    );
    const fullUser = fullUserResult.rows[0];
    const token = signAuthToken({
      id: localUser.id,
      username: localUser.username,
      tokenVersion: updatedUserResult.rows[0]?.token_version ?? 0,
    });

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
    console.error('Supabase reset-password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/exchange-recovery-token
// Exchanges a PKCE token_hash (delivered as a query param in the recovery link)
// for Supabase access + refresh tokens. The frontend calls this when it detects
// ?token_hash=...&type=recovery in the URL, then proceeds with reset-password-supabase.
router.post('/exchange-recovery-token', async (req: Request, res: Response) => {
  try {
    const { tokenHash } = req.body;
    if (!tokenHash || typeof tokenHash !== 'string') {
      return res.status(400).json({ error: 'Token hash is required.' });
    }
    if (!supabasePublicConfigured) {
      return res.status(503).json({ error: 'Account recovery is currently unavailable.' });
    }
    const supabase = createSupabasePublicClient();
    if (!supabase) {
      return res.status(503).json({ error: 'Account recovery is currently unavailable.' });
    }
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: 'recovery',
    });
    if (error || !data.session) {
      console.error('[supabase] verifyOtp error:', error?.message);
      return res.status(401).json({
        error: 'The recovery link is invalid or expired. Please request a new one.'
      });
    }
    return res.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });
  } catch (err) {
    console.error('exchange-recovery-token error:', err);
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

// POST /api/auth/change-password
// Authenticated route — requires a valid JWT. Verifies the current password
// with bcrypt, then updates the DB hash and syncs to Supabase if configured.
router.post('/change-password', async (req: Request, res: Response) => {
  try {
    const account = await getAuthenticatedAccount(req);
    if (!account) return res.status(401).json({ error: 'You must be logged in to change your password.' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({ error: 'Current password is required.' });
    }
    if (
      typeof newPassword !== 'string' ||
      newPassword.length < 12 ||
      Buffer.byteLength(newPassword, 'utf8') > 72
    ) {
      return res.status(400).json({ error: 'New password must be 12–72 bytes.' });
    }

    // Fetch the stored bcrypt hash
    const result = await pool.query(
      'SELECT id, password_hash, email, supabase_user_id FROM users WHERE id = $1',
      [account.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found.' });
    const user = result.rows[0];

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

    // Update local DB
    const newHash = await bcrypt.hash(newPassword, 12);
    const updateResult = await pool.query(
      `UPDATE users
       SET password_hash = $1, token_version = token_version + 1
       WHERE id = $2
       RETURNING token_version`,
      [newHash, account.id]
    );

    // Best-effort Supabase sync — failure never blocks the response
    if (supabaseAdmin && user.email && user.supabase_user_id) {
      supabaseAdmin.auth.admin.updateUserById(user.supabase_user_id, { password: newPassword })
        .catch((e: any) => console.warn('[supabase] change-password sync failed:', e?.message || e));
    }

    res.json({
      message: 'Password changed successfully.',
      token: signAuthToken({
        id: account.id,
        username: account.username,
        tokenVersion: updateResult.rows[0]?.token_version ?? account.tokenVersion + 1,
      }),
    });
  } catch (err) {
    console.error('change-password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
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
