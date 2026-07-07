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

router.get('/courses', async (req: Request, res: Response) => {
  try {
    const username = getAuth(req);

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
  try {
    const username = getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    const { id, name, description, blocks, theme, createdAt } = req.body;

    if (!id || !name || !blocks || !Array.isArray(blocks)) {
      return res.status(400).json({ error: 'Invalid course data.' });
    }

    const existing = await pool.query(
      'SELECT id, is_published FROM community_courses WHERE id = $1',
      [id]
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].is_published) {
        return res.status(409).json({ error: 'Course already published.' });
      }
      // Row exists but was unpublished — re-publish it with fresh data
      await pool.query(
        `UPDATE community_courses
         SET name = $2, description = $3, blocks = $4, theme = $5, is_published = TRUE
         WHERE id = $1`,
        [id, name, description || '', JSON.stringify(blocks), theme || 'sky_islands']
      );
    } else {
      await pool.query(
        `INSERT INTO community_courses (id, name, description, blocks, theme, creator, created_at, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
        [id, name, description || '', JSON.stringify(blocks), theme || 'sky_islands', username, createdAt || Date.now()]
      );
    }

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
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});

router.delete('/courses/:id', async (req: Request, res: Response) => {
  try {
    const username = getAuth(req);
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
  try {
    const username = getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    const result = await pool.query(
      `UPDATE community_courses SET is_published = FALSE
       WHERE id = $1 AND LOWER(creator) = LOWER($2) RETURNING id`,
      [req.params.id, username]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Not found or not authorized.' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

router.post('/courses/:id/like', async (req: Request, res: Response) => {
  try {
    const username = getAuth(req);
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
    const username = getAuth(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized.' });

    const courseId = req.params.id;
    const courseRes = await pool.query('SELECT creator FROM community_courses WHERE id = $1', [courseId]);
    if (courseRes.rows.length === 0) return res.status(404).json({ error: 'Course not found.' });

    const isOwner = courseRes.rows[0].creator.toLowerCase() === username.toLowerCase();
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

router.get('/saved', async (req: Request, res: Response) => {
  try {
    const username = getAuth(req);
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
