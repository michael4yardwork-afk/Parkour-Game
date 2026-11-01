import { Router, Request, Response } from 'express';
import type { PoolClient } from 'pg';
import pool from '../db';
import { getAuthenticatedAccount } from '../authIdentity';
import { deleteRaceHistoryForLevel } from '../supabaseRaceHistory';

const router = Router();
async function getAuth(req: Request): Promise<string | null> {
  return (await getAuthenticatedAccount(req))?.username ?? null;
}

router.get('/courses', async (req: Request, res: Response) => {
  try {
    const username = await getAuth(req);

    const coursesResult = await pool.query(`
      SELECT c.id, c.name, c.description, c.blocks, c.theme, c.creator, c.created_at,
             COUNT(DISTINCT cl.username) AS likes_count
      FROM community_courses c
      LEFT JOIN course_likes cl ON cl.course_id = c.id
      WHERE c.is_published = TRUE
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    let likedIds: string[] = [];
    let bookmarkedIds: string[] = [];

    if (username) {
      const likedRes = await pool.query(
        'SELECT course_id FROM course_likes WHERE username = $1',
        [username]
      );
      likedIds = likedRes.rows.map(r => r.course_id);

      const bookmarkRes = await pool.query(
        'SELECT course_id FROM course_bookmarks WHERE username = $1',
        [username]
      );
      bookmarkedIds = bookmarkRes.rows.map(r => r.course_id);
    }

    const courses = coursesResult.rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      blocks: r.blocks,
      theme: r.theme,
      creator: r.creator,
      createdAt: parseInt(r.created_at),
      isPublished: true,
      isCustom: true,
      likesCount: parseInt(r.likes_count) || 0
    }));

    res.json({ courses, likedIds, bookmarkedIds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/courses', async (req: Request, res: Response) => {
  let client: PoolClient | undefined;
  try {
    const username = await getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    const { id, name, description, blocks, theme } = req.body;

    const validThemes = ['sky_islands', 'neon_grid', 'industrial_rust', 'mountain_sunset', 'abstract_white'];
    if (
      typeof id !== 'string' || id.length < 1 || id.length > 100 ||
      typeof name !== 'string' || name.trim().length < 1 || name.length > 80 ||
      typeof description !== 'string' || description.length > 1000 ||
      !Array.isArray(blocks) || blocks.length > 1000 ||
      typeof theme !== 'string' || !validThemes.includes(theme)
    ) {
      return res.status(400).json({ error: 'Invalid course data.' });
    }

    client = await pool.connect();
    await client.query('BEGIN');

    // Serialize publication checks per account, then lock the target course.
    // The ownership predicate is repeated in the write itself to avoid TOCTOU.
    const subRes = await client.query(
      'SELECT subscription_status FROM users WHERE LOWER(username) = LOWER($1) FOR UPDATE',
      [username]
    );
    if (subRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Account not found.' });
    }
    const existing = await client.query(
      'SELECT id, creator, is_published FROM community_courses WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (existing.rows.length > 0 && existing.rows[0].is_published) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Course already published.' });
    }
    if (
      existing.rows.length > 0 &&
      existing.rows[0].creator.toLowerCase() !== username.toLowerCase()
    ) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not authorized to publish this course.' });
    }

    const isPlatinum = ['active', 'trialing'].includes(subRes.rows[0]?.subscription_status ?? '');

    if (!isPlatinum) {
      const publishedCount = await client.query(
        'SELECT COUNT(*) AS cnt FROM community_courses WHERE LOWER(creator) = LOWER($1) AND is_published = TRUE',
        [username]
      );
      if (parseInt(publishedCount.rows[0].cnt) >= 1) {
        await client.query('ROLLBACK');
        return res.status(403).json({
          error: 'platinum_required',
          message: 'Free accounts can publish 1 course. Upgrade to Platinum for unlimited publishing.',
        });
      }
    }

    if (existing.rows.length > 0) {
      const updated = await client.query(
        `UPDATE community_courses
         SET name = $2, description = $3, blocks = $4, theme = $5, is_published = TRUE
         WHERE id = $1 AND LOWER(creator) = LOWER($6) AND is_published = FALSE
         RETURNING id`,
        [id, name.trim(), description, JSON.stringify(blocks), theme, username]
      );
      if (updated.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Not authorized to publish this course.' });
      }
    } else {
      await client.query(
        `INSERT INTO community_courses (id, name, description, blocks, theme, creator, created_at, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
        [id, name.trim(), description, JSON.stringify(blocks), theme, username, Date.now()]
      );
    }
    await client.query('COMMIT');

    await pool.query(
      `INSERT INTO course_bookmarks (course_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, username]
    );

    const followers = await pool.query(
      'SELECT follower FROM user_follows WHERE LOWER(following) = LOWER($1)',
      [username]
    );

    for (const row of followers.rows) {
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await pool.query(
        `INSERT INTO notifications (id, recipient, creator, course_id, course_name, created_at, read)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
        [notifId, row.follower, username, id, name, Date.now()]
      );
    }

    res.json({ success: true });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch {}
    }
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  } finally {
    client?.release();
  }
});

router.delete('/courses/:id', async (req: Request, res: Response) => {
  try {
    const username = await getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    const result = await pool.query(
      'DELETE FROM community_courses WHERE id = $1 AND LOWER(creator) = LOWER($2) RETURNING id',
      [req.params.id, username]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Not found or not authorized.' });
    }

    await pool.query('DELETE FROM course_likes WHERE course_id = $1', [req.params.id]);
    await pool.query('DELETE FROM course_bookmarks WHERE course_id = $1', [req.params.id]);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.patch('/courses/:id/unpublish', async (req: Request, res: Response) => {
  let client;
  try {
    const username = await getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    client = await pool.connect();
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE community_courses SET is_published = FALSE
       WHERE id = $1 AND LOWER(creator) = LOWER($2) AND is_published = TRUE RETURNING id`,
      [req.params.id, username]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not found or not authorized.' });
    }

    // A published course's leaderboard and race-history data is tied to that
    // published version. Remove all run records when it leaves the workshop.
    await client.query(
      'DELETE FROM leaderboard_entries WHERE level_id = $1',
      [req.params.id]
    );
    await client.query(
      'DELETE FROM race_history WHERE level_id = $1',
      [req.params.id]
    );
    await client.query('COMMIT');

    // Supabase is an optional backup for race history. Do not turn a
    // successful primary cleanup into a failed unpublish if that backup is
    // unavailable, but make any backup cleanup failure visible in logs.
    try {
      await deleteRaceHistoryForLevel(req.params.id);
    } catch (backupErr) {
      console.error('[community/unpublish] Failed to clean up Supabase race history:', backupErr);
    }

    res.json({ success: true });
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK'); } catch { /* transaction may be closed */ }
    }
    res.status(500).json({ error: 'Server error.' });
  } finally {
    if (client) client.release();
  }
});

router.post('/courses/:id/like', async (req: Request, res: Response) => {
  try {
    const username = await getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    const courseId = req.params.id;
    const existing = await pool.query(
      'SELECT 1 FROM course_likes WHERE course_id = $1 AND username = $2',
      [courseId, username]
    );

    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM course_likes WHERE course_id = $1 AND username = $2', [courseId, username]);
    } else {
      await pool.query(
        'INSERT INTO course_likes (course_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [courseId, username]
      );
    }

    const count = await pool.query(
      'SELECT COUNT(*) as cnt FROM course_likes WHERE course_id = $1',
      [courseId]
    );

    res.json({ liked: existing.rows.length === 0, likesCount: parseInt(count.rows[0].cnt) });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/courses/:id/bookmark', async (req: Request, res: Response) => {
  try {
    const username = await getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    const courseId = req.params.id;
    const courseRes = await pool.query('SELECT creator FROM community_courses WHERE id = $1', [courseId]);
    if (courseRes.rows.length === 0) return res.status(404).json({ error: 'Course not found.' });

    const isOwner = courseRes.rows[0].creator.toLowerCase() === username.toLowerCase();

    // Free plan users can only have their own published courses in their saved list.
    if (!isOwner) {
      const subRes = await pool.query(
        'SELECT subscription_status FROM users WHERE LOWER(username) = LOWER($1)',
        [username]
      );
      const isPlatinum = ['active', 'trialing'].includes(subRes.rows[0]?.subscription_status ?? '');
      if (!isPlatinum) {
        return res.status(403).json({
          error: 'platinum_required',
          message: 'Saving courses from the workshop is a Platinum feature. Upgrade to bookmark any course.',
        });
      }
    }

    const existing = await pool.query(
      'SELECT 1 FROM course_bookmarks WHERE course_id = $1 AND username = $2',
      [courseId, username]
    );

    if (existing.rows.length > 0) {
      if (isOwner) {
        return res.status(400).json({ error: 'You cannot remove your own course from bookmarks here. Delete it from Saved Courses.' });
      }
      await pool.query('DELETE FROM course_bookmarks WHERE course_id = $1 AND username = $2', [courseId, username]);
      res.json({ bookmarked: false });
    } else {
      await pool.query(
        'INSERT INTO course_bookmarks (course_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [courseId, username]
      );
      res.json({ bookmarked: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// ── Draft (unpublished, owner-only) endpoints ────────────────────────────────

router.get('/drafts', async (req: Request, res: Response) => {
  try {
    const username = await getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    const result = await pool.query(
      `SELECT id, name, description, blocks, theme, creator, created_at
       FROM community_courses
       WHERE LOWER(creator) = LOWER($1) AND is_published = FALSE
       ORDER BY created_at DESC`,
      [username]
    );

    res.json(result.rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      blocks: r.blocks,
      theme: r.theme,
      creator: r.creator,
      createdAt: parseInt(r.created_at),
      isPublished: false,
      isCustom: true,
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.put('/drafts/:id', async (req: Request, res: Response) => {
  try {
    const username = await getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    const { id } = req.params;
    const { name, description, blocks, theme } = req.body;

    const validThemes = ['sky_islands', 'neon_grid', 'industrial_rust', 'mountain_sunset', 'abstract_white'];
    if (
      typeof name !== 'string' || name.trim().length < 1 || name.length > 80 ||
      typeof description !== 'string' || description.length > 1000 ||
      !Array.isArray(blocks) || blocks.length > 1000 ||
      typeof theme !== 'string' || !validThemes.includes(theme)
    ) {
      return res.status(400).json({ error: 'Invalid course data.' });
    }

    // Never overwrite a published course via the draft endpoint.
    const existing = await pool.query(
      'SELECT creator, is_published FROM community_courses WHERE id = $1',
      [id]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      if (row.is_published) {
        return res.status(409).json({ error: 'Cannot overwrite a published course as a draft.' });
      }
      if (row.creator.toLowerCase() !== username.toLowerCase()) {
        return res.status(403).json({ error: 'Not authorized.' });
      }
      const updated = await pool.query(
        `UPDATE community_courses
         SET name = $2, description = $3, blocks = $4, theme = $5
         WHERE id = $1 AND LOWER(creator) = LOWER($6) AND is_published = FALSE
         RETURNING id`,
        [id, name.trim(), description, JSON.stringify(blocks), theme, username]
      );
      if (updated.rows.length === 0) {
        return res.status(403).json({ error: 'Not authorized.' });
      }
    } else {
      await pool.query(
        `INSERT INTO community_courses (id, name, description, blocks, theme, creator, created_at, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)`,
        [id, name.trim(), description, JSON.stringify(blocks), theme, username, Date.now()]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/drafts/:id', async (req: Request, res: Response) => {
  try {
    const username = await getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    const result = await pool.query(
      `DELETE FROM community_courses
       WHERE id = $1 AND LOWER(creator) = LOWER($2) AND is_published = FALSE
       RETURNING id`,
      [req.params.id, username]
    );

    if (result.rows.length === 0) {
      // Not found, already published, or not owned — treat as success silently
      // so the client can always remove it from its local list.
      return res.json({ success: true });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.get('/saved', async (req: Request, res: Response) => {
  try {
    const username = await getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    const result = await pool.query(`
      SELECT c.id, c.name, c.description, c.blocks, c.theme, c.creator, c.created_at,
             COUNT(DISTINCT cl.username) AS likes_count
      FROM community_courses c
      INNER JOIN course_bookmarks cb ON cb.course_id = c.id AND LOWER(cb.username) = LOWER($1)
      LEFT JOIN course_likes cl ON cl.course_id = c.id
      WHERE c.is_published = TRUE
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `, [username]);

    res.json(result.rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      blocks: r.blocks,
      theme: r.theme,
      creator: r.creator,
      createdAt: parseInt(r.created_at),
      isPublished: true,
      isCustom: true,
      likesCount: parseInt(r.likes_count) || 0
    })));
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
