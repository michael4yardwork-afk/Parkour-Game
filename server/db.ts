import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT '🚀',
      avatar_bg TEXT NOT NULL DEFAULT 'bg-indigo-500',
      created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    );

    CREATE TABLE IF NOT EXISTS leaderboard_entries (
      id TEXT PRIMARY KEY,
      level_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      time REAL NOT NULL,
      date BIGINT NOT NULL,
      device TEXT,
      speeds JSONB,
      actions JSONB
    );

    CREATE INDEX IF NOT EXISTS idx_leaderboard_level_id ON leaderboard_entries(level_id);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_player ON leaderboard_entries(player_name);

    CREATE TABLE IF NOT EXISTS community_courses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      blocks JSONB NOT NULL,
      theme TEXT NOT NULL DEFAULT 'sky_islands',
      creator TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      is_published BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS course_likes (
      course_id TEXT NOT NULL,
      username TEXT NOT NULL,
      PRIMARY KEY (course_id, username)
    );

    CREATE TABLE IF NOT EXISTS course_bookmarks (
      course_id TEXT NOT NULL,
      username TEXT NOT NULL,
      PRIMARY KEY (course_id, username)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      creator TEXT NOT NULL,
      course_id TEXT NOT NULL,
      course_name TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient);

    CREATE TABLE IF NOT EXISTS user_follows (
      follower TEXT NOT NULL,
      following TEXT NOT NULL,
      PRIMARY KEY (follower, following)
    );

    CREATE TABLE IF NOT EXISTS race_history (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      level_id TEXT NOT NULL,
      level_name TEXT NOT NULL,
      player_color TEXT,
      place INTEGER NOT NULL,
      time REAL NOT NULL,
      opponents JSONB,
      rating_change INTEGER NOT NULL DEFAULT 0,
      new_rating INTEGER NOT NULL DEFAULT 200,
      date BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_race_history_username ON race_history(username);

    CREATE TABLE IF NOT EXISTS user_ratings (
      username TEXT PRIMARY KEY,
      rating INTEGER NOT NULL DEFAULT 200,
      color TEXT DEFAULT '#3b82f6'
    );
  `);

  await pool.query(`
    ALTER TABLE leaderboard_entries ADD COLUMN IF NOT EXISTS frames JSONB;
  `);

  // Remove the actions column — per-frame action strings are no longer stored.
  // Null out existing data first so the column can be dropped safely.
  await pool.query(`
    ALTER TABLE leaderboard_entries DROP COLUMN IF EXISTS actions;
  `);

  // Device field — stored at signup from the user's explicit selection.
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS device TEXT;
  `);

  // Email + Supabase auth fields — added when Supabase auth was integrated.
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS supabase_user_id TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_user_id) WHERE supabase_user_id IS NOT NULL;
  `);

  // Stripe billing fields — track current subscription state per user.
  // subscription_status mirrors Stripe's subscription status field
  // (active, trialing, past_due, canceled, unpaid, incomplete, etc.) or NULL
  // if the user has never started a checkout.
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_plan TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_current_period_end BIGINT;
    CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id);
  `);

  // Platinum purchase history — one row per Stripe lifecycle event so we have
  // a full audit trail of every purchase, renewal, and cancellation.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS platinum_purchases (
      id                    TEXT PRIMARY KEY,
      user_id               INTEGER REFERENCES users(id),
      username              TEXT NOT NULL,
      stripe_subscription_id TEXT,
      stripe_customer_id    TEXT,
      stripe_invoice_id     TEXT,
      plan                  TEXT,
      amount_cents          INTEGER,
      currency              TEXT,
      event_type            TEXT NOT NULL,
      subscription_status   TEXT,
      period_start          BIGINT,
      period_end            BIGINT,
      recorded_at           BIGINT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_platinum_purchases_username
      ON platinum_purchases(username);
    CREATE INDEX IF NOT EXISTS idx_platinum_purchases_subscription
      ON platinum_purchases(stripe_subscription_id);
  `);

  // Bind legacy billing records to immutable account IDs. Rows whose old
  // username no longer maps to an account remain unexposed rather than being
  // guessed or assigned to another account.
  await pool.query(`
    ALTER TABLE platinum_purchases
      ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);

    UPDATE platinum_purchases p
    SET user_id = u.id
    FROM users u
    WHERE p.user_id IS NULL
      AND LOWER(p.username) = LOWER(u.username);

    CREATE INDEX IF NOT EXISTS idx_platinum_purchases_user_id
      ON platinum_purchases(user_id);

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_stripe_customer_id_unique
      ON users(stripe_customer_id)
      WHERE stripe_customer_id IS NOT NULL;
  `);

  // Password reset codes — used by the 6-digit verification code recovery flow.
  // Each row stores one pending reset request, expires after 15 minutes,
  // and is marked used once the password has been successfully changed.
  // The `attempts` column counts failed guesses; rows with >= MAX_ATTEMPTS are
  // treated as locked and rejected even if the code is correct.
  await pool.query(`
    ALTER TABLE password_reset_codes ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 0;
  `).catch(() => { /* table may not exist yet — CREATE TABLE below handles it */ });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_reset_codes (
      id          SERIAL PRIMARY KEY,
      email       TEXT NOT NULL,
      code        TEXT NOT NULL,
      expires_at  BIGINT NOT NULL,
      used        BOOLEAN NOT NULL DEFAULT FALSE,
      attempts    INTEGER NOT NULL DEFAULT 0,
      created_at  BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    );
    CREATE INDEX IF NOT EXISTS idx_prc_email ON password_reset_codes(email);
  `);

  // Retroactively enforce the 1-course publish limit for non-platinum users.
  // For each free user who has more than one published course, keep only the
  // newest one (by created_at DESC) and unpublish the rest.  This runs on
  // every server start so the invariant is always restored after any edge-case.
  await pool.query(`
    UPDATE community_courses
    SET is_published = FALSE
    WHERE id IN (
      SELECT cc.id
      FROM community_courses cc
      LEFT JOIN users u ON LOWER(u.username) = LOWER(cc.creator)
      WHERE cc.is_published = TRUE
        AND (u.subscription_status IS NULL
             OR u.subscription_status NOT IN ('active', 'trialing'))
        AND cc.created_at < (
          SELECT MAX(cc2.created_at)
          FROM community_courses cc2
          WHERE LOWER(cc2.creator) = LOWER(cc.creator)
            AND cc2.is_published = TRUE
        )
    );
  `);
}

export default pool;
