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

router.get('/:username/profile', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const viewer = getAuth(req);

    const userRes = await pool.query(
      'SELECT username, avatar, avatar_bg, created_at FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    const u = userRes.rows[0];

    const ratingRes = await pool.query(
      'SELECT rating, color FROM user_ratings WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    const coursesRes = await pool.query(
      `SELECT c.id, c.name, c.description, c.theme, c.created_at, COUNT(cl.username) AS likes_count
       FROM community_courses c
       LEFT JOIN course_likes cl ON cl.course_id = c.id
       WHERE LOWER(c.creator) = LOWER($1) AND c.is_published = TRUE
       GROUP BY c.id ORDER BY c.created_at DESC`,
      [username]
    );

    const pbsRes = await pool.query(
      `SELECT level_id, MIN(time) AS best_time
       FROM leaderboard_entries WHERE LOWER(player_name) = LOWER($1)
       GROUP BY level_id`,
      [username]
    );

    const followersRes = await pool.query(
      'SELECT COUNT(*) AS cnt FROM user_follows WHERE LOWER(following) = LOWER($1)',
      [username]
    );
    const followingRes = await pool.query(
      'SELECT COUNT(*) AS cnt FROM user_follows WHERE LOWER(follower) = LOWER($1)',
      [username]
    );

    let isFollowing = false;
    if (viewer && viewer.toLowerCase() !== username.toLowerCase()) {
      const fRes = await pool.query(
        'SELECT 1 FROM user_follows WHERE LOWER(follower) = LOWER($1) AND LOWER(following) = LOWER($2)',
        [viewer, username]
      );
      isFollowing = fRes.rows.length > 0;
    }

    res.json({
      user: {
        username: u.username,
        avatar: u.avatar,
        avatarBg: u.avatar_bg,
        createdAt: parseInt(u.created_at),
        passwordHash: ''
      },
      rating: ratingRes.rows[0]?.rating ?? 200,
      color: ratingRes.rows[0]?.color ?? '#3b82f6',
      courses: coursesRes.rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        theme: r.theme,
        createdAt: parseInt(r.created_at),
        likesCount: parseInt(r.likes_count) || 0,
        blocks: [],
        isPublished: true,
        isCustom: true,
        creator: username
      })),
      personalBests: pbsRes.rows.map(r => ({ levelId: r.level_id, bestTime: r.best_time })),
      followersCount: parseInt(followersRes.rows[0].cnt),
      followingCount: parseInt(followingRes.rows[0].cnt),
      isFollowing
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/:username/follow', async (req: Request, res: Response) => {
  try {
    const viewer = getAuth(req);
    if (!viewer) return res.status(401).json({ error: 'Unauthorized.' });

    const { username } = req.params;
    if (viewer.toLowerCase() === username.toLowerCase()) {
      return res.status(400).json({ error: 'Cannot follow yourself.' });
    }

    const existing = await pool.query(
      'SELECT 1 FROM user_follows WHERE LOWER(follower) = LOWER($1) AND LOWER(following) = LOWER($2)',
      [viewer, username]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        'DELETE FROM user_follows WHERE LOWER(follower) = LOWER($1) AND LOWER(following) = LOWER($2)',
        [viewer, username]
      );
      res.json({ following: false });
    } else {
      await pool.query(
        'INSERT INTO user_follows (follower, following) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [viewer, username]
      );
      res.json({ following: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/:username/notifications', async (req: Request, res: Response) => {
  try {
    const viewer = getAuth(req);
    if (!viewer || viewer.toLowerCase() !== req.params.username.toLowerCase()) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const result = await pool.query(
      `SELECT id, recipient, creator, course_id, course_name, created_at, read
       FROM notifications WHERE LOWER(recipient) = LOWER($1)
       ORDER BY created_at DESC LIMIT 100`,
      [req.params.username]
    );

    res.json(result.rows.map(r => ({
      id: r.id,
      creator: r.creator,
      courseId: r.course_id,
      courseName: r.course_name,
      createdAt: parseInt(r.created_at),
      read: r.read
    })));
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.patch('/:username/notifications/read', async (req: Request, res: Response) => {
  try {
    const viewer = getAuth(req);
    if (!viewer || viewer.toLowerCase() !== req.params.username.toLowerCase()) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { notifIds } = req.body;
    if (Array.isArray(notifIds) && notifIds.length > 0) {
      await pool.query(
        `UPDATE notifications SET read = TRUE WHERE id = ANY($1::text[]) AND LOWER(recipient) = LOWER($2)`,
        [notifIds, req.params.username]
      );
    } else {
      await pool.query(
        `UPDATE notifications SET read = TRUE WHERE LOWER(recipient) = LOWER($1)`,
        [req.params.username]
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/:username/race-history', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM race_history WHERE LOWER(username) = LOWER($1) ORDER BY date DESC LIMIT 100`,
      [req.params.username]
    );

    res.json(result.rows.map(r => ({
      id: r.id,
      levelId: r.level_id,
      levelName: r.level_name,
      playerName: r.username,
      playerColor: r.player_color,
      place: r.place,
      time: r.time,
      opponents: r.opponents,
      ratingChange: r.rating_change,
      newRating: r.new_rating,
      date: parseInt(r.date)
    })));
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/:username/race-result', async (req: Request, res: Response) => {
  try {
    const viewer = getAuth(req);
    if (!viewer || viewer.toLowerCase() !== req.params.username.toLowerCase()) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }

    const { id, levelId, levelName, playerColor, place, time, opponents, ratingChange, newRating, date } = req.body;

    const clampedRating = Math.max(100, newRating || 200);

    await pool.query(
      `INSERT INTO race_history (id, username, level_id, level_name, player_color, place, time, opponents, rating_change, new_rating, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [id, req.params.username, levelId, levelName, playerColor || '#3b82f6',
       place, time, JSON.stringify(opponents || []), ratingChange || 0, clampedRating, date || Date.now()]
    );

    await pool.query(
      `INSERT INTO user_ratings (username, rating, color) VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE SET rating = $2, color = $3`,
      [req.params.username, Math.max(100, newRating || 200), playerColor || '#3b82f6']
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/:username/rating', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT rating, color FROM user_ratings WHERE LOWER(username) = LOWER($1)',
      [req.params.username]
    );
    res.json({
      rating: result.rows[0]?.rating ?? 200,
      color: result.rows[0]?.color ?? '#3b82f6'
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
