import { LeaderboardEntry } from '../types';

export interface PlayerRanking {
  rank: number;
  total: number;
  percentile: number;
}

const isValidTime = (time: number | null | undefined): time is number =>
  typeof time === 'number' && Number.isFinite(time) && time > 0.05;

export function getBestTimesByPlayer(entries: LeaderboardEntry[]): Record<string, number> {
  const bestTimes: Record<string, number> = {};

  entries.forEach(entry => {
    if (!isValidTime(entry.time)) return;
    const playerName = entry.playerName.toLowerCase().trim();
    if (!bestTimes[playerName] || entry.time < bestTimes[playerName]) {
      bestTimes[playerName] = entry.time;
    }
  });

  return bestTimes;
}

export function getPlayerRanking(
  entries: LeaderboardEntry[],
  username: string,
  localBest?: number | null
): PlayerRanking | null {
  const activeName = username.toLowerCase().trim();
  const bestTimes = getBestTimesByPlayer(entries);

  if (isValidTime(localBest) &&
      (!bestTimes[activeName] || localBest < bestTimes[activeName])) {
    bestTimes[activeName] = localBest;
  }

  const playerTime = bestTimes[activeName];
  if (!isValidTime(playerTime)) return null;

  const sortedTimes = Object.values(bestTimes).sort((a, b) => a - b);
  const rankIndex = sortedTimes.findIndex(time => time === playerTime);
  if (rankIndex < 0) return null;

  return {
    rank: rankIndex + 1,
    total: sortedTimes.length,
    percentile: sortedTimes.length > 1
      ? (rankIndex / (sortedTimes.length - 1)) * 100
      : 0,
  };
}

export function formatPercentile(percentile: number): string {
  if (percentile < 1) return percentile.toFixed(2);
  if (percentile < 5) return percentile.toFixed(1);
  return Math.round(percentile).toString();
}