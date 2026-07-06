import React, { useState, useEffect } from 'react';
import { Trophy, RefreshCw, Award, LineChart, Activity, TrendingUp, GitCompare } from 'lucide-react';
import { LeaderboardEntry, UserAccount } from '../types';
import { api } from '../api';
import VelocityChart from './VelocityChart';

interface LeaderboardProps {
  levelId: string;
  levelName: string;
  localBest: number | null;
  onClose: () => void;
  currentUser?: UserAccount | null;
  onViewProfile?: (username: string) => void;
}

export default function Leaderboard({ levelId, levelName, localBest, onClose, currentUser, onViewProfile }: LeaderboardProps) {
  const [filter, setFilter] = useState<'world' | 'local'>('world');
  const [worldView, setWorldView] = useState<'top' | 'my_position'>('top');
  const [rawEntries, setRawEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentLocalBest, setCurrentLocalBest] = useState<number | null>(localBest);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [compareRunId, setCompareRunId] = useState<string | null>(null);
  const [userIconMap, setUserIconMap] = useState<Record<string, { avatar: string; avatarBg: string }>>({});

  useEffect(() => {
    setCurrentLocalBest(localBest);
  }, [localBest]);

  useEffect(() => {
    loadScores();
  }, [levelId]);

  // Keep current user's own icon in sync if they change it mid-session
  useEffect(() => {
    if (currentUser) {
      setUserIconMap(prev => ({
        ...prev,
        [currentUser.username.toLowerCase().trim()]: {
          avatar: currentUser.avatar || '🚀',
          avatarBg: currentUser.avatarBg || 'bg-rose-500',
        },
      }));
    }
  }, [currentUser?.avatar, currentUser?.avatarBg, currentUser?.username]);

  const loadScores = async () => {
    setLoading(true);
    try {
      const [entries, allUsers] = await Promise.all([
        api.leaderboard.get(levelId),
        api.auth.getAllUsers(),
      ]);
      const iconMap: Record<string, { avatar: string; avatarBg: string }> = {};
      for (const u of allUsers) {
        iconMap[u.username.toLowerCase().trim()] = {
          avatar: u.avatar || '🚀',
          avatarBg: u.avatarBg || 'bg-rose-500',
        };
      }
      if (currentUser) {
        iconMap[currentUser.username.toLowerCase().trim()] = {
          avatar: currentUser.avatar || '🚀',
          avatarBg: currentUser.avatarBg || 'bg-rose-500',
        };
      }
      setUserIconMap(iconMap);
      setRawEntries(entries.filter(e => e.time > 0.05));
    } catch (e) {
      console.error('Error loading leaderboard:', e);
    } finally {
      setLoading(false);
    }
  };

  const clearLocalScores = async () => {
    if (!window.confirm('Clear your personal runs for this level from the leaderboard?')) return;
    try {
      await api.leaderboard.clearMyRuns(levelId);
      localStorage.removeItem(`best_time_${levelId}`);
      localStorage.removeItem(`ghost_replay_${levelId}`);
      setCurrentLocalBest(null);
      await loadScores();
    } catch (e) {
      console.error('Failed to clear runs:', e);
    }
  };

  const getPlayerIcon = (playerName: string): { avatar: string; avatarBg: string } => {
    const normName = playerName.toLowerCase().trim();
    if (userIconMap[normName]) return userIconMap[normName];
    // Fallback for very old entries not present in the user table
    const emojis = ['🚀', '⚡', '🛹', '🐺', '🐉', '🤖', '🐱', '🦊', '🎯', '🔥', '👑', '🦁'];
    const bgs = ['bg-rose-500', 'bg-green-500', 'bg-purple-500', 'bg-blue-500', 'bg-amber-500', 'bg-indigo-500'];
    let hash = 0;
    for (let i = 0; i < normName.length; i++) {
      hash = normName.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
    return { avatar: emojis[hash % emojis.length], avatarBg: bgs[hash % bgs.length] };
  };

  const getGroupedWorldPlayers = (): LeaderboardEntry[] => {
    const playerBestRuns: { [username: string]: LeaderboardEntry } = {};
    rawEntries.forEach(run => {
      const userKey = run.playerName.toLowerCase().trim();
      if (!playerBestRuns[userKey] || run.time < playerBestRuns[userKey].time) {
        playerBestRuns[userKey] = run;
      }
    });
    return Object.values(playerBestRuns);
  };

  const playerPBEntry: LeaderboardEntry | null = currentLocalBest ? {
    id: 'user_pb',
    levelId,
    playerName: currentUser?.username || 'Guest',
    time: currentLocalBest,
    date: (() => {
      const found = rawEntries.find(r => Math.abs(r.time - currentLocalBest) < 0.001);
      return found ? found.date : Date.now();
    })(),
    device: (() => {
      const found = rawEntries.find(r => Math.abs(r.time - currentLocalBest) < 0.001);
      return found?.device;
    })(),
    speeds: (() => {
      const found = rawEntries.find(r => Math.abs(r.time - currentLocalBest) < 0.001);
      return found?.speeds;
    })(),
    actions: (() => {
      const found = rawEntries.find(r => Math.abs(r.time - currentLocalBest) < 0.001);
      return found?.actions;
    })()
  } : null;

  const worldRealPlayers = getGroupedWorldPlayers();
  const mergedWorldList = [...worldRealPlayers];
  if (playerPBEntry && !mergedWorldList.some(r => r.playerName.toLowerCase().trim() === (currentUser?.username || 'Guest').toLowerCase().trim())) {
    mergedWorldList.push(playerPBEntry);
  }
  mergedWorldList.sort((a, b) => a.time - b.time);

  const rankedWorldList = mergedWorldList.map((entry, index) => {
    const uLower = (currentUser?.username || 'Guest').toLowerCase().trim();
    const pLower = entry.playerName.toLowerCase().trim();
    const isCurrentUser = entry.id === 'user_pb' || pLower === uLower;
    return { ...entry, playerName: isCurrentUser ? (currentUser?.username || 'Guest') : entry.playerName, rank: index + 1 };
  });

  const myRuns = rawEntries
    .filter(e => e.playerName.toLowerCase().trim() === (currentUser?.username || '').toLowerCase().trim())
    .sort((a, b) => a.time - b.time)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));

  const getVisibleEntries = () => {
    if (filter === 'local') return myRuns;
    const userRankIndex = rankedWorldList.findIndex(e => {
      const uLower = (currentUser?.username || 'Guest').toLowerCase().trim();
      return e.id === 'user_pb' || e.playerName.toLowerCase().trim() === uLower;
    });
    if (worldView === 'top') return rankedWorldList.slice(0, 10);
    if (userRankIndex === -1) return [];
    const startIndex = Math.max(0, Math.min(userRankIndex - 2, rankedWorldList.length - 5));
    return rankedWorldList.slice(startIndex, startIndex + 5);
  };

  const visibleEntries = getVisibleEntries();

  const getComparableEntries = (excludeId: string): LeaderboardEntry[] => {
    const bestPerPlayer: { [key: string]: LeaderboardEntry } = {};
    const candidates = [...rawEntries, ...(playerPBEntry ? [playerPBEntry] : [])];
    candidates.forEach(run => {
      if (run.id === excludeId || !run.speeds || run.speeds.length === 0) return;
      const key = run.playerName.toLowerCase().trim();
      if (!bestPerPlayer[key] || run.time < bestPerPlayer[key].time) {
        bestPerPlayer[key] = run;
      }
    });
    return Object.values(bestPerPlayer).sort((a, b) => a.time - b.time);
  };
  const userRankIndexWorld = rankedWorldList.findIndex(e => {
    const uLower = (currentUser?.username || 'Guest').toLowerCase().trim();
    return e.id === 'user_pb' || e.playerName.toLowerCase().trim() === uLower;
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
        
        <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <Trophy className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-neutral-50 tracking-tight">Leaderboard</h2>
              <p className="text-xs text-neutral-400 font-mono">{levelName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-100 transition-colors p-2 hover:bg-neutral-800 rounded-lg text-sm font-semibold">
            Back to Game
          </button>
        </div>

        <div className="px-6 py-3 bg-neutral-950 flex flex-wrap gap-4 items-center justify-between text-xs font-mono border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <span className="text-neutral-500">Your Personal Best:</span>
            <span className="text-amber-400 font-bold">
              {currentLocalBest ? formatTime(currentLocalBest) : 'No time recorded'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadScores} className="flex items-center gap-1 text-neutral-500 hover:text-indigo-400 transition cursor-pointer">
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            {currentLocalBest && (
              <button onClick={clearLocalScores} className="text-rose-500 hover:text-rose-400 transition cursor-pointer">
                Clear My Runs
              </button>
            )}
          </div>
        </div>

        <div className="p-4 flex flex-col gap-3 border-b border-neutral-800/40">
          <div className="flex gap-2">
            <button onClick={() => setFilter('world')}
              className={`flex-1 py-2 rounded-xl font-medium text-xs tracking-tight transition-all duration-200 cursor-pointer ${filter === 'world' ? 'bg-neutral-100 text-neutral-950 font-semibold' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}>
              🌍 World Rankings
            </button>
            <button onClick={() => setFilter('local')}
              className={`flex-1 py-2 rounded-xl font-medium text-xs tracking-tight transition-all duration-200 cursor-pointer ${filter === 'local' ? 'bg-neutral-100 text-neutral-950 font-semibold' : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'}`}>
              🏁 My Personal Runs
            </button>
          </div>

          {filter === 'world' && (
            <div className="flex p-0.5 bg-neutral-950 rounded-lg border border-neutral-800 gap-1">
              <button onClick={() => setWorldView('top')}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold tracking-tight transition-all duration-155 cursor-pointer ${worldView === 'top' ? 'bg-neutral-800 text-amber-500' : 'text-neutral-400 hover:text-neutral-200'}`}>
                🏆 Top Times
              </button>
              <button onClick={() => setWorldView('my_position')}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold tracking-tight transition-all duration-155 cursor-pointer ${worldView === 'my_position' ? 'bg-neutral-800 text-amber-500' : 'text-neutral-400 hover:text-neutral-200'}`}>
                🎯 My Position
              </button>
            </div>
          )}
        </div>

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
                Complete the course to get ranked against the world!
              </p>
            </div>
          ) : visibleEntries.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <Award className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">No recorded runs yet.</p>
              <p className="text-xs mt-1">Complete the course to log your first run!</p>
            </div>
          ) : (
            <>
              {visibleEntries.map((entry, index) => {
                const uLower = (currentUser?.username || '').toLowerCase().trim();
                const pLower = entry.playerName.toLowerCase().trim();
                const isCurrentUser = entry.id === 'user_pb' || pLower === uLower;
                const isPrimaryUser = isCurrentUser || filter === 'local';
                const isBest = entry.rank === 1;
                const isSecond = entry.rank === 2;
                const isExpanded = expandedRunId === entry.id;

                let rowBorderBg = 'bg-neutral-800/10 border-neutral-800/40 hover:bg-neutral-800/20';
                if (isPrimaryUser) rowBorderBg = 'bg-emerald-500/5 border-emerald-500/20';
                else if (isBest) rowBorderBg = 'bg-amber-500/5 border-amber-500/20';
                else if (isSecond) rowBorderBg = 'bg-neutral-300/[0.03] border-neutral-300/[0.08]';

                return (
                  <div key={`${entry.id}-${index}`} className="flex flex-col gap-2 w-full">
                    <div className={`flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 ${rowBorderBg}`}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 flex justify-center">
                          {isBest ? <div className="text-sm font-bold text-amber-500">1st</div>
                            : isSecond ? <div className="text-sm font-bold text-neutral-300">2nd</div>
                            : entry.rank === 3 ? <div className="text-sm font-bold text-orange-400">3rd</div>
                            : <span className={`text-xs font-mono font-bold ${isPrimaryUser ? 'text-emerald-400' : 'text-neutral-50'}`}>#{entry.rank}</span>
                          }
                        </div>

                        {(() => {
                          const playerIcon = getPlayerIcon(entry.playerName);
                          return (
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-sm border border-neutral-700/50 flex-shrink-0 ${playerIcon.avatarBg}`}>
                              {playerIcon.avatar}
                            </div>
                          );
                        })()}

                        <div>
                          <div className="flex items-center gap-2">
                            <span
                              onClick={() => onViewProfile && onViewProfile(isCurrentUser ? (currentUser?.username || 'Guest') : entry.playerName)}
                              className={`text-sm select-none ${isPrimaryUser ? 'text-emerald-400 font-bold' : 'text-neutral-300 font-medium'} ${onViewProfile ? 'cursor-pointer hover:text-indigo-400 hover:underline transition-colors duration-150' : ''}`}
                            >
                              {isCurrentUser ? (currentUser?.username || 'Guest') : entry.playerName}
                            </span>
                            {isCurrentUser ? (
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium">You</span>
                            ) : (
                              <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono font-medium">Player</span>
                            )}
                          </div>
                          {filter === 'local' && (
                            <div className="text-[10px] text-white font-mono mt-0.5">
                              {new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        {entry.speeds && entry.speeds.length > 0 && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => { if (isExpanded) { setExpandedRunId(null); setCompareRunId(null); } else { setExpandedRunId(entry.id); setCompareRunId(null); } }}
                              className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center border ${isExpanded ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' : 'text-neutral-500 hover:text-indigo-400 hover:bg-neutral-800 border-transparent'}`}
                              title="Show velocity graph"
                            >
                              <LineChart className="w-3.5 h-3.5" />
                            </button>
                            {expandedRunId && (
                              <button
                                onClick={() => {
                                  if (entry.id === expandedRunId) return;
                                  if (!expandedRunId) { setExpandedRunId(entry.id); return; }
                                  setCompareRunId(prev => prev === entry.id ? null : entry.id);
                                }}
                                disabled={entry.id === expandedRunId}
                                className={`p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center border ${
                                  entry.id === expandedRunId
                                    ? 'text-neutral-700 border-transparent cursor-not-allowed'
                                    : compareRunId === entry.id
                                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 cursor-pointer'
                                      : 'text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 border-transparent cursor-pointer'
                                }`}
                                title={entry.id === expandedRunId ? 'This is the run currently shown' : compareRunId === entry.id ? 'Remove comparison' : 'Compare with open graph'}
                              >
                                <GitCompare className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                        <span className={`text-sm font-bold font-mono ${isPrimaryUser ? 'text-emerald-300' : 'text-neutral-50'}`}>
                          {formatTime(entry.time)}
                        </span>
                      </div>
                    </div>

                    {isExpanded && entry.speeds && entry.speeds.length > 0 && (() => {
                      const comparableEntries = getComparableEntries(entry.id);
                      const allCandidates = [...rawEntries, ...(playerPBEntry ? [playerPBEntry] : [])];
                      const compareEntry = compareRunId ? allCandidates.find(c => c.id === compareRunId) : null;
                      const compareLabel = compareEntry
                        ? (compareEntry.playerName.toLowerCase().trim() === (currentUser?.username || '').toLowerCase().trim() ? `${compareEntry.playerName} (You)` : compareEntry.playerName)
                        : null;
                      const primaryLabel = isCurrentUser ? (currentUser?.username || 'You') : entry.playerName;

                      return (
                        <div className="bg-neutral-950/80 border border-neutral-800/60 rounded-xl p-4 ml-2">
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            <Activity className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Velocity Profile</span>
                            <span className="ml-auto text-[10px] font-mono text-neutral-500 flex items-center gap-3">
                              <span>Peak: {Math.max(...entry.speeds).toFixed(1)} m/s</span>
                              <span className="flex items-center gap-1"><TrendingUp className="w-2.5 h-2.5 text-amber-500" /> Avg: {(entry.speeds.reduce((a, b) => a + b, 0) / entry.speeds.length).toFixed(1)} m/s</span>
                            </span>
                          </div>

                          {!compareEntry && comparableEntries.length > 0 && (
                            <div className="flex items-center gap-1.5 mb-3 text-[9px] font-mono text-neutral-600">
                              <GitCompare className="w-3 h-3 text-neutral-600 flex-shrink-0" />
                              Click the <GitCompare className="w-2.5 h-2.5 text-rose-400 inline-block" /> icon on another run to overlay it here
                            </div>
                          )}

                          <VelocityChart
                            speeds={entry.speeds}
                            totalTime={entry.time}
                            label={primaryLabel}
                            compare={compareEntry && compareEntry.speeds ? { speeds: compareEntry.speeds, totalTime: compareEntry.time, label: compareLabel! } : null}
                          />
                        </div>
                      );
                    })()}
                  </div>
                );
              })}

              {showUserOutOfTop10 && playerPBEntry && (
                <div className="mt-2 pt-2 border-t border-neutral-800/40">
                  <div className="flex items-center justify-between p-3.5 rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                    <div className="flex items-center gap-3">
                      <div className="w-8 flex justify-center">
                        <span className="text-xs font-mono font-bold text-emerald-400">#{userRankIndexWorld + 1}</span>
                      </div>
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm ${currentUser?.avatarBg || 'bg-rose-500'}`}>
                        {currentUser?.avatar || '🚀'}
                      </div>
                      <span className="text-sm text-emerald-400 font-bold">{currentUser?.username || 'You'}</span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono">You</span>
                    </div>
                    <span className="text-sm font-bold font-mono text-emerald-300">{formatTime(playerPBEntry.time)}</span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
