import { RaceHistoryEntry } from '../types';

/**
 * A race history row contains both the saved placement and the recorded
 * opponent results. Prefer the result data when checking championship status
 * so an old or client-side placement cannot inflate the win count.
 */
export function isChampionRace(entry: RaceHistoryEntry): boolean {
  if (entry.place !== 1 || !Number.isFinite(entry.time) || entry.time < 0) {
    return false;
  }

  return !entry.opponents.some((opponent) =>
    opponent.finished &&
    Number.isFinite(opponent.time) &&
    (opponent.time as number) < entry.time
  );
}