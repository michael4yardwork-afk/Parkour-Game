import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'delta-rush-secret-key-change-in-production';

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
      `SELECT id, level_id, player_name, time, date, device, speeds,
              (frames IS NOT NULL AND jsonb_typeof(frames) = 'array' AND jsonb_array_length(frames) > 0) AS has_frames
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
      hasFrames: r.has_frames === true
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// Fetch ghost replay frames for a specific leaderboard entry (lazy-loaded)
router.get('/:levelId/:entryId/frames', async (req: Request, res: Response) => {
  try {
    const { levelId, entryId } = req.params;
    const result = await pool.query(
      `SELECT frames FROM leaderboard_entries WHERE id = $1 AND level_id = $2`,
      [entryId, levelId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found.' });
    const frames = result.rows[0].frames;
    if (!frames || frames.length === 0) return res.status(404).json({ error: 'No ghost replay available for this run.' });
    res.json({ frames });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/:levelId', async (req: Request, res: Response) => {
  try {
    const username = getAuth(req);
    const { levelId } = req.params;
    const { time, date, device, speeds, frames, isNewPb } = req.body;

    if (!username) {
      console.warn(`[leaderboard] Rejected submit for level="${levelId}": missing/invalid auth token. hasAuthHeader=${!!req.headers.authorization}`);
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    if (!time || time <= 0.05) {
      console.warn(`[leaderboard] Rejected submit for level="${levelId}" user="${username}": invalid time value=${JSON.stringify(time)}`);
      return res.status(400).json({ error: 'Invalid run time.' });
    }

    // Only accept ghost frames for personal-best runs; cap at 1000 frames (~10 fps × 100 s).
    let validatedFrames: any[] | null = null;
    if (isNewPb && Array.isArray(frames) && frames.length > 0) {
      validatedFrames = frames.slice(0, 1000).filter(
        f => f && typeof f === 'object' &&
             typeof f.time === 'number' && isFinite(f.time) &&
             typeof f.x === 'number' && isFinite(f.x) &&
             typeof f.y === 'number' && isFinite(f.y) &&
             typeof f.z === 'number' && isFinite(f.z) &&
             typeof f.rx === 'number' && isFinite(f.rx) &&
             typeof f.ry === 'number' && isFinite(f.ry)
      );
      if (validatedFrames.length === 0) validatedFrames = null;
    }

    const id = `run_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // When this run is a new personal best, clear ghost frames from all previous
    // entries for this player+level so only the new PB carries frame data.
    if (isNewPb) {
      await pool.query(
        `UPDATE leaderboard_entries SET frames = NULL WHERE level_id = $1 AND LOWER(player_name) = LOWER($2)`,
        [levelId, username]
      );
    }

    await pool.query(
      `INSERT INTO leaderboard_entries (id, level_id, player_name, time, date, device, speeds, frames)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, levelId, username, time, date || Date.now(), device || 'desktop',
       speeds ? JSON.stringify(speeds) : null,
       validatedFrames ? JSON.stringify(validatedFrames) : null]
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
