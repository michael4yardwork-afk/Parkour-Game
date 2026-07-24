import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../db';
import { supabaseAdmin } from '../supabase';
import { getAuthenticatedAccount, signAuthToken } from '../authIdentity';

const router = Router();

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

// POST /api/auth/forgot-password
// Accepts { email } and triggers a Supabase password-reset email.
// Always returns 200 with a generic message so we don't leak account existence.
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Look up user — if not found, still return success to avoid email enumeration
    const userResult = await pool.query(
      'SELECT id, email, supabase_user_id FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (userResult.rows.length > 0 && supabaseAdmin) {
      // Determine the app's public URL for the redirect after the user clicks the email link
      const appUrl =
        process.env.APP_URL ||
        (req.headers.origin as string | undefined) ||
        `${req.protocol}://${req.headers.host}`;

      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: appUrl,
      });

      if (error) {
        console.error('[supabase] resetPasswordForEmail error:', error.message);
        // Surface a user-friendly error only for clear configuration issues
        if (error.message?.toLowerCase().includes('not found') || error.message?.toLowerCase().includes('invalid')) {
          // Still generic — don't leak
        } else {
          console.error('[supabase] recovery email failed:', error.message);
        }
      }
    } else if (!supabaseAdmin) {
      console.warn('[auth] forgot-password: Supabase is not configured — cannot send recovery email.');
    }

    // Generic response regardless of outcome
    res.json({ message: 'If an account with that email exists, a recovery link has been sent.' });
  } catch (err) {
    console.error('Forgot-password error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// POST /api/auth/reset-password
// Accepts { accessToken, newPassword } — the accessToken comes from the Supabase
// recovery redirect URL hash fragment (type=recovery).
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { accessToken, newPassword } = req.body;

    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ error: 'Missing recovery token.' });
    }
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Account recovery is not available (Supabase not configured).' });
    }

    // Verify the recovery access token and retrieve the Supabase user
    const { data: { user: sbUser }, error: getUserError } = await supabaseAdmin.auth.getUser(accessToken);
    if (getUserError || !sbUser) {
      console.error('[supabase] getUser for reset failed:', getUserError?.message);
      return res.status(401).json({ error: 'Recovery link is invalid or has expired. Please request a new one.' });
    }

    const supabaseUserId = sbUser.id;
    const supabaseEmail = sbUser.email?.toLowerCase().trim();

    if (!supabaseEmail) {
      return res.status(400).json({ error: 'No email address found on this account.' });
    }

    // Find the local user record
    const localResult = await pool.query(
      'SELECT id, username FROM users WHERE LOWER(email) = $1 OR supabase_user_id = $2',
      [supabaseEmail, supabaseUserId]
    );

    if (localResult.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found in local database.' });
    }

    const localUser = localResult.rows[0];

    // Hash the new password and update the local record
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, localUser.id]);

    // Update the password in Supabase so login-sync stays consistent
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
      password: newPassword,
    });
    if (updateError) {
      // Non-fatal: local DB is the source of truth for login
      console.warn('[supabase] updateUserById password sync failed:', updateError.message);
    }

    res.json({ message: 'Password updated successfully. You can now log in with your new password.' });
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
