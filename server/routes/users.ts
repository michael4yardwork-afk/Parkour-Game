import { Router, Request, Response } from 'express';
import pool from '../db';
import { getAuthenticatedAccount, getVerifiedToken } from '../authIdentity';
import { backupRaceHistoryToSupabase } from '../supabaseRaceHistory';

const router = Router();
function getAuth(req: Request): string | null {
  return getVerifiedToken(req)?.username ?? null;
}

router.get('/:username/profile', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const viewer = getAuth(req);

    const userRes = await pool.query(
      'SELECT username, avatar, avatar_bg, created_at, subscription_status FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'User not found.' });

    const u = userRes.rows[0];

    const ratingRes = await pool.query(
      'SELECT rating, color FROM user_ratings WHERE LOWER(username) = LOWER($1)',
      [username]
    );

    const coursesRes = await pool.query(
      `SELECT c.id, c.name, c.description, c.blocks, c.theme, c.created_at, COUNT(cl.username) AS likes_count
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

    const profileIsPlatinum = ['active', 'trialing'].includes(u.subscription_status ?? '');

    res.json({
      user: {
        username: u.username,
        avatar: u.avatar,
        avatarBg: u.avatar_bg,
        createdAt: parseInt(u.created_at),
        passwordHash: ''
      },
      isPlatinum: profileIsPlatinum,
      rating: ratingRes.rows[0]?.rating ?? 200,
      color: ratingRes.rows[0]?.color ?? '#3b82f6',
      courses: coursesRes.rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        theme: r.theme,
        createdAt: parseInt(r.created_at),
        likesCount: parseInt(r.likes_count) || 0,
        blocks: r.blocks ?? [],
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
      // Unfollow — always allowed regardless of platinum status.
      await pool.query(
        'DELETE FROM user_follows WHERE LOWER(follower) = LOWER($1) AND LOWER(following) = LOWER($2)',
        [viewer, username]
      );
      res.json({ following: false });
    } else {
      // New follow — only allowed when the target user has an active Platinum subscription.
      const targetSubRes = await pool.query(
        'SELECT subscription_status FROM users WHERE LOWER(username) = LOWER($1)',
        [username]
      );
      const targetIsPlatinum = ['active', 'trialing'].includes(targetSubRes.rows[0]?.subscription_status ?? '');
      if (!targetIsPlatinum) {
        return res.status(403).json({
          error: 'platinum_required',
          message: 'This player needs Platinum to be followed by others.',
        });
      }
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
      `SELECT * FROM race_history WHERE LOWER(username) = LOWER($1) ORDER BY date DESC`,
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

    const { id, levelId, levelName, playerColor, place, time, ratingChange, newRating, date } = req.body;

    const clampedRating = Math.max(100, newRating || 200);
    const recordDate = date || Date.now();

    await pool.query(
      `INSERT INTO race_history (id, username, level_id, level_name, player_color, place, time, rating_change, new_rating, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING`,
      [id, req.params.username, levelId, levelName, playerColor || '#3b82f6',
       place, time, ratingChange || 0, clampedRating, recordDate]
    );

    await pool.query(
      `INSERT INTO user_ratings (username, rating, color) VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE SET rating = $2, color = $3`,
      [req.params.username, Math.max(100, newRating || 200), playerColor || '#3b82f6']
    );

    backupRaceHistoryToSupabase({
      id, username: req.params.username, levelId, levelName,
      playerColor: playerColor || '#3b82f6', place, time,
      ratingChange: ratingChange || 0, newRating: clampedRating, date: recordDate,
    });

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
    const rating = result.rows[0]?.rating ?? 200;
    const rankRes = await pool.query(
      'SELECT COUNT(*)::int AS cnt FROM user_ratings WHERE rating > $1',
      [rating]
    );
    const rank = (rankRes.rows[0]?.cnt ?? 0) + 1;
    res.json({
      rating,
      color: result.rows[0]?.color ?? '#3b82f6',
      rank,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/ratings/leaderboard', async (req: Request, res: Response) => {
  try {
    const account = await getAuthenticatedAccount(req);
    if (!account) return res.status(401).json({ error: 'Unauthorized.' });

    const entitlement = await pool.query(
      `SELECT subscription_status
       FROM users
       WHERE id = $1`,
      [account.id]
    );
    const status = entitlement.rows[0]?.subscription_status;
    if (status !== 'active' && status !== 'trialing') {
      return res.status(403).json({ error: 'platinum_required' });
    }

    const result = await pool.query(
      `SELECT ur.username, ur.rating, u.avatar, u.avatar_bg
       FROM user_ratings ur
       LEFT JOIN users u ON LOWER(u.username) = LOWER(ur.username)
       ORDER BY ur.rating DESC
       LIMIT 100`
    );
    res.json(result.rows.map(r => ({
      username: r.username,
      rating: r.rating,
      avatar: r.avatar || '🚀',
      avatarBg: r.avatar_bg || 'bg-rose-500',
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
