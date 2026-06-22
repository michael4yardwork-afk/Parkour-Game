import React, { useState, useEffect } from 'react';
import { Trophy, RefreshCw, Smartphone, Monitor, Award, Download } from 'lucide-react';
import { LeaderboardEntry, UserAccount } from '../types';

interface LeaderboardProps {
  levelId: string;
  levelName: string;
  localBest: number | null;
  onClose: () => void;
  // Ghost export helper if available
  exportGhostReplay?: () => void;
  currentUser?: UserAccount | null;
}

export default function Leaderboard({ levelId, levelName, localBest, onClose, exportGhostReplay, currentUser }: LeaderboardProps) {
  const [filter, setFilter] = useState<'world' | 'local'>('world');
  const [worldView, setWorldView] = useState<'top' | 'my_position'>('top');
  const [rawLocalRuns, setRawLocalRuns] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentLocalBest, setCurrentLocalBest] = useState<number | null>(localBest);

  // Keep currentLocalBest synced with incoming prop
  useEffect(() => {
    setCurrentLocalBest(localBest);
  }, [localBest]);

  // Load leaderboard data
  useEffect(() => {
    loadScores();
  }, [levelId]);

  const loadScores = () => {
    setLoading(true);
    try {
      const stored = localStorage.getItem(`leaderboard_${levelId}`);
      let entries: LeaderboardEntry[] = stored ? JSON.parse(stored) : [];
      
      // Clean up and filter out any invalid 0.00 times
      const originalLength = entries.length;
      entries = entries.filter(e => e.time > 0.05);
      
      // De-duplicate and auto-clean any duplicate or missing IDs to ensure high key integrity
      const seenIds = new Set<string>();
      let changedKeys = false;
      entries = entries.map((e, idx) => {
        if (!e.id || seenIds.has(e.id)) {
          changedKeys = true;
          const cleanId = `run_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 5)}`;
          seenIds.add(cleanId);
          return { ...e, id: cleanId };
        }
        seenIds.add(e.id);
        return e;
      });

      if (entries.length !== originalLength || changedKeys) {
        localStorage.setItem(`leaderboard_${levelId}`, JSON.stringify(entries));
      }

      setRawLocalRuns(entries);
    } catch (e) {
      console.error('Error reading leaderboards', e);
    } finally {
      setLoading(false);
    }
  };

  const clearLocalScores = () => {
    if (window.confirm('Are you sure you want to clear your personal runs for this level from the leaderboards?')) {
      const stored = localStorage.getItem(`leaderboard_${levelId}`);
      if (stored) {
        try {
          const entries: LeaderboardEntry[] = JSON.parse(stored);
          const filtered = entries.filter(e => e.playerName.toLowerCase() !== (currentUser?.username || 'you').toLowerCase());
          localStorage.setItem(`leaderboard_${levelId}`, JSON.stringify(filtered));
        } catch (e) {
          localStorage.removeItem(`leaderboard_${levelId}`);
        }
      } else {
        localStorage.removeItem(`leaderboard_${levelId}`);
      }
      localStorage.removeItem(`best_time_${levelId}`);
      localStorage.removeItem(`ghost_replay_${levelId}`);
      setCurrentLocalBest(null);
      loadScores();
    }
  };

  // Find the single absolute best run for each unique real player name
  const getGroupedWorldPlayers = (): LeaderboardEntry[] => {
    const playerBestRuns: { [username: string]: LeaderboardEntry } = {};
    rawLocalRuns.forEach(run => {
      let userKey = run.playerName.toLowerCase().trim();
      if (userKey === 'you' || userKey === 'guest') {
        userKey = (currentUser?.username || 'Guest').toLowerCase().trim();
      }
      if (!playerBestRuns[userKey] || run.time < playerBestRuns[userKey].time) {
        playerBestRuns[userKey] = {
          ...run,
          playerName: (run.playerName.toLowerCase() === 'you' || run.playerName.toLowerCase() === 'guest') ? (currentUser?.username || 'Guest') : run.playerName
        };
      }
    });
    return Object.values(playerBestRuns);
  };

  // User personal best formatted entry
  const playerPBEntry: LeaderboardEntry | null = currentLocalBest ? {
    id: 'user_pb',
    levelId,
    playerName: currentUser?.username || 'Guest',
    time: currentLocalBest,
    date: (() => {
      const found = rawLocalRuns.find(r => Math.abs(r.time - currentLocalBest) < 0.001);
      return found ? found.date : Date.now();
    })(),
    device: (() => {
      const found = rawLocalRuns.find(r => Math.abs(r.time - currentLocalBest) < 0.001);
      return found ? found.device : 'desktop';
    })()
  } : null;

  const worldRealPlayers = getGroupedWorldPlayers();

  // Fully ranked world list of unique players
  const mergedWorldList = [...worldRealPlayers];
  if (playerPBEntry && !mergedWorldList.some(r => r.playerName.toLowerCase().trim() === (currentUser?.username || 'Guest').toLowerCase().trim())) {
    mergedWorldList.push(playerPBEntry);
  }
  mergedWorldList.sort((a, b) => a.time - b.time);

  const rankedWorldList = mergedWorldList.map((entry, index) => {
    const uLower = (currentUser?.username || 'Guest').toLowerCase().trim();
    const pLower = entry.playerName.toLowerCase().trim();
    const isCurrentUser = entry.id === 'user_pb' || pLower === uLower || pLower === 'you' || pLower === 'guest';
    return {
      ...entry,
      playerName: isCurrentUser ? (currentUser?.username || 'Guest') : entry.playerName,
      rank: index + 1
    };
  });

  // Resolve current active list
  const getVisibleEntries = () => {
    if (filter === 'local') {
      const currentUserRuns = rawLocalRuns.filter(e => {
        const uLower = (currentUser?.username || 'Guest').toLowerCase().trim();
        const pLower = e.playerName.toLowerCase().trim();
        return pLower === uLower || pLower === 'you' || pLower === 'guest';
      });
      return [...currentUserRuns].sort((a, b) => a.time - b.time).map((entry, index) => {
        const uLower = (currentUser?.username || 'Guest').toLowerCase().trim();
        const pLower = entry.playerName.toLowerCase().trim();
        const isCurrentUser = entry.id === 'user_pb' || pLower === uLower || pLower === 'you' || pLower === 'guest';
        return {
          ...entry,
          playerName: isCurrentUser ? (currentUser?.username || 'Guest') : entry.playerName,
          rank: index + 1
        };
      });
    }

    const userRankIndex = rankedWorldList.findIndex(e => {
      const uLower = (currentUser?.username || 'Guest').toLowerCase().trim();
      const pLower = e.playerName.toLowerCase().trim();
      return e.id === 'user_pb' || pLower === uLower || pLower === 'you' || pLower === 'guest';
    });
    if (worldView === 'top') {
      return rankedWorldList.slice(0, 10);
    } else {
      if (userRankIndex === -1) {
        return [];
      }
      const startIndex = Math.max(0, userRankIndex - 2);
      const endIndex = Math.min(rankedWorldList.length, startIndex + 5);
      const adjustedStartIndex = Math.max(0, Math.min(startIndex, rankedWorldList.length - 5));
      return rankedWorldList.slice(adjustedStartIndex, endIndex);
    }
  };

  const visibleEntries = getVisibleEntries();
  const userRankIndexWorld = rankedWorldList.findIndex(e => {
    const uLower = (currentUser?.username || 'Guest').toLowerCase().trim();
    const pLower = e.playerName.toLowerCase().trim();
    return e.id === 'user_pb' || pLower === uLower || pLower === 'you' || pLower === 'guest';
  });
  const showUserOutOfTop10 = filter === 'world' && worldView === 'top' && userRankIndexWorld >= 10 && playerPBEntry;

  const formatTime = (secs: number) => {
    if (secs < 0) secs = 0;
    const totalMilliseconds = Math.round(secs * 1000);
    const m = Math.floor(totalMilliseconds / 60000);
    const s = Math.floor((totalMilliseconds % 60000) / 1000);
    const ms = totalMilliseconds % 1000;
    return `${m > 0 ? `${m}:` : ''}${s.toString().padStart(m > 0 ? 2 : 1, '0')}.${ms.toString().padStart(3, '0')}s`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-50 text-sans tracking-tight">Leaderboard</h2>
              <p className="text-xs text-neutral-400 font-mono">{levelName}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-100 transition-colors p-2 hover:bg-neutral-800 rounded-lg text-sm font-semibold"
          >
            Back to Game
          </button>
        </div>

        {/* Level Stats Bar */}
        <div className="px-6 py-3 bg-neutral-950 flex flex-wrap gap-4 items-center justify-between text-xs font-mono border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Your Personal Best:</span>
            <span className="text-amber-400 font-bold">
              {currentLocalBest ? formatTime(currentLocalBest) : 'No time recorded'}
            </span>
          </div>
          {exportGhostReplay && currentLocalBest && (
            <button
              onClick={exportGhostReplay}
              className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 hover:bg-blue-500/20 px-2.5 py-1 rounded-md"
              title="Download Ghost Replay to share with others"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Ghost</span>
            </button>
          )}
        </div>

        {/* Filter Toggle */}
        <div className="p-4 flex flex-col gap-3 border-b border-neutral-800/40">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('world')}
              className={`flex-1 py-2 rounded-xl font-medium text-xs tracking-tight transition-all duration-200 cursor-pointer ${
                filter === 'world'
                  ? 'bg-neutral-100 text-neutral-950 font-semibold'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              🌍 World Rankings
            </button>
            <button
              onClick={() => setFilter('local')}
              className={`flex-1 py-2 rounded-xl font-medium text-xs tracking-tight transition-all duration-200 cursor-pointer ${
                filter === 'local'
                  ? 'bg-neutral-100 text-neutral-950 font-semibold'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              }`}
            >
              🏁 My Personal Runs
            </button>
          </div>

          {filter === 'world' && (
            <div className="flex p-0.5 bg-neutral-950 rounded-lg border border-neutral-800 gap-1">
              <button
                onClick={() => setWorldView('top')}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold tracking-tight transition-all duration-155 cursor-pointer ${
                  worldView === 'top'
                    ? 'bg-neutral-800 text-amber-500 shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                🏆 Top Times in the World
              </button>
              <button
                onClick={() => setWorldView('my_position')}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold tracking-tight transition-all duration-155 cursor-pointer ${
                  worldView === 'my_position'
                    ? 'bg-neutral-800 text-amber-500 shadow-[0_1px_3px_rgba(0,0,0,0.3)]'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                🎯 My Position
              </button>
            </div>
          )}
        </div>

        {/* Scores List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-neutral-400">
              <RefreshCw className="w-8 h-8 animate-spin text-neutral-500" />
              <span className="text-xs font-mono">Loading telemetry logs...</span>
            </div>
          ) : filter === 'world' && worldView === 'my_position' && !playerPBEntry ? (
            <div className="text-center py-12 text-neutral-500">
              <div className="text-3xl mb-3">🎯</div>
              <p className="text-sm font-semibold text-neutral-300">No World Rank Yet</p>
              <p className="text-xs mt-1.5 text-neutral-400 max-w-[240px] mx-auto leading-relaxed">
                Complete the course to log your first run, get ranked against the world's best, and see where you place!
              </p>
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <Award className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No recorded runs found yet.</p>
              <p className="text-xs mt-1">Complete the course to log your first run!</p>
            </div>
          ) : (
            <>
              {visibleEntries.map((entry, index) => {
                const uLower = (currentUser?.username || 'you').toLowerCase().trim();
                const pLower = entry.playerName.toLowerCase().trim();
                const isCurrentUser = entry.id === 'user_pb' || pLower === uLower || pLower === 'you';
                const isPrimaryUser = isCurrentUser || filter === 'local';
                const isBest = entry.rank === 1;
                const isSecond = entry.rank === 2;
                const isThird = entry.rank === 3;

                let rowBorderBg = 'bg-neutral-800/10 border-neutral-800/40 hover:bg-neutral-800/20';
                if (isPrimaryUser) {
                  rowBorderBg = 'bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.02)]';
                } else if (isBest) {
                  rowBorderBg = 'bg-amber-500/5 border-amber-500/20';
                } else if (isSecond) {
                  rowBorderBg = 'bg-neutral-300/[0.03] border-neutral-300/[0.08]';
                }

                return (
                  <div
                    key={`${entry.id}-${index}`}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${rowBorderBg}`}
                  >
                    <div className="flex items-center gap-3">
                      {/* Rank indicator */}
                      <div className="w-8 flex justify-center">
                        {isBest ? (
                          <div className="text-sm font-bold text-amber-500">1st</div>
                        ) : isSecond ? (
                          <div className="text-sm font-bold text-neutral-300">2nd</div>
                        ) : isThird ? (
                          <div className="text-sm font-bold text-orange-400">3rd</div>
                        ) : (
                          <span className={`text-xs font-mono font-bold ${isPrimaryUser ? 'text-emerald-400' : 'text-neutral-50'}`}>
                            #{entry.rank}
                          </span>
                        )}
                      </div>

                      {/* Name & Device */}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${isPrimaryUser ? 'text-emerald-400 font-bold' : 'text-neutral-300 font-medium'}`}>
                            {isCurrentUser ? (currentUser?.username || 'Guest') : (entry.playerName.toLowerCase() === 'you' || entry.playerName.toLowerCase() === 'guest' ? 'Guest' : entry.playerName)}
                          </span>
                          {isCurrentUser ? (
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium">You</span>
                          ) : (
                            <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono font-medium">Player</span>
                          )}
                        </div>
                        <div className="text-[10px] text-neutral-550 font-mono mt-0.5">
                          {new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>

                    {/* Time */}
                    <div className="flex items-center gap-3">
                      {entry.device && (
                        <span className="text-neutral-600 hover:text-neutral-400" title={`Played on ${entry.device}`}>
                          {entry.device === 'mobile' ? (
                            <Smartphone className="w-3.5 h-3.5" />
                          ) : (
                            <Monitor className="w-3.5 h-3.5" />
                          )}
                        </span>
                      )}
                      <span className={`text-sm font-bold font-mono ${isPrimaryUser ? 'text-emerald-300' : 'text-neutral-50'}`}>
                        {formatTime(entry.time)}
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Show user current ranking if out of top 10 on the World Rankings list */}
              {showUserOutOfTop10 && (
                <>
                  <div className="flex items-center justify-center gap-3 py-1.5 opacity-45">
                    <div className="h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent flex-1" />
                    <span className="text-[9px] font-mono tracking-widest text-neutral-500">YOUR WORLD PLACE</span>
                    <div className="h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent flex-1" />
                  </div>

                  <div
                    className="flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.02)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 flex justify-center">
                        <span className="text-xs font-mono font-bold text-emerald-400">#{userRankIndexWorld + 1}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-emerald-400 font-bold">
                            {currentUser?.username || 'Guest'}
                          </span>
                          <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium">You</span>
                        </div>
                        <div className="text-[10px] text-neutral-550 font-mono mt-0.5">
                          {playerPBEntry ? new Date(playerPBEntry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {playerPBEntry?.device && (
                        <span className="text-neutral-550" title={`Played on ${playerPBEntry.device}`}>
                          {playerPBEntry.device === 'mobile' ? (
                            <Smartphone className="w-3.5 h-3.5" />
                          ) : (
                            <Monitor className="w-3.5 h-3.5" />
                          )}
                        </span>
                      )}
                      <span className="text-sm font-bold font-mono text-emerald-300">
                        {playerPBEntry ? formatTime(playerPBEntry.time) : ''}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* Clear Stats & Refresh */}
        <div className="p-4 border-t border-neutral-800/80 bg-neutral-900/50 flex gap-2 justify-between">
          <button
            onClick={clearLocalScores}
            className="text-[10px] text-red-400/80 hover:text-red-400 font-mono hover:underline"
          >
            Clear my local runs
          </button>
          <button
            onClick={loadScores}
            className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 font-mono"
          >
            <RefreshCw className="w-3 h-3" />
            Reload
          </button>
        </div>

      </div>
    </div>
  );
}
