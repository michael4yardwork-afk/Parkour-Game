import { supabaseAdmin } from './supabase';

export interface RaceHistoryBackupRow {
  id: string;
  username: string;
  levelId: string;
  levelName: string;
  playerColor: string;
  place: number;
  time: number;
  ratingChange: number;
  newRating: number;
  date: number;
}

const SETUP_SQL = `
  CREATE TABLE IF NOT EXISTS race_history (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    level_id TEXT NOT NULL,
    level_name TEXT NOT NULL,
    player_color TEXT,
    place INTEGER NOT NULL,
    time REAL NOT NULL,
    rating_change INTEGER NOT NULL DEFAULT 0,
    new_rating INTEGER NOT NULL DEFAULT 200,
    date BIGINT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_race_history_username ON race_history(username);
`.trim();

let tableWarningLogged = false;

/**
 * Fire-and-forget backup of a race result to Supabase.
 * Failures are logged but never block the main HTTP response.
 */
export function backupRaceHistoryToSupabase(row: RaceHistoryBackupRow): void {
  if (!supabaseAdmin) return;

  const promise = supabaseAdmin
    .from('race_history')
    .upsert(
      {
        id: row.id,
        username: row.username,
        level_id: row.levelId,
        level_name: row.levelName,
        player_color: row.playerColor,
        place: row.place,
        time: row.time,
        rating_change: row.ratingChange,
        new_rating: row.newRating,
        date: row.date,
      },
      { onConflict: 'id' }
    );

  Promise.resolve(promise)
    .then(({ error }) => {
      if (error && !tableWarningLogged) {
        console.warn('[supabase backup] race_history upsert failed:', error.message);
        if (error.message.toLowerCase().includes('does not exist') || error.code === '42P01') {
          console.warn('[supabase backup] The race_history table is missing from your Supabase project.');
          console.warn('[supabase backup] Run this SQL in the Supabase SQL editor to create it:');
          console.warn(SETUP_SQL);
          tableWarningLogged = true;
        }
      }
    })
    .catch((err: Error) => {
      console.warn('[supabase backup] race_history upsert exception:', err.message);
    });
}
