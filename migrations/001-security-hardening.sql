-- Idempotent reference migration for the server/db.ts startup schema.
-- It only adds columns/tables/indexes and preserves existing account data.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  created_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limit_entries (
  key TEXT PRIMARY KEY,
  total_hits INTEGER NOT NULL,
  reset_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_entries_reset_at
  ON rate_limit_entries(reset_at);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  event_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('processing', 'processed')),
  received_at BIGINT NOT NULL,
  processed_at BIGINT
);
