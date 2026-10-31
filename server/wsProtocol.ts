export type ClientWsMessage =
  | { type: 'AUTH'; token: string }
  | { type: 'QUEUE_JOIN'; color?: string }
  | { type: 'QUEUE_LEAVE' }
  | { type: 'FORCE_START' }
  | { type: 'GAME_TICK'; x: number; y: number; z: number; ry: number; time: number }
  | { type: 'GAME_FINISHED' }
  | { type: 'PING' };

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const POSITION_LIMIT = 100_000;

export function parseClientWsMessage(raw: string): ClientWsMessage | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 4096) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const msg = value as Record<string, unknown>;
  if (typeof msg.type !== 'string') return null;
  const keys = Object.keys(msg);
  const exactKeys = (...allowed: string[]) => keys.every(key => allowed.includes(key));

  switch (msg.type) {
    case 'AUTH':
      return exactKeys('type', 'token') && typeof msg.token === 'string' && msg.token.length <= 4096
        ? { type: 'AUTH', token: msg.token }
        : null;
    case 'QUEUE_JOIN':
      if (!exactKeys('type', 'color')) return null;
      if (msg.color !== undefined && (typeof msg.color !== 'string' || !COLOR_PATTERN.test(msg.color))) return null;
      return { type: 'QUEUE_JOIN', color: msg.color as string | undefined };
    case 'QUEUE_LEAVE':
    case 'FORCE_START':
    case 'GAME_FINISHED':
    case 'PING':
      return exactKeys('type') ? { type: msg.type } as ClientWsMessage : null;
    case 'GAME_TICK': {
      if (!exactKeys('type', 'x', 'y', 'z', 'ry', 'time')) return null;
      const values = [msg.x, msg.y, msg.z, msg.ry, msg.time];
      if (!values.every(item => typeof item === 'number' && Number.isFinite(item))) return null;
      const [x, y, z, ry, time] = values as number[];
      if (
        Math.abs(x) > POSITION_LIMIT ||
        Math.abs(y) > POSITION_LIMIT ||
        Math.abs(z) > POSITION_LIMIT ||
        Math.abs(ry) > Math.PI * 100 ||
        time < 0 ||
        time > MAX_CLIENT_TIME_SECONDS
      ) return null;
      return { type: 'GAME_TICK', x, y, z, ry, time };
    }
    default:
      return null;
  }
}

const MAX_CLIENT_TIME_SECONDS = 60 * 60;
