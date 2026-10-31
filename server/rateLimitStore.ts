import type { Options, Store, IncrementResponse, ClientRateLimitInfo } from 'express-rate-limit';
import pool from './db';

export class PostgresRateLimitStore implements Store {
  localKeys = false;
  private windowMs = 60_000;
  private operations = 0;

  constructor(private readonly namespace: string) {}

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const result = await pool.query(
      'SELECT total_hits, reset_at FROM rate_limit_entries WHERE key = $1',
      [`${this.namespace}:${key}`]
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return { totalHits: Number(row.total_hits), resetTime: new Date(Number(row.reset_at)) };
  }

  async increment(key: string): Promise<IncrementResponse> {
    const now = Date.now();
    const resetAt = now + this.windowMs;
    const namespacedKey = `${this.namespace}:${key}`;
    const result = await pool.query(
      `INSERT INTO rate_limit_entries (key, total_hits, reset_at)
       VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE SET
         total_hits = CASE
           WHEN rate_limit_entries.reset_at <= $3 THEN 1
           ELSE rate_limit_entries.total_hits + 1
         END,
         reset_at = CASE
           WHEN rate_limit_entries.reset_at <= $3 THEN $2
           ELSE rate_limit_entries.reset_at
         END
       RETURNING total_hits, reset_at`,
      [namespacedKey, resetAt, now]
    );

    if (++this.operations % 500 === 0) {
      void pool.query('DELETE FROM rate_limit_entries WHERE reset_at < $1', [now])
        .catch(() => undefined);
    }

    return {
      totalHits: Number(result.rows[0].total_hits),
      resetTime: new Date(Number(result.rows[0].reset_at)),
    };
  }

  async decrement(key: string): Promise<void> {
    await pool.query(
      'UPDATE rate_limit_entries SET total_hits = GREATEST(0, total_hits - 1) WHERE key = $1',
      [`${this.namespace}:${key}`]
    );
  }

  async resetKey(key: string): Promise<void> {
    await pool.query('DELETE FROM rate_limit_entries WHERE key = $1', [`${this.namespace}:${key}`]);
  }
}
