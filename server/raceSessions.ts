export interface RaceSessionParticipant {
  accountId: number;
  username: string;
  color?: string;
}

interface ParticipantState extends RaceSessionParticipant {
  joinedOrder: number;
  finishedAtMs: number | null;
  dnf: boolean;
}

interface RaceSession {
  id: string;
  levelId: string;
  startedAtMs: number;
  participants: ParticipantState[];
}

export interface VerifiedRaceOutcome {
  accountId: number;
  username: string;
  levelId: string;
  playerColor: string;
  place: number;
  timeSeconds: number | null;
  dnf: boolean;
  ratingChange: number;
}

const sessions = new Map<string, RaceSession>();
const MAX_SESSION_AGE_MS = 20 * 60 * 1000;
const MAX_STORED_SESSIONS = 1_000;
export const MIN_RACE_DURATION_MS = 5_000;
export const MIN_RATING = 100;
export const MAX_RATING = 5_000;

function pruneExpiredSessions(now: number) {
  for (const [id, session] of sessions) {
    if (now - session.startedAtMs > MAX_SESSION_AGE_MS) sessions.delete(id);
  }
}

export function registerRaceSession(
  id: string,
  levelId: string,
  participants: RaceSessionParticipant[],
  startedAtMs: number
): void {
  pruneExpiredSessions(Date.now());
  while (sessions.size >= MAX_STORED_SESSIONS) {
    const oldest = sessions.keys().next().value;
    if (oldest === undefined) break;
    sessions.delete(oldest);
  }
  sessions.set(id, {
    id,
    levelId,
    startedAtMs,
    participants: participants.map((participant, joinedOrder) => ({
      ...participant,
      joinedOrder,
      finishedAtMs: null,
      dnf: false,
    })),
  });
}

export function recordRaceFinish(
  raceId: string,
  accountId: number,
  now = Date.now()
): number | null {
  const session = sessions.get(raceId);
  const participant = session?.participants.find(item => item.accountId === accountId);
  if (!session || !participant || participant.finishedAtMs !== null || participant.dnf) return null;
  const elapsed = now - session.startedAtMs;
  if (!Number.isFinite(elapsed) || elapsed < MIN_RACE_DURATION_MS || elapsed > MAX_SESSION_AGE_MS) return null;
  participant.finishedAtMs = now;
  return elapsed;
}

export function recordRaceDnf(raceId: string, accountId: number): boolean {
  const session = sessions.get(raceId);
  const participant = session?.participants.find(item => item.accountId === accountId);
  if (!participant || participant.finishedAtMs !== null || participant.dnf) return false;
  participant.dnf = true;
  return true;
}

export function isRaceParticipant(raceId: string, accountId: number): boolean {
  return Boolean(sessions.get(raceId)?.participants.some(item => item.accountId === accountId));
}

export function hasRaceParticipantFinished(raceId: string, accountId: number): boolean {
  const participant = sessions.get(raceId)?.participants.find(item => item.accountId === accountId);
  return participant?.finishedAtMs !== null && participant?.finishedAtMs !== undefined;
}

export function hasRaceParticipantDnf(raceId: string, accountId: number): boolean {
  return sessions.get(raceId)?.participants.find(item => item.accountId === accountId)?.dnf ?? false;
}

export function getVerifiedRaceOutcomes(raceId: string): VerifiedRaceOutcome[] | null {
  const session = sessions.get(raceId);
  if (!session || session.participants.length === 0) return null;
  if (!session.participants.every(item => item.finishedAtMs !== null || item.dnf)) return null;

  const ordered = [...session.participants].sort((a, b) => {
    if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
    if (a.finishedAtMs !== null && b.finishedAtMs !== null && a.finishedAtMs !== b.finishedAtMs) {
      return a.finishedAtMs - b.finishedAtMs;
    }
    return a.joinedOrder - b.joinedOrder;
  });

  return ordered.map((participant, index) => ({
    accountId: participant.accountId,
    username: participant.username,
    levelId: session.levelId,
    playerColor: participant.color || '#3b82f6',
    place: participant.dnf ? 99 : index + 1,
    timeSeconds: participant.finishedAtMs === null
      ? null
      : Math.max(0, participant.finishedAtMs - session.startedAtMs) / 1000,
    dnf: participant.dnf,
    // Preserve the existing Delta Rush points for the first five places.
    // Solo/NPC-only matches do not affect competitive rating.
    ratingChange: session.participants.length < 2
      ? 0
      : ratingChangeForPlace(index + 1, participant.dnf),
  }));
}

export function ratingChangeForPlace(place: number, dnf = false): number {
  if (dnf) return -10;
  if (place === 1) return 10;
  if (place === 2) return 5;
  if (place === 3) return 2;
  if (place === 4) return -2;
  if (place === 5) return -5;
  return -10;
}

export function applyRatingChange(current: number, change: number): number {
  const safeCurrent = Number.isFinite(current) ? Math.trunc(current) : MIN_RATING;
  const safeChange = Number.isFinite(change) ? Math.trunc(change) : 0;
  return Math.max(MIN_RATING, Math.min(MAX_RATING, safeCurrent + safeChange));
}
