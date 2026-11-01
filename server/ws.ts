import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { randomUUID } from 'node:crypto';
import pool from './db';
import { getAuthenticatedAccountFromToken, type AuthenticatedAccount } from './authIdentity';
import {
  hasRaceParticipantFinished,
  hasRaceParticipantDnf,
  recordRaceDnf,
  recordRaceFinish,
  registerRaceSession,
} from './raceSessions';
import { parseClientWsMessage } from './wsProtocol';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueEntry {
  ws: WebSocket;
  accountId: number;
  username: string;
  color: string;
  avatar: string;
  avatarBg: string;
  rating: number;
}

interface RoomPlayer {
  ws: WebSocket;
  accountId: number;
  username: string;
}

interface Room {
  id: string;
  players: RoomPlayer[];
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const DEFAULT_LEVEL_IDS = [
  'tutorial_skyway',
  'neon_velocity',
  'rust_ascent',
  'sunset_ridge',
  'monochrome_void',
  'lava_patchwork',
];

const queue: QueueEntry[] = [];
const rooms = new Map<string, Room>();
const authenticatedSockets = new Map<number, WebSocket>();

const MAX_PLAYERS = 6;
const MAX_CONNECTIONS = 500;
const MAX_MESSAGES_PER_WINDOW = 300;
const MESSAGE_WINDOW_MS = 10_000;
const AUTH_TIMEOUT_MS = 5_000;
const allowedWsOrigins = new Set<string>();
for (const configured of [
  process.env.APP_URL,
  ...(process.env.ALLOWED_ORIGINS || '').split(','),
  process.env.REPLIT_DEV_DOMAIN,
  ...(process.env.REPLIT_DOMAINS || '').split(','),
]) {
  if (!configured?.trim()) continue;
  try {
    const value = configured.trim();
    const origin = new URL(value.startsWith('http') ? value : `https://${value}`).origin;
    const hostname = new URL(origin).hostname.toLowerCase();
    if (process.env.NODE_ENV === 'production' &&
      ['localhost', '127.0.0.1', '::1', '[::1]'].includes(hostname)) continue;
    allowedWsOrigins.add(origin);
  } catch {
    // Ignore invalid deployment configuration; it cannot widen the allowlist.
  }
}
if (process.env.NODE_ENV !== 'production') {
  for (const origin of ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5000',
    'http://127.0.0.1:3000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5000']) {
    allowedWsOrigins.add(origin);
  }
}

let queueTimer: ReturnType<typeof setInterval> | null = null;
let queueTimeLeft = 10;
let timerActive = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(data));
    } catch {
      // Socket closed between the readyState check and the send — ignore.
    }
  }
}

function sendRaw(ws: WebSocket, payload: string) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(payload);
    } catch {
      // Socket closed between the readyState check and the send — ignore.
    }
  }
}

function broadcastQueueUpdate() {
  const players = queue.map(q => ({
    username: q.username,
    color: q.color,
    avatar: q.avatar,
    avatarBg: q.avatarBg,
    rating: q.rating,
  }));
  for (const entry of queue) {
    send(entry.ws, {
      type: 'QUEUE_UPDATE',
      players,
      timeLeft: queueTimeLeft,
      timerActive,
    });
  }
}

function startQueueCountdown() {
  if (timerActive) return;
  timerActive = true;
  queueTimeLeft = 10;
  broadcastQueueUpdate();
  queueTimer = setInterval(() => {
    queueTimeLeft--;
    broadcastQueueUpdate();
    if (queueTimeLeft <= 0) {
      clearInterval(queueTimer!);
      queueTimer = null;
      timerActive = false;
      startRace();
    }
  }, 1000);
}

function resetQueueCountdown() {
  // Reset the countdown to 10 s without stopping the interval tick.
  queueTimeLeft = 10;
  broadcastQueueUpdate();
}

function stopQueueCountdown() {
  if (queueTimer) {
    clearInterval(queueTimer);
    queueTimer = null;
  }
  timerActive = false;
  queueTimeLeft = 10;
}

function startRace() {
  if (queue.length === 0) return;

  const levelId =
    DEFAULT_LEVEL_IDS[Math.floor(Math.random() * DEFAULT_LEVEL_IDS.length)];
  const seed = Math.random();
  const roomId = randomUUID();

  const players = queue.map(q => ({
    username: q.username,
    color: q.color,
    avatar: q.avatar,
    avatarBg: q.avatarBg,
    isNpc: false,
  }));

  const room: Room = {
    id: roomId,
    players: queue.map(q => ({ ws: q.ws, accountId: q.accountId, username: q.username })),
  };
  rooms.set(roomId, room);

  // Shared absolute start timestamp so every client's countdown/timer is
  // anchored to the same instant, instead of each client starting its own
  // local countdown whenever it happens to receive the message.
  const startTime = Date.now();
  registerRaceSession(
    roomId,
    levelId,
    queue.map(q => ({ accountId: q.accountId, username: q.username, color: q.color })),
    startTime
  );

  for (const entry of queue) {
    send(entry.ws, { type: 'RACE_START', roomId, levelId, seed, players, startTime });
  }

  // Clear queue — race has started
  queue.length = 0;
}

function removeFromQueue(ws: WebSocket): boolean {
  const idx = queue.findIndex(q => q.ws === ws);
  if (idx !== -1) {
    queue.splice(idx, 1);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function setupWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({
    server: httpServer,
    path: '/ws',
    maxPayload: 4096,
    perMessageDeflate: false,
  });

  wss.on('error', err => {
    console.error('[WS] WebSocketServer error:', err);
  });

  wss.on('connection', (ws, request) => {
    if (wss.clients.size > MAX_CONNECTIONS) {
      ws.close(1013, 'Server is at capacity');
      return;
    }

    const origin = request.headers.origin;
    if (origin && !allowedWsOrigins.has(origin)) {
      ws.close(1008, 'Origin not allowed');
      return;
    }

    let account: AuthenticatedAccount | null = null;
    let messageWindowStart = Date.now();
    let messageCount = 0;
    let processing = Promise.resolve();
    let cleanupDone = false;

    const authTimeout = setTimeout(() => {
      if (!account && ws.readyState === WebSocket.OPEN) {
        ws.close(4001, 'Authentication required');
      }
    }, AUTH_TIMEOUT_MS);

    ws.on('message', raw => {
      const text = raw.toString();
      if (Buffer.byteLength(text, 'utf8') > 4096) {
        ws.close(1009, 'Message too large');
        return;
      }

      processing = processing.then(async () => {
        const now = Date.now();
        if (now - messageWindowStart >= MESSAGE_WINDOW_MS) {
          messageWindowStart = now;
          messageCount = 0;
        }
        if (++messageCount > MAX_MESSAGES_PER_WINDOW) {
          ws.close(1008, 'Message rate limit exceeded');
          return;
        }

        const msg = parseClientWsMessage(text);
        if (!msg) {
          ws.close(1008, 'Invalid message');
          return;
        }

        if (!account) {
          if (msg.type !== 'AUTH') {
            ws.close(4001, 'Authentication required');
            return;
          }
          const verifiedAccount = await getAuthenticatedAccountFromToken(msg.token);
          if (!verifiedAccount) {
            send(ws, { type: 'AUTH_ERROR', error: 'Authentication failed.' });
            ws.close(4001, 'Authentication failed');
            return;
          }

          const previousSocket = authenticatedSockets.get(verifiedAccount.id);
          if (previousSocket && previousSocket !== ws && previousSocket.readyState === WebSocket.OPEN) {
            const alreadyRacing = [...rooms.values()].some(room =>
              room.players.some(player => player.ws === previousSocket)
            );
            if (alreadyRacing) {
              send(ws, { type: 'AUTH_ERROR', error: 'This account is already in a race.' });
              ws.close(4003, 'Account already in race');
              return;
            }
            if (removeFromQueue(previousSocket)) {
              if (queue.length < 2) stopQueueCountdown();
              broadcastQueueUpdate();
            }
            previousSocket.close(4001, 'Session replaced');
          }

          account = verifiedAccount;
          authenticatedSockets.set(account.id, ws);
          clearTimeout(authTimeout);
          send(ws, { type: 'AUTH_OK', username: account.username });
          return;
        }

        if (msg.type === 'AUTH') {
          ws.close(1008, 'Already authenticated');
          return;
        }

        switch (msg.type) {
          case 'QUEUE_JOIN': {
            const inRoom = [...rooms.values()].some(room =>
              room.players.some(player => player.accountId === account!.id)
            );
            if (inRoom || queue.some(item => item.accountId === account!.id)) {
              send(ws, { type: 'QUEUE_ERROR', error: 'This account is already queued or racing.' });
              break;
            }

            const [profileResult, ratingResult] = await Promise.all([
              pool.query(
                'SELECT username, avatar, avatar_bg FROM users WHERE id = $1',
                [account.id]
              ),
              pool.query(
                'SELECT rating FROM user_ratings WHERE LOWER(username) = LOWER($1)',
                [account.username]
              ),
            ]);
            const profile = profileResult.rows[0];
            if (!profile) {
              ws.close(4001, 'Account no longer exists');
              return;
            }
            queue.push({
              ws,
              accountId: account.id,
              username: profile.username,
              color: msg.color || '#3b82f6',
              avatar: profile.avatar || '🏃',
              avatarBg: profile.avatar_bg || '',
              rating: Number(ratingResult.rows[0]?.rating ?? 200),
            });

            if (queue.length >= MAX_PLAYERS) {
              stopQueueCountdown();
              startRace();
              break;
            }
            if (queue.length >= 2) {
              if (timerActive) resetQueueCountdown();
              else startQueueCountdown();
            } else {
              broadcastQueueUpdate();
            }
            break;
          }

          case 'QUEUE_LEAVE':
            if (removeFromQueue(ws)) {
              if (queue.length < 2) stopQueueCountdown();
              broadcastQueueUpdate();
            }
            break;

          case 'FORCE_START':
            if (queue.some(item => item.ws === ws)) {
              stopQueueCountdown();
              startRace();
            }
            break;

          case 'GAME_TICK': {
            let senderRoom: Room | undefined;
            let sender: RoomPlayer | undefined;
            for (const room of rooms.values()) {
              const player = room.players.find(item => item.ws === ws);
              if (player) {
                senderRoom = room;
                sender = player;
                break;
              }
            }
            if (!senderRoom || !sender || sender.accountId !== account.id) break;
            if (hasRaceParticipantDnf(senderRoom.id, sender.accountId)) break;
            const payload = JSON.stringify({
              type: 'GAME_TICK',
              username: sender.username,
              x: msg.x,
              y: msg.y,
              z: msg.z,
              ry: msg.ry,
              time: msg.time,
            });
            for (const player of senderRoom.players) {
              if (player.ws !== ws) sendRaw(player.ws, payload);
            }
            break;
          }

          case 'GAME_FINISHED': {
            let senderRoom: Room | undefined;
            let sender: RoomPlayer | undefined;
            for (const room of rooms.values()) {
              const player = room.players.find(item => item.ws === ws);
              if (player) {
                senderRoom = room;
                sender = player;
                break;
              }
            }
            if (!senderRoom || !sender || sender.accountId !== account.id) break;
            const elapsedMs = recordRaceFinish(senderRoom.id, sender.accountId);
            if (elapsedMs === null) break;
            const payload = JSON.stringify({
              type: 'GAME_FINISHED',
              username: sender.username,
              time: elapsedMs / 1000,
            });
            for (const player of senderRoom.players) {
              if (player.ws !== ws) sendRaw(player.ws, payload);
            }
            break;
          }

          case 'PING':
            send(ws, { type: 'PONG' });
            break;
        }
      }).catch(() => {
        if (ws.readyState === WebSocket.OPEN) ws.close(1011, 'Server error');
      });
    });

    const cleanup = () => {
      if (cleanupDone) return;
      cleanupDone = true;
      clearTimeout(authTimeout);
      if (account && authenticatedSockets.get(account.id) === ws) {
        authenticatedSockets.delete(account.id);
      }
      if (removeFromQueue(ws)) {
        if (queue.length < 2) stopQueueCountdown();
        broadcastQueueUpdate();
      }
      for (const [roomId, room] of rooms.entries()) {
        const idx = room.players.findIndex(p => p.ws === ws);
        if (idx !== -1) {
          const disconnectedPlayer = room.players[idx];
          room.players.splice(idx, 1);
          if (!hasRaceParticipantFinished(roomId, disconnectedPlayer.accountId)) {
            recordRaceDnf(roomId, disconnectedPlayer.accountId);
          }
          if (!hasRaceParticipantFinished(roomId, disconnectedPlayer.accountId)) {
            const dnfPayload = JSON.stringify({
              type: 'PLAYER_DNF',
              username: disconnectedPlayer.username,
            });
            for (const p of room.players) {
              sendRaw(p.ws, dnfPayload);
            }
          } else {
            rooms.delete(roomId);
          }
        }
      }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  console.log('WebSocket matchmaking server active on /ws');
}
