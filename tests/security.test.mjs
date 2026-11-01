import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';
import express from 'express';
import jwt from 'jsonwebtoken';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

process.env.SESSION_SECRET = 'unit-test-session-secret-with-enough-entropy';
process.env.NODE_ENV = 'test';
const require = createRequire(import.meta.url);

const { signAuthToken, verifyAuthToken } = await import('../server/authIdentity.ts');
const {
  applyRatingChange,
  getVerifiedRaceOutcomes,
  ratingChangeForPlace,
  recordRaceDnf,
  recordRaceFinish,
  registerRaceSession,
} = await import('../server/raceSessions.ts');
const { parseClientWsMessage } = await import('../server/wsProtocol.ts');
const { default: pool } = await import('../server/db.ts');
const { PostgresRateLimitStore } = await import('../server/rateLimitStore.ts');
const { default: usersRouter } = await import('../server/routes/users.ts');
const { default: raceRouter } = await import('../server/routes/race.ts');
const { default: communityRouter } = await import('../server/routes/community.ts');
const { recoveryRedirectOrigin } = await import('../server/routes/auth.ts');
const browserslist = (await import('browserslist')).default;

test('auth tokens are HS256-only, identity-bound, and short-lived', () => {
  const token = signAuthToken({ id: 41, username: 'runner', tokenVersion: 3 });
  const claims = verifyAuthToken(token);
  assert.equal(claims?.sub, '41');
  assert.equal(claims?.username, 'runner');
  assert.equal(claims?.ver, 3);
  assert.equal(verifyAuthToken(`${token}invalid`), null);

  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const asymmetricToken = jwt.sign(
    { sub: '41', username: 'runner', ver: 3 },
    privateKey,
    { algorithm: 'RS256', expiresIn: '1h' }
  );
  assert.equal(verifyAuthToken(asymmetricToken), null);
});

test('server race sessions define finish order, DNF, and bounded rating changes', () => {
  const raceId = '9bb6d708-8d50-4333-a97e-d3f9f96cb8f3';
  const startedAt = Date.now() - 10_000;
  registerRaceSession(raceId, 'neon_velocity', [
    { accountId: 1, username: 'runner-a', color: '#123456' },
    { accountId: 2, username: 'runner-b', color: '#abcdef' },
  ], startedAt);

  assert.equal(recordRaceFinish(raceId, 1, startedAt + 8_000), 8_000);
  assert.equal(recordRaceFinish(raceId, 1, startedAt + 9_000), null);
  assert.equal(recordRaceDnf(raceId, 2), true);
  assert.equal(recordRaceDnf(raceId, 2), false);

  const results = getVerifiedRaceOutcomes(raceId);
  assert.equal(results?.[0].username, 'runner-a');
  assert.equal(results?.[0].ratingChange, 10);
  assert.equal(results?.[1].dnf, true);
  assert.equal(results?.[1].ratingChange, -10);
  assert.equal(ratingChangeForPlace(2), 5);
  assert.equal(applyRatingChange(101, -10), 100);
  assert.equal(applyRatingChange(4_999, 10), 5_000);
});

test('WebSocket protocol accepts only bounded, exact client messages', () => {
  assert.deepEqual(
    parseClientWsMessage(JSON.stringify({ type: 'GAME_FINISHED' })),
    { type: 'GAME_FINISHED' }
  );
  assert.equal(parseClientWsMessage(JSON.stringify({
    type: 'QUEUE_JOIN',
    color: '#123456',
    username: 'victim',
  })), null);
  assert.equal(parseClientWsMessage(JSON.stringify({
    type: 'GAME_TICK',
    x: 1, y: 2, z: 3, ry: 0, time: 4,
    roomId: 'someone-elses-room',
  })), null);
  assert.equal(parseClientWsMessage('not-json'), null);
  assert.equal(parseClientWsMessage('x'.repeat(4097)), null);
});

test('recovery links use the configured public origin and reject untrusted redirects', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAppUrl = process.env.APP_URL;
  try {
    process.env.NODE_ENV = 'production';
    process.env.APP_URL = 'https://game.example.test';
    const request = { protocol: 'http', get: () => 'localhost:3001' };
    assert.equal(
      recoveryRedirectOrigin(request, 'https://attacker.example'),
      'https://game.example.test'
    );
    assert.equal(
      recoveryRedirectOrigin(request, 'https://game.example.test/reset'),
      'https://game.example.test'
    );
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousAppUrl === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previousAppUrl;
  }
});

test('patched Browserslist resolves ordinary target queries', () => {
  const packageVersion = require('../node_modules/browserslist/package.json').version;
  const [major, minor, patch] = packageVersion.split('.').map(Number);
  assert.ok(major > 4 || (major === 4 && (minor > 28 || (minor === 28 && patch >= 7))));
  assert.ok(browserslist('defaults').length > 0);
});

test('PostgreSQL rate limiting returns 429 after the configured limit', async () => {
  const originalQuery = pool.query.bind(pool);
  const counters = new Map();
  pool.query = async (sql, params) => {
    if (sql.includes('INSERT INTO rate_limit_entries')) {
      const [key, resetAt, now] = params;
      const current = counters.get(key);
      const next = !current || current.resetAt <= now
        ? { totalHits: 1, resetAt }
        : { totalHits: current.totalHits + 1, resetAt: current.resetAt };
      counters.set(key, next);
      return { rows: [{ total_hits: next.totalHits, reset_at: next.resetAt }] };
    }
    if (sql.includes('DELETE FROM rate_limit_entries')) return { rows: [] };
    throw new Error('Unexpected rate-limit store query in test.');
  };

  const app = express();
  app.use(rateLimit({
    windowMs: 60_000,
    limit: 1,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: req => ipKeyGenerator(req.ip || '127.0.0.1'),
    store: new PostgresRateLimitStore('test'),
  }));
  app.get('/check', (_req, res) => res.sendStatus(200));
  const server = createServer(app);

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/check`;
    assert.equal((await fetch(url)).status, 200);
    assert.equal((await fetch(url)).status, 429);
  } finally {
    await new Promise(resolve => server.close(resolve));
    pool.query = originalQuery;
  }
});

test('race endpoints reject client ELO and make DNF processing idempotent', async () => {
  const originalQuery = pool.query.bind(pool);
  pool.query = async sql => {
    if (sql.includes('token_version')) {
      return {
        rows: [{ id: 7, username: 'runner', email: 'runner@example.test', token_version: 0 }],
      };
    }
    throw new Error('Unexpected query in race endpoint test.');
  };

  const app = express();
  app.use(express.json());
  app.use('/users', usersRouter);
  app.use('/race', raceRouter);
  const server = createServer(app);
  const token = signAuthToken({ id: 7, username: 'runner' });
  const raceId = 'be1aef41-93c8-4df3-8a94-a735cf5a76a9';
  registerRaceSession(raceId, 'neon_velocity', [
    { accountId: 7, username: 'runner' },
    { accountId: 8, username: 'other' },
  ], Date.now());

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const forgedResult = await fetch(`${baseUrl}/users/runner/race-result`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        raceId: null, levelId: 'neon_velocity', levelName: 'Neon Velocity',
        playerColor: '#123456', place: 1, time: 8, ratingChange: 9999, newRating: 99999,
      }),
    });
    assert.equal(forgedResult.status, 400);

    const dnfPayload = JSON.stringify({ token, raceId });
    const firstDnf = await fetch(`${baseUrl}/race/dnf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: dnfPayload,
    });
    const duplicateDnf = await fetch(`${baseUrl}/race/dnf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: dnfPayload,
    });
    assert.deepEqual(await firstDnf.json(), { success: true, duplicate: false });
    assert.deepEqual(await duplicateDnf.json(), { success: true, duplicate: true });
  } finally {
    await new Promise(resolve => server.close(resolve));
    pool.query = originalQuery;
  }
});

test('a user cannot publish someone else’s saved course', async () => {
  const originalQuery = pool.query.bind(pool);
  const originalConnect = pool.connect.bind(pool);
  let writeAttempted = false;
  pool.query = async sql => {
    if (sql.includes('token_version')) {
      return {
        rows: [{ id: 7, username: 'runner', email: 'runner@example.test', token_version: 0 }],
      };
    }
    throw new Error('Unexpected query in course ownership test.');
  };
  pool.connect = async () => ({
    async query(sql) {
      if (sql === 'BEGIN' || sql === 'ROLLBACK' || sql === 'COMMIT') return { rows: [] };
      if (sql.includes('SELECT subscription_status')) {
        return { rows: [{ subscription_status: 'trialing' }] };
      }
      if (sql.includes('SELECT id, creator, is_published')) {
        return { rows: [{ id: 'course-owned', creator: 'another-user', is_published: false }] };
      }
      writeAttempted = true;
      return { rows: [] };
    },
    release() {},
  });

  const app = express();
  app.use(express.json());
  app.use('/community', communityRouter);
  const server = createServer(app);
  const token = signAuthToken({ id: 7, username: 'runner' });

  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/community/courses`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: 'course-owned',
        name: 'Overwrite attempt',
        description: '',
        blocks: [],
        theme: 'sky_islands',
      }),
    });
    assert.equal(response.status, 403);
    assert.equal(writeAttempted, false);
  } finally {
    await new Promise(resolve => server.close(resolve));
    pool.query = originalQuery;
    pool.connect = originalConnect;
  }
});
