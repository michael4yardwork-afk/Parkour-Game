import { RaceHistoryEntry } from '../types';

/**
 * Returns true if this race entry is a genuine first-place finish
 * (not a DNF sentinel, which uses place 99 / time 999999).
 */
export function isChampionRace(entry: RaceHistoryEntry): boolean {
  return entry.place === 1 && Number.isFinite(entry.time) && entry.time > 0;
}