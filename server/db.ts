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
}

export default pool;
