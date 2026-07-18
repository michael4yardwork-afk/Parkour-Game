import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QueueEntry {
  ws: WebSocket;
  username: string;
  color: string;
  avatar: string;
  avatarBg: string;
}

interface RoomPlayer {
  ws: WebSocket;
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

const MAX_PLAYERS = 6;

let queueTimer: ReturnType<typeof setInterval> | null = null;
let queueTimeLeft = 10;
let timerActive = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function send(ws: WebSocket, data: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcastQueueUpdate() {
  const players = queue.map(q => ({
    username: q.username,
    color: q.color,
    avatar: q.avatar,
    avatarBg: q.avatarBg,
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
  const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const players = queue.map(q => ({
    username: q.username,
    color: q.color,
    avatar: q.avatar,
    avatarBg: q.avatarBg,
    isNpc: false,
  }));

  const room: Room = {
    id: roomId,
    players: queue.map(q => ({ ws: q.ws, username: q.username })),
  };
  rooms.set(roomId, room);

  // Shared absolute start timestamp so every client's countdown/timer is
  // anchored to the same instant, instead of each client starting its own
  // local countdown whenever it happens to receive the message.
  const startTime = Date.now();

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
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  wss.on('error', err => {
    console.error('[WS] WebSocketServer error:', err);
  });

  wss.on('connection', ws => {
    ws.on('message', raw => {
      let msg: any;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      switch (msg.type) {
        // ── Matchmaking ─────────────────────────────────────────────────────
        case 'QUEUE_JOIN': {
          const { username, color, avatar, avatarBg } = msg;
          if (!username) break;
          // Remove stale entry for the same connection
          removeFromQueue(ws);
          // Also remove any prior entry from same username (reconnect)
          const byName = queue.findIndex(
            q => q.username.toLowerCase() === username.toLowerCase()
          );
          if (byName !== -1) queue.splice(byName, 1);

          // Evict from any active room — handles the case where the player's
          // previous race WS wasn't closed before they rejoined the queue.
          for (const [roomId, room] of rooms.entries()) {
            const roomIdx = room.players.findIndex(
              p => p.username.toLowerCase() === username.toLowerCase()
            );
            if (roomIdx !== -1) {
              room.players.splice(roomIdx, 1);
              if (room.players.length === 0) rooms.delete(roomId);
            }
          }

          queue.push({
            ws,
            username,
            color: color || '#3b82f6',
            avatar: avatar || '🏃',
            avatarBg: avatarBg || '',
          });

          // 6 real players — start immediately, no need to wait
          if (queue.length >= MAX_PLAYERS) {
            stopQueueCountdown();
            startRace();
            break;
          }

          // Each new joiner resets the countdown to give everyone fair notice
          if (queue.length >= 2) {
            if (timerActive) {
              resetQueueCountdown();
            } else {
              startQueueCountdown();
            }
          } else {
            broadcastQueueUpdate();
          }
          break;
        }

        case 'QUEUE_LEAVE': {
          if (removeFromQueue(ws)) {
            if (queue.length < 2) stopQueueCountdown();
            broadcastQueueUpdate();
          }
          break;
        }

        case 'FORCE_START': {
          // Only honour if the sender is in the queue
          const inQueue = queue.some(q => q.ws === ws);
          if (inQueue) {
            stopQueueCountdown();
            startRace();
          }
          break;
        }

        // ── In-race sync ─────────────────────────────────────────────────────
        case 'GAME_TICK': {
          const { x, y, z, ry, time } = msg;
          // Verify sender is actually a member of a room and look up their
          // server-bound identity — never trust client-supplied roomId/username.
          let senderRoom: Room | undefined;
          let senderUsername: string | undefined;
          for (const room of rooms.values()) {
            const p = room.players.find(p => p.ws === ws);
            if (p) { senderRoom = room; senderUsername = p.username; break; }
          }
          if (!senderRoom || !senderUsername) break;
          const payload = JSON.stringify({
            type: 'GAME_TICK',
            username: senderUsername,
            x, y, z, ry, time,
          });
          for (const p of senderRoom.players) {
            if (p.ws !== ws && p.ws.readyState === WebSocket.OPEN) {
              p.ws.send(payload);
            }
          }
          break;
        }

        case 'GAME_FINISHED': {
          const { time } = msg;
          let senderRoom: Room | undefined;
          let senderUsername: string | undefined;
          for (const room of rooms.values()) {
            const p = room.players.find(p => p.ws === ws);
            if (p) { senderRoom = room; senderUsername = p.username; break; }
          }
          if (!senderRoom || !senderUsername) break;
          const payload = JSON.stringify({
            type: 'GAME_FINISHED',
            username: senderUsername,
            time,
          });
          for (const p of senderRoom.players) {
            if (p.ws !== ws && p.ws.readyState === WebSocket.OPEN) {
              p.ws.send(payload);
            }
          }
          break;
        }

        // ── Keepalive ────────────────────────────────────────────────────────
        case 'PING': {
          send(ws, { type: 'PONG' });
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
        const idx = room.players.findIndex(p => p.ws === ws);
        if (idx !== -1) {
          room.players.splice(idx, 1);
          if (room.players.length === 0) rooms.delete(roomId);
        }
      }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);
  });

  console.log('WebSocket matchmaking server active on /ws');
}
