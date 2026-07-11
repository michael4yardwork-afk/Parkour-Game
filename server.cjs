var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server/index.ts
var import_express5 = __toESM(require("express"), 1);
var import_http = require("http");
var import_path = __toESM(require("path"), 1);

// server/db.ts
var import_pg = require("pg");
var pool = new import_pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      avatar TEXT NOT NULL DEFAULT '\u{1F680}',
      avatar_bg TEXT NOT NULL DEFAULT 'bg-indigo-500',
      created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    );

    CREATE TABLE IF NOT EXISTS leaderboard_entries (
      id TEXT PRIMARY KEY,
      level_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      time REAL NOT NULL,
      date BIGINT NOT NULL,
      device TEXT,
      speeds JSONB,
      actions JSONB
    );

    CREATE INDEX IF NOT EXISTS idx_leaderboard_level_id ON leaderboard_entries(level_id);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_player ON leaderboard_entries(player_name);

    CREATE TABLE IF NOT EXISTS community_courses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      blocks JSONB NOT NULL,
      theme TEXT NOT NULL DEFAULT 'sky_islands',
      creator TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      is_published BOOLEAN NOT NULL DEFAULT TRUE
    );

    CREATE TABLE IF NOT EXISTS course_likes (
      course_id TEXT NOT NULL,
      username TEXT NOT NULL,
      PRIMARY KEY (course_id, username)
    );

    CREATE TABLE IF NOT EXISTS course_bookmarks (
      course_id TEXT NOT NULL,
      username TEXT NOT NULL,
      PRIMARY KEY (course_id, username)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient TEXT NOT NULL,
      creator TEXT NOT NULL,
      course_id TEXT NOT NULL,
      course_name TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      read BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient);

    CREATE TABLE IF NOT EXISTS user_follows (
      follower TEXT NOT NULL,
      following TEXT NOT NULL,
      PRIMARY KEY (follower, following)
    );

    CREATE TABLE IF NOT EXISTS race_history (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      level_id TEXT NOT NULL,
      level_name TEXT NOT NULL,
      player_color TEXT,
      place INTEGER NOT NULL,
      time REAL NOT NULL,
      opponents JSONB,
      rating_change INTEGER NOT NULL DEFAULT 0,
      new_rating INTEGER NOT NULL DEFAULT 200,
      date BIGINT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_race_history_username ON race_history(username);

    CREATE TABLE IF NOT EXISTS user_ratings (
      username TEXT PRIMARY KEY,
      rating INTEGER NOT NULL DEFAULT 200,
      color TEXT DEFAULT '#3b82f6'
    );
  `);
  await pool.query(`
    ALTER TABLE leaderboard_entries ADD COLUMN IF NOT EXISTS frames JSONB;
  `);
}
var db_default = pool;

// server/routes/auth.ts
var import_express = require("express");
var import_bcryptjs = __toESM(require("bcryptjs"), 1);
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
var router = (0, import_express.Router)();
var JWT_SECRET = process.env.JWT_SECRET || "delta-rush-secret-key-change-in-production";
router.post("/signup", async (req, res) => {
  try {
    const { username, password, avatar, avatarBg } = req.body;
    if (!username || !password || username.length < 3 || password.length < 6) {
      return res.status(400).json({ error: "Invalid username or password." });
    }
    const existing = await db_default.query("SELECT id FROM users WHERE LOWER(username) = LOWER($1)", [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: "Username is already taken." });
    }
    const passwordHash = await import_bcryptjs.default.hash(password, 10);
    const result = await db_default.query(
      `INSERT INTO users (username, password_hash, avatar, avatar_bg, created_at)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, avatar, avatar_bg, created_at`,
      [username, passwordHash, avatar || "\u{1F680}", avatarBg || "bg-indigo-500", Date.now()]
    );
    const user = result.rows[0];
    const token = import_jsonwebtoken.default.sign({ username: user.username }, JWT_SECRET, { expiresIn: "30d" });
    res.json({
      token,
      user: {
        username: user.username,
        avatar: user.avatar,
        avatarBg: user.avatar_bg,
        createdAt: parseInt(user.created_at),
        passwordHash: ""
      }
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Internal server error during sign up." });
  }
});
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await db_default.query(
      "SELECT * FROM users WHERE LOWER(username) = LOWER($1)",
      [username]
    );
    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Account not found. Check spelling or create a new account." });
    }
    const user = result.rows[0];
    const valid = await import_bcryptjs.default.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid password. Please inspect your inputs and try again." });
    }
    const token = import_jsonwebtoken.default.sign({ username: user.username }, JWT_SECRET, { expiresIn: "30d" });
    res.json({
      token,
      user: {
        username: user.username,
        avatar: user.avatar,
        avatarBg: user.avatar_bg,
        createdAt: parseInt(user.created_at),
        passwordHash: ""
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error during login." });
  }
});
router.get("/user/:username", async (req, res) => {
  try {
    const result = await db_default.query(
      "SELECT username, avatar, avatar_bg, created_at FROM users WHERE LOWER(username) = LOWER($1)",
      [req.params.username]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    const u = result.rows[0];
    res.json({
      username: u.username,
      avatar: u.avatar,
      avatarBg: u.avatar_bg,
      createdAt: parseInt(u.created_at),
      passwordHash: ""
    });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});
router.get("/users", async (_req, res) => {
  try {
    const result = await db_default.query(
      "SELECT username, avatar, avatar_bg, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(result.rows.map((u) => ({
      username: u.username,
      avatar: u.avatar,
      avatarBg: u.avatar_bg,
      createdAt: parseInt(u.created_at),
      passwordHash: ""
    })));
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});
router.patch("/user/:username", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: "Unauthorized." });
    const token = authHeader.replace("Bearer ", "");
    let decoded;
    try {
      decoded = import_jsonwebtoken.default.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid token." });
    }
    if (decoded.username.toLowerCase() !== req.params.username.toLowerCase()) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const { avatar, avatarBg } = req.body;
    const result = await db_default.query(
      `UPDATE users SET avatar = COALESCE($1, avatar), avatar_bg = COALESCE($2, avatar_bg)
       WHERE LOWER(username) = LOWER($3)
       RETURNING username, avatar, avatar_bg, created_at`,
      [avatar, avatarBg, req.params.username]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "User not found." });
    const u = result.rows[0];
    res.json({
      username: u.username,
      avatar: u.avatar,
      avatarBg: u.avatar_bg,
      createdAt: parseInt(u.created_at),
      passwordHash: ""
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});
var auth_default = router;

// server/routes/leaderboard.ts
var import_express2 = require("express");
var import_jsonwebtoken2 = __toESM(require("jsonwebtoken"), 1);
var router2 = (0, import_express2.Router)();
var JWT_SECRET2 = process.env.JWT_SECRET || "delta-rush-secret-key-change-in-production";
function getAuth(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  try {
    const decoded = import_jsonwebtoken2.default.verify(auth.replace("Bearer ", ""), JWT_SECRET2);
    return decoded.username;
  } catch {
    return null;
  }
}
router2.get("/:levelId", async (req, res) => {
  try {
    const { levelId } = req.params;
    const result = await db_default.query(
      `SELECT id, level_id, player_name, time, date, device, speeds, actions,
              (frames IS NOT NULL AND jsonb_typeof(frames) = 'array' AND jsonb_array_length(frames) > 0) AS has_frames
       FROM leaderboard_entries WHERE level_id = $1 ORDER BY time ASC LIMIT 500`,
      [levelId]
    );
    res.json(result.rows.map((r) => ({
      id: r.id,
      levelId: r.level_id,
      playerName: r.player_name,
      time: r.time,
      date: parseInt(r.date),
      device: r.device,
      speeds: r.speeds,
      actions: r.actions,
      hasFrames: r.has_frames === true
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});
router2.get("/:levelId/:entryId/frames", async (req, res) => {
  try {
    const { levelId, entryId } = req.params;
    const result = await db_default.query(
      `SELECT frames FROM leaderboard_entries WHERE id = $1 AND level_id = $2`,
      [entryId, levelId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: "Entry not found." });
    const frames = result.rows[0].frames;
    if (!frames || frames.length === 0) return res.status(404).json({ error: "No ghost replay available for this run." });
    res.json({ frames });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});
router2.post("/:levelId", async (req, res) => {
  try {
    const username = getAuth(req);
    const { levelId } = req.params;
    const { time, date, device, speeds, actions, frames } = req.body;
    if (!username) {
      console.warn(`[leaderboard] Rejected submit for level="${levelId}": missing/invalid auth token. hasAuthHeader=${!!req.headers.authorization}`);
      return res.status(401).json({ error: "Unauthorized." });
    }
    if (!time || time <= 0.05) {
      console.warn(`[leaderboard] Rejected submit for level="${levelId}" user="${username}": invalid time value=${JSON.stringify(time)}`);
      return res.status(400).json({ error: "Invalid run time." });
    }
    let validatedFrames = null;
    if (Array.isArray(frames) && frames.length > 0) {
      validatedFrames = frames.slice(0, 3e3).filter(
        (f) => f && typeof f === "object" && typeof f.time === "number" && isFinite(f.time) && typeof f.x === "number" && isFinite(f.x) && typeof f.y === "number" && isFinite(f.y) && typeof f.z === "number" && isFinite(f.z) && typeof f.rx === "number" && isFinite(f.rx) && typeof f.ry === "number" && isFinite(f.ry)
      );
      if (validatedFrames.length === 0) validatedFrames = null;
    }
    console.log(`[leaderboard] Accepting submit for level="${levelId}" user="${username}" time=${time} hasFrames=${!!validatedFrames} frameCount=${validatedFrames?.length ?? 0}`);
    const id = `run_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    await db_default.query(
      `INSERT INTO leaderboard_entries (id, level_id, player_name, time, date, device, speeds, actions, frames)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        levelId,
        username,
        time,
        date || Date.now(),
        device || "desktop",
        speeds ? JSON.stringify(speeds) : null,
        actions ? JSON.stringify(actions) : null,
        validatedFrames ? JSON.stringify(validatedFrames) : null
      ]
    );
    res.json({ id, success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});
router2.delete("/:levelId/my-runs", async (req, res) => {
  try {
    const username = getAuth(req);
    if (!username) return res.status(401).json({ error: "Unauthorized." });
    const { levelId } = req.params;
    await db_default.query(
      `DELETE FROM leaderboard_entries WHERE level_id = $1 AND LOWER(player_name) = LOWER($2)`,
      [levelId, username]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});
var leaderboard_default = router2;

// server/routes/community.ts
var import_express3 = require("express");
var import_jsonwebtoken3 = __toESM(require("jsonwebtoken"), 1);
var router3 = (0, import_express3.Router)();
var JWT_SECRET3 = process.env.JWT_SECRET || "delta-rush-secret-key-change-in-production";
function getAuth2(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  try {
    const decoded = import_jsonwebtoken3.default.verify(auth.replace("Bearer ", ""), JWT_SECRET3);
    return decoded.username;
  } catch {
    return null;
  }
}
router3.get("/courses", async (req, res) => {
  try {
    const username = getAuth2(req);
    const coursesResult = await db_default.query(`
      SELECT c.id, c.name, c.description, c.blocks, c.theme, c.creator, c.created_at,
             COUNT(DISTINCT cl.username) AS likes_count
      FROM community_courses c
      LEFT JOIN course_likes cl ON cl.course_id = c.id
      WHERE c.is_published = TRUE
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    let likedIds = [];
    let bookmarkedIds = [];
    if (username) {
      const likedRes = await db_default.query(
        "SELECT course_id FROM course_likes WHERE username = $1",
        [username]
      );
      likedIds = likedRes.rows.map((r) => r.course_id);
      const bookmarkRes = await db_default.query(
        "SELECT course_id FROM course_bookmarks WHERE username = $1",
        [username]
      );
      bookmarkedIds = bookmarkRes.rows.map((r) => r.course_id);
    }
    const courses = coursesResult.rows.map((r) => ({
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
    res.status(500).json({ error: "Server error." });
  }
});
router3.post("/courses", async (req, res) => {
  try {
    const username = getAuth2(req);
    if (!username) return res.status(401).json({ error: "Unauthorized." });
    const { id, name, description, blocks, theme, createdAt } = req.body;
    if (!id || !name || !blocks || !Array.isArray(blocks)) {
      return res.status(400).json({ error: "Invalid course data." });
    }
    const existing = await db_default.query(
      "SELECT id, is_published FROM community_courses WHERE id = $1",
      [id]
    );
    if (existing.rows.length > 0) {
      if (existing.rows[0].is_published) {
        return res.status(409).json({ error: "Course already published." });
      }
      await db_default.query(
        `UPDATE community_courses
         SET name = $2, description = $3, blocks = $4, theme = $5, is_published = TRUE
         WHERE id = $1`,
        [id, name, description || "", JSON.stringify(blocks), theme || "sky_islands"]
      );
    } else {
      await db_default.query(
        `INSERT INTO community_courses (id, name, description, blocks, theme, creator, created_at, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
        [id, name, description || "", JSON.stringify(blocks), theme || "sky_islands", username, createdAt || Date.now()]
      );
    }
    await db_default.query(
      `INSERT INTO course_bookmarks (course_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, username]
    );
    const followers = await db_default.query(
      "SELECT follower FROM user_follows WHERE LOWER(following) = LOWER($1)",
      [username]
    );
    for (const row of followers.rows) {
      const notifId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      await db_default.query(
        `INSERT INTO notifications (id, recipient, creator, course_id, course_name, created_at, read)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE)`,
        [notifId, row.follower, username, id, name, Date.now()]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});
router3.delete("/courses/:id", async (req, res) => {
  try {
    const username = getAuth2(req);
    if (!username) return res.status(401).json({ error: "Unauthorized." });
    const result = await db_default.query(
      "DELETE FROM community_courses WHERE id = $1 AND LOWER(creator) = LOWER($2) RETURNING id",
      [req.params.id, username]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: "Not found or not authorized." });
    }
    await db_default.query("DELETE FROM course_likes WHERE course_id = $1", [req.params.id]);
    await db_default.query("DELETE FROM course_bookmarks WHERE course_id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});
router3.patch("/courses/:id/unpublish", async (req, res) => {
  try {
    const username = getAuth2(req);
    if (!username) return res.status(401).json({ error: "Unauthorized." });
    const result = await db_default.query(
      `UPDATE community_courses SET is_published = FALSE
       WHERE id = $1 AND LOWER(creator) = LOWER($2) RETURNING id`,
      [req.params.id, username]
    );
    if (result.rows.length === 0) {
      return res.status(403).json({ error: "Not found or not authorized." });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});
router3.post("/courses/:id/like", async (req, res) => {
  try {
    const username = getAuth2(req);
    if (!username) return res.status(401).json({ error: "Unauthorized." });
    const courseId = req.params.id;
    const existing = await db_default.query(
      "SELECT 1 FROM course_likes WHERE course_id = $1 AND username = $2",
      [courseId, username]
    );
    if (existing.rows.length > 0) {
      await db_default.query("DELETE FROM course_likes WHERE course_id = $1 AND username = $2", [courseId, username]);
    } else {
      await db_default.query(
        "INSERT INTO course_likes (course_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [courseId, username]
      );
    }
    const count = await db_default.query(
      "SELECT COUNT(*) as cnt FROM course_likes WHERE course_id = $1",
      [courseId]
    );
    res.json({ liked: existing.rows.length === 0, likesCount: parseInt(count.rows[0].cnt) });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});
router3.post("/courses/:id/bookmark", async (req, res) => {
  try {
    const username = getAuth2(req);
    if (!username) return res.status(401).json({ error: "Unauthorized." });
    const courseId = req.params.id;
    const courseRes = await db_default.query("SELECT creator FROM community_courses WHERE id = $1", [courseId]);
    if (courseRes.rows.length === 0) return res.status(404).json({ error: "Course not found." });
    const isOwner = courseRes.rows[0].creator.toLowerCase() === username.toLowerCase();
    const existing = await db_default.query(
      "SELECT 1 FROM course_bookmarks WHERE course_id = $1 AND username = $2",
      [courseId, username]
    );
    if (existing.rows.length > 0) {
      if (isOwner) {
        return res.status(400).json({ error: "You cannot remove your own course from bookmarks here. Delete it from Saved Courses." });
      }
      await db_default.query("DELETE FROM course_bookmarks WHERE course_id = $1 AND username = $2", [courseId, username]);
      res.json({ bookmarked: false });
    } else {
      await db_default.query(
        "INSERT INTO course_bookmarks (course_id, username) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [courseId, username]
      );
      res.json({ bookmarked: true });
    }
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});
router3.get("/saved", async (req, res) => {
  try {
    const username = getAuth2(req);
    if (!username) return res.status(401).json({ error: "Unauthorized." });
    const result = await db_default.query(`
      SELECT c.id, c.name, c.description, c.blocks, c.theme, c.creator, c.created_at,
             COUNT(DISTINCT cl.username) AS likes_count
      FROM community_courses c
      INNER JOIN course_bookmarks cb ON cb.course_id = c.id AND LOWER(cb.username) = LOWER($1)
      LEFT JOIN course_likes cl ON cl.course_id = c.id
      WHERE c.is_published = TRUE
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `, [username]);
    res.json(result.rows.map((r) => ({
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
    res.status(500).json({ error: "Server error." });
  }
});
var community_default = router3;

// server/routes/users.ts
var import_express4 = require("express");
var import_jsonwebtoken4 = __toESM(require("jsonwebtoken"), 1);
var router4 = (0, import_express4.Router)();
var JWT_SECRET4 = process.env.JWT_SECRET || "delta-rush-secret-key-change-in-production";
function getAuth3(req) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  try {
    const decoded = import_jsonwebtoken4.default.verify(auth.replace("Bearer ", ""), JWT_SECRET4);
    return decoded.username;
  } catch {
    return null;
  }
}
router4.get("/:username/profile", async (req, res) => {
  try {
    const { username } = req.params;
    const viewer = getAuth3(req);
    const userRes = await db_default.query(
      "SELECT username, avatar, avatar_bg, created_at FROM users WHERE LOWER(username) = LOWER($1)",
      [username]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: "User not found." });
    const u = userRes.rows[0];
    const ratingRes = await db_default.query(
      "SELECT rating, color FROM user_ratings WHERE LOWER(username) = LOWER($1)",
      [username]
    );
    const coursesRes = await db_default.query(
      `SELECT c.id, c.name, c.description, c.theme, c.created_at, COUNT(cl.username) AS likes_count
       FROM community_courses c
       LEFT JOIN course_likes cl ON cl.course_id = c.id
       WHERE LOWER(c.creator) = LOWER($1) AND c.is_published = TRUE
       GROUP BY c.id ORDER BY c.created_at DESC`,
      [username]
    );
    const pbsRes = await db_default.query(
      `SELECT level_id, MIN(time) AS best_time
       FROM leaderboard_entries WHERE LOWER(player_name) = LOWER($1)
       GROUP BY level_id`,
      [username]
    );
    const followersRes = await db_default.query(
      "SELECT COUNT(*) AS cnt FROM user_follows WHERE LOWER(following) = LOWER($1)",
      [username]
    );
    const followingRes = await db_default.query(
      "SELECT COUNT(*) AS cnt FROM user_follows WHERE LOWER(follower) = LOWER($1)",
      [username]
    );
    let isFollowing = false;
    if (viewer && viewer.toLowerCase() !== username.toLowerCase()) {
      const fRes = await db_default.query(
        "SELECT 1 FROM user_follows WHERE LOWER(follower) = LOWER($1) AND LOWER(following) = LOWER($2)",
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
        passwordHash: ""
      },
      rating: ratingRes.rows[0]?.rating ?? 200,
      color: ratingRes.rows[0]?.color ?? "#3b82f6",
      courses: coursesRes.rows.map((r) => ({
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
      personalBests: pbsRes.rows.map((r) => ({ levelId: r.level_id, bestTime: r.best_time })),
      followersCount: parseInt(followersRes.rows[0].cnt),
      followingCount: parseInt(followingRes.rows[0].cnt),
      isFollowing
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});
router4.post("/:username/follow", async (req, res) => {
  try {
    const viewer = getAuth3(req);
    if (!viewer) return res.status(401).json({ error: "Unauthorized." });
    const { username } = req.params;
    if (viewer.toLowerCase() === username.toLowerCase()) {
      return res.status(400).json({ error: "Cannot follow yourself." });
    }
    const existing = await db_default.query(
      "SELECT 1 FROM user_follows WHERE LOWER(follower) = LOWER($1) AND LOWER(following) = LOWER($2)",
      [viewer, username]
    );
    if (existing.rows.length > 0) {
      await db_default.query(
        "DELETE FROM user_follows WHERE LOWER(follower) = LOWER($1) AND LOWER(following) = LOWER($2)",
        [viewer, username]
      );
      res.json({ following: false });
    } else {
      await db_default.query(
        "INSERT INTO user_follows (follower, following) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        [viewer, username]
      );
      res.json({ following: true });
    }
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});
router4.get("/:username/notifications", async (req, res) => {
  try {
    const viewer = getAuth3(req);
    if (!viewer || viewer.toLowerCase() !== req.params.username.toLowerCase()) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    const result = await db_default.query(
      `SELECT id, recipient, creator, course_id, course_name, created_at, read
       FROM notifications WHERE LOWER(recipient) = LOWER($1)
       ORDER BY created_at DESC LIMIT 100`,
      [req.params.username]
    );
    res.json(result.rows.map((r) => ({
      id: r.id,
      creator: r.creator,
      courseId: r.course_id,
      courseName: r.course_name,
      createdAt: parseInt(r.created_at),
      read: r.read
    })));
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});
router4.patch("/:username/notifications/read", async (req, res) => {
  try {
    const viewer = getAuth3(req);
    if (!viewer || viewer.toLowerCase() !== req.params.username.toLowerCase()) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    const { notifIds } = req.body;
    if (Array.isArray(notifIds) && notifIds.length > 0) {
      await db_default.query(
        `UPDATE notifications SET read = TRUE WHERE id = ANY($1::text[]) AND LOWER(recipient) = LOWER($2)`,
        [notifIds, req.params.username]
      );
    } else {
      await db_default.query(
        `UPDATE notifications SET read = TRUE WHERE LOWER(recipient) = LOWER($1)`,
        [req.params.username]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});
router4.get("/:username/race-history", async (req, res) => {
  try {
    const result = await db_default.query(
      `SELECT * FROM race_history WHERE LOWER(username) = LOWER($1) ORDER BY date DESC LIMIT 100`,
      [req.params.username]
    );
    res.json(result.rows.map((r) => ({
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
    res.status(500).json({ error: "Server error." });
  }
});
router4.post("/:username/race-result", async (req, res) => {
  try {
    const viewer = getAuth3(req);
    if (!viewer || viewer.toLowerCase() !== req.params.username.toLowerCase()) {
      return res.status(401).json({ error: "Unauthorized." });
    }
    const { id, levelId, levelName, playerColor, place, time, opponents, ratingChange, newRating, date } = req.body;
    const clampedRating = Math.max(100, newRating || 200);
    await db_default.query(
      `INSERT INTO race_history (id, username, level_id, level_name, player_color, place, time, opponents, rating_change, new_rating, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        id,
        req.params.username,
        levelId,
        levelName,
        playerColor || "#3b82f6",
        place,
        time,
        JSON.stringify(opponents || []),
        ratingChange || 0,
        clampedRating,
        date || Date.now()
      ]
    );
    await db_default.query(
      `INSERT INTO user_ratings (username, rating, color) VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE SET rating = $2, color = $3`,
      [req.params.username, Math.max(100, newRating || 200), playerColor || "#3b82f6"]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error." });
  }
});
router4.get("/:username/rating", async (req, res) => {
  try {
    const result = await db_default.query(
      "SELECT rating, color FROM user_ratings WHERE LOWER(username) = LOWER($1)",
      [req.params.username]
    );
    res.json({
      rating: result.rows[0]?.rating ?? 200,
      color: result.rows[0]?.color ?? "#3b82f6"
    });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});
var users_default = router4;

// server/ws.ts
var import_ws = require("ws");
var DEFAULT_LEVEL_IDS = [
  "tutorial_skyway",
  "neon_velocity",
  "rust_ascent",
  "sunset_ridge",
  "monochrome_void",
  "lava_patchwork"
];
var queue = [];
var rooms = /* @__PURE__ */ new Map();
var queueTimer = null;
var queueTimeLeft = 15;
var timerActive = false;
function send(ws, data) {
  if (ws.readyState === import_ws.WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}
function broadcastQueueUpdate() {
  const players = queue.map((q) => ({
    username: q.username,
    color: q.color,
    avatar: q.avatar
  }));
  for (const entry of queue) {
    send(entry.ws, {
      type: "QUEUE_UPDATE",
      players,
      timeLeft: queueTimeLeft,
      timerActive
    });
  }
}
function startQueueCountdown() {
  if (timerActive) return;
  timerActive = true;
  queueTimeLeft = 15;
  broadcastQueueUpdate();
  queueTimer = setInterval(() => {
    queueTimeLeft--;
    broadcastQueueUpdate();
    if (queueTimeLeft <= 0) {
      clearInterval(queueTimer);
      queueTimer = null;
      timerActive = false;
      startRace();
    }
  }, 1e3);
}
function stopQueueCountdown() {
  if (queueTimer) {
    clearInterval(queueTimer);
    queueTimer = null;
  }
  timerActive = false;
  queueTimeLeft = 15;
}
function startRace() {
  if (queue.length === 0) return;
  const levelId = DEFAULT_LEVEL_IDS[Math.floor(Math.random() * DEFAULT_LEVEL_IDS.length)];
  const seed = Math.random();
  const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const players = queue.map((q) => ({
    username: q.username,
    color: q.color,
    avatar: q.avatar,
    isNpc: false
  }));
  const room = {
    id: roomId,
    players: queue.map((q) => ({ ws: q.ws, username: q.username }))
  };
  rooms.set(roomId, room);
  const startTime = Date.now();
  for (const entry of queue) {
    send(entry.ws, { type: "RACE_START", roomId, levelId, seed, players, startTime });
  }
  queue.length = 0;
}
function removeFromQueue(ws) {
  const idx = queue.findIndex((q) => q.ws === ws);
  if (idx !== -1) {
    queue.splice(idx, 1);
    return true;
  }
  return false;
}
function setupWebSocketServer(httpServer2) {
  const wss = new import_ws.WebSocketServer({ server: httpServer2, path: "/ws" });
  wss.on("connection", (ws) => {
    ws.on("message", (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      switch (msg.type) {
        // ── Matchmaking ─────────────────────────────────────────────────────
        case "QUEUE_JOIN": {
          const { username, color, avatar } = msg;
          if (!username) break;
          removeFromQueue(ws);
          const byName = queue.findIndex(
            (q) => q.username.toLowerCase() === username.toLowerCase()
          );
          if (byName !== -1) queue.splice(byName, 1);
          queue.push({
            ws,
            username,
            color: color || "#3b82f6",
            avatar: avatar || "\u{1F3C3}"
          });
          broadcastQueueUpdate();
          if (queue.length >= 2 && !timerActive) startQueueCountdown();
          break;
        }
        case "QUEUE_LEAVE": {
          if (removeFromQueue(ws)) {
            if (queue.length < 2) stopQueueCountdown();
            broadcastQueueUpdate();
          }
          break;
        }
        case "FORCE_START": {
          const inQueue = queue.some((q) => q.ws === ws);
          if (inQueue) {
            stopQueueCountdown();
            startRace();
          }
          break;
        }
        // ── In-race sync ─────────────────────────────────────────────────────
        case "GAME_TICK": {
          const { x, y, z, ry, time } = msg;
          let senderRoom;
          let senderUsername;
          for (const room of rooms.values()) {
            const p = room.players.find((p2) => p2.ws === ws);
            if (p) {
              senderRoom = room;
              senderUsername = p.username;
              break;
            }
          }
          if (!senderRoom || !senderUsername) break;
          const payload = JSON.stringify({
            type: "GAME_TICK",
            username: senderUsername,
            x,
            y,
            z,
            ry,
            time
          });
          for (const p of senderRoom.players) {
            if (p.ws !== ws && p.ws.readyState === import_ws.WebSocket.OPEN) {
              p.ws.send(payload);
            }
          }
          break;
        }
        case "GAME_FINISHED": {
          const { time } = msg;
          let senderRoom;
          let senderUsername;
          for (const room of rooms.values()) {
            const p = room.players.find((p2) => p2.ws === ws);
            if (p) {
              senderRoom = room;
              senderUsername = p.username;
              break;
            }
          }
          if (!senderRoom || !senderUsername) break;
          const payload = JSON.stringify({
            type: "GAME_FINISHED",
            username: senderUsername,
            time
          });
          for (const p of senderRoom.players) {
            if (p.ws !== ws && p.ws.readyState === import_ws.WebSocket.OPEN) {
              p.ws.send(payload);
            }
          }
          break;
        }
        // ── Keepalive ────────────────────────────────────────────────────────
        case "PING": {
          send(ws, { type: "PONG" });
          break;
        }
      }
    });
    const cleanup = () => {
      if (removeFromQueue(ws)) {
        if (queue.length < 2) stopQueueCountdown();
        broadcastQueueUpdate();
      }
      for (const [roomId, room] of rooms.entries()) {
        const idx = room.players.findIndex((p) => p.ws === ws);
        if (idx !== -1) {
          room.players.splice(idx, 1);
          if (room.players.length === 0) rooms.delete(roomId);
        }
      }
    };
    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });
  console.log("WebSocket matchmaking server active on /ws");
}

// server/index.ts
if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is required");
  process.exit(1);
}
var app = (0, import_express5.default)();
var httpServer = (0, import_http.createServer)(app);
var PORT = process.env.PORT || 3001;
var IS_PROD = process.env.NODE_ENV === "production";
app.use(import_express5.default.json({ limit: "5mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});
app.use("/api/auth", auth_default);
app.use("/api/leaderboard", leaderboard_default);
app.use("/api/community", community_default);
app.use("/api/users", users_default);
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
if (IS_PROD) {
  const distPath = import_path.default.resolve(process.cwd(), "dist");
  app.use(import_express5.default.static(distPath));
  app.get("*", (_req, res) => {
    res.sendFile(import_path.default.join(distPath, "index.html"));
  });
}
async function start() {
  try {
    await initDb();
    console.log("Database initialized.");
    setupWebSocketServer(httpServer);
    httpServer.listen(Number(PORT), "0.0.0.0", () => {
      console.log(`Delta Rush API running on http://0.0.0.0:${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}
start();
