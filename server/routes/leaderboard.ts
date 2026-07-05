import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');

function getAuth(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  try {
    const decoded: any = jwt.verify(auth.replace('Bearer ', ''), JWT_SECRET);
    return decoded.username;
  } catch {
    return null;
  }
}

router.get('/:levelId', async (req: Request, res: Response) => {
  try {
    const { levelId } = req.params;
    const result = await pool.query(
      `SELECT id, level_id, player_name, time, date, device, speeds, actions
       FROM leaderboard_entries WHERE level_id = $1 ORDER BY time ASC LIMIT 500`,
      [levelId]
    );
    res.json(result.rows.map(r => ({
      id: r.id,
      levelId: r.level_id,
      playerName: r.player_name,
      time: r.time,
      date: parseInt(r.date),
      device: r.device,
      speeds: r.speeds,
      actions: r.actions
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/:levelId', async (req: Request, res: Response) => {
  try {
    const username = getAuth(req);
    const { levelId } = req.params;
    const { time, date, device, speeds, actions } = req.body;

    if (!username) {
      console.warn(`[leaderboard] Rejected submit for level="${levelId}": missing/invalid auth token. hasAuthHeader=${!!req.headers.authorization}`);
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!time || time <= 0.05) {
      console.warn(`[leaderboard] Rejected submit for level="${levelId}" user="${username}": invalid time value=${JSON.stringify(time)}`);
      return res.status(400).json({ error: 'Invalid run time.' });
    }

    console.log(`[leaderboard] Accepting submit for level="${levelId}" user="${username}" time=${time}`);

    const id = `run_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    await pool.query(
      `INSERT INTO leaderboard_entries (id, level_id, player_name, time, date, device, speeds, actions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, levelId, username, time, date || Date.now(), device || 'desktop',
       speeds ? JSON.stringify(speeds) : null,
       actions ? JSON.stringify(actions) : null]
    );

    res.json({ id, success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/:levelId/my-runs', async (req: Request, res: Response) => {
  try {
    const username = getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    const { levelId } = req.params;
    await pool.query(
      `DELETE FROM leaderboard_entries WHERE level_id = $1 AND LOWER(player_name) = LOWER($2)`,
      [levelId, username]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
