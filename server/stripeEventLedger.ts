import pool from './db';

export type StripeEventClaim = 'claimed' | 'processed' | 'processing';

export async function claimStripeEvent(
  eventId: string,
  now = Date.now()
): Promise<StripeEventClaim> {
  const claim = await pool.query(
    `INSERT INTO stripe_webhook_events (event_id, status, received_at)
     VALUES ($1, 'processing', $2)
     ON CONFLICT (event_id) DO UPDATE
       SET status = 'processing', received_at = EXCLUDED.received_at, processed_at = NULL
       WHERE stripe_webhook_events.status = 'processing'
         AND stripe_webhook_events.received_at < $3
     RETURNING event_id`,
    [eventId, now, now - 5 * 60 * 1000]
  );
  if (claim.rows.length > 0) return 'claimed';

  const existing = await pool.query(
    'SELECT status FROM stripe_webhook_events WHERE event_id = $1',
    [eventId]
  );
  return existing.rows[0]?.status === 'processed' ? 'processed' : 'processing';
}

export async function markStripeEventProcessed(eventId: string, now = Date.now()): Promise<void> {
  await pool.query(
    `UPDATE stripe_webhook_events
     SET status = 'processed', processed_at = $2
     WHERE event_id = $1 AND status = 'processing'`,
    [eventId, now]
  );
}

export async function releaseStripeEventClaim(eventId: string): Promise<void> {
  await pool.query(
    `DELETE FROM stripe_webhook_events
     WHERE event_id = $1 AND status = 'processing'`,
    [eventId]
  );
}
