import { Router, Request, Response } from 'express';
import pool from '../db';
import jwt from 'jsonwebtoken';
import { backupRaceHistoryToSupabase } from '../supabaseRaceHistory';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || '';

// POST /api/race/dnf
// Called via navigator.sendBeacon when a player closes the tab mid-race.
// sendBeacon cannot set custom headers, so the JWT is carried in the body.
router.post('/dnf', async (req: Request, res: Response) => {
  try {
    const { token, username, levelId, levelName } = req.body;
    if (!token || !username) return res.status(400).json({ error: 'Missing fields.' });

    if (!JWT_SECRET) return res.status(500).json({ error: 'Server misconfigured.' });

    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
    } catch {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    // Confirm the token was issued for this user
    const tokenUsername: string = decoded.username || '';
    if (tokenUsername.toLowerCase() !== username.toLowerCase()) {
      return res.status(401).json({ error: 'Token mismatch.' });
    }

    // Look up current rating
    const ratingRes = await pool.query(
      'SELECT rating, color FROM user_ratings WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    const currentRating: number = ratingRes.rows[0]?.rating ?? 200;
    const color: string = ratingRes.rows[0]?.color ?? '#3b82f6';
    const newRating = Math.max(100, currentRating - 10);

    const id = `dnf_${username.toLowerCase()}_${Date.now()}`;
    const now = Date.now();

    // Record the DNF in race history (place 99, time 999999 are sentinel values for DNF)
    await pool.query(
      `INSERT INTO race_history
         (id, username, level_id, level_name, player_color, place, time, rating_change, new_rating, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [
        id, username,
        levelId   || 'unknown',
        levelName || 'Unknown',
        color,
        99,       // sentinel: DNF
        999999,   // sentinel: DNF
        -10,
        newRating,
        now,
      ]
    );

    backupRaceHistoryToSupabase({
      id, username,
      levelId: levelId || 'unknown',
      levelName: levelName || 'Unknown',
      playerColor: color,
      place: 99,
      time: 999999,
      ratingChange: -10,
      newRating,
      date: now,
    });

    // Apply the -10 ELO
    await pool.query(
      `INSERT INTO user_ratings (username, rating, color) VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE SET rating = $2`,
      [username, newRating, color]
    );

    res.json({ success: true, newRating });
  } catch (err) {
    console.error('[race/dnf]', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
