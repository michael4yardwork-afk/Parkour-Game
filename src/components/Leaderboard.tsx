import React, { useState, useEffect } from 'react';
import { Trophy, RefreshCw, Smartphone, Monitor, Award, LineChart, Activity, TrendingUp, GitCompare } from 'lucide-react';
import { LeaderboardEntry, UserAccount } from '../types';

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
  const [rawLocalRuns, setRawLocalRuns] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentLocalBest, setCurrentLocalBest] = useState<number | null>(localBest);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [compareRunId, setCompareRunId] = useState<string | null>(null);

  // Keep currentLocalBest synced with incoming prop
  useEffect(() => {
    setCurrentLocalBest(localBest);
  }, [localBest]);

  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('momentum_users');
      if (stored) {
        setAllUsers(JSON.parse(stored));
      }
    } catch (e) {
      console.error(e);
    }
  }, [currentUser]);

  const getPlayerIcon = (playerName: string): { avatar: string; avatarBg: string } => {
    const normName = playerName.toLowerCase().trim();
    
    // 1. If it matches current user
    if (currentUser && currentUser.username.toLowerCase().trim() === normName) {
      return {
        avatar: currentUser.avatar || '🚀',
        avatarBg: currentUser.avatarBg || 'bg-rose-500'
      };
    }
    
    // 2. Look up in allUsers (synced state with localStorage)
    const found = allUsers.find(u => u.username.toLowerCase().trim() === normName);
    if (found) {
      return {
        avatar: found.avatar || '🚀',
        avatarBg: found.avatarBg || 'bg-rose-500'
      };
    }

    // 3. Direct lookup from localStorage as final fallback in case state hasn't updated yet
    try {
      const stored = localStorage.getItem('momentum_users');
      if (stored) {
        const usersList: UserAccount[] = JSON.parse(stored);
        const foundLocal = usersList.find(u => u.username.toLowerCase().trim() === normName);
        if (foundLocal) {
          return {
            avatar: foundLocal.avatar || '🚀',
            avatarBg: foundLocal.avatarBg || 'bg-rose-500'
          };
        }
      }
    } catch (e) {
      console.error(e);
    }
    
    // 4. Fallback: deterministic selection based on hash of the playerName
    const emojis = ['🚀', '⚡', '🛹', '🐺', '🐉', '🤖', '🐱', '🦊', '🎯', '🔥', '👑', '🦁'];
    const bgs = ['bg-rose-500', 'bg-green-500', 'bg-purple-500', 'bg-blue-500', 'bg-amber-500', 'bg-indigo-500'];
    
    let hash = 0;
    for (let i = 0; i < normName.length; i++) {
      hash = normName.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
    
    const avatar = emojis[hash % emojis.length];
    const avatarBg = bgs[hash % bgs.length];
    
    return { avatar, avatarBg };
  };

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
    })(),
    speeds: (() => {
      const found = rawLocalRuns.find(r => Math.abs(r.time - currentLocalBest) < 0.001);
      return found ? found.speeds : undefined;
    })(),
    actions: (() => {
      const found = rawLocalRuns.find(r => Math.abs(r.time - currentLocalBest) < 0.001);
      return found ? found.actions : undefined;
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

  const findEntryById = (id: string | null): LeaderboardEntry | null => {
    if (!id) return null;
    if (id === 'user_pb' && playerPBEntry) return playerPBEntry;
    const foundInVisible = visibleEntries.find(e => e.id === id);
    if (foundInVisible) return foundInVisible;
    const foundInWorld = rankedWorldList.find(e => e.id === id);
    if (foundInWorld) return foundInWorld;
    const foundInLocal = rawLocalRuns.find(e => e.id === id);
    if (foundInLocal) return foundInLocal;
    return null;
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

                const isExpanded = expandedRunId === entry.id;

                return (
                  <div key={`${entry.id}-${index}`} className="flex flex-col gap-2 w-full">
                    <div
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

                        {/* Player Icon (Emoji and Theme Background) */}
                        {(() => {
                          const playerIcon = getPlayerIcon(entry.playerName);
                          return (
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-sm border border-neutral-700/50 flex-shrink-0 ${playerIcon.avatarBg}`}>
                              {playerIcon.avatar}
                            </div>
                          );
                        })()}

                        {/* Name & Device */}
                        <div>
                          <div className="flex items-center gap-2">
                            <span 
                              onClick={() => {
                                if (onViewProfile) {
                                  const targetName = isCurrentUser ? (currentUser?.username || 'Guest') : (entry.playerName.toLowerCase() === 'you' || entry.playerName.toLowerCase() === 'guest' ? 'Guest' : entry.playerName);
                                  onViewProfile(targetName);
                                }
                              }}
                              className={`text-sm select-none ${isPrimaryUser ? 'text-emerald-400 font-bold' : 'text-neutral-300 font-medium'} ${onViewProfile ? 'cursor-pointer hover:text-indigo-400 hover:underline transition-colors duration-150' : ''}`}
                            >
                              {isCurrentUser ? (currentUser?.username || 'Guest') : (entry.playerName.toLowerCase() === 'you' || entry.playerName.toLowerCase() === 'guest' ? 'Guest' : entry.playerName)}
                            </span >
                            {isCurrentUser ? (
                              <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium">You</span>
                            ) : (
                              <span className="text-[9px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono font-medium">Player</span>
                            )}
                          </div>
                          {filter !== 'world' && (
                            <div className="text-[10px] text-white font-mono mt-0.5">
                              {new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Time */}
                      <div className="flex items-center gap-3">
                        {expandedRunId && !isExpanded && (
                          <button
                            onClick={() => setCompareRunId(compareRunId === entry.id ? null : entry.id)}
                            className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center border ${
                              compareRunId === entry.id
                                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                                : 'text-neutral-500 hover:text-amber-400 hover:bg-neutral-800 border-transparent'
                            }`}
                            title={compareRunId === entry.id ? "Remove from comparison" : "Compare with active graph"}
                          >
                            <GitCompare className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (isExpanded) {
                              setExpandedRunId(null);
                              setCompareRunId(null);
                            } else {
                              setExpandedRunId(entry.id);
                              if (compareRunId === entry.id) {
                                setCompareRunId(null);
                              }
                            }
                          }}
                          className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center border ${
                            isExpanded 
                              ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 shadow-[0_0_8px_rgba(99,102,241,0.15)]' 
                              : 'text-neutral-500 hover:text-indigo-400 hover:bg-neutral-800 border-transparent'
                          }`}
                          title="Show velocity graph"
                        >
                          <LineChart className="w-3.5 h-3.5" />
                        </button>
                        <span className={`text-sm font-bold font-mono ${isPrimaryUser ? 'text-emerald-300' : 'text-neutral-50'}`}>
                          {formatTime(entry.time)}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <VelocityChart
                        speeds={entry.speeds || generateSyntheticSpeeds(entry.time, entry.id)}
                        actions={entry.actions}
                        time={entry.time}
                        playerName={entry.playerName}
                        entryId={entry.id}
                        compareSpeeds={compareRunId ? (findEntryById(compareRunId)?.speeds || generateSyntheticSpeeds(findEntryById(compareRunId)!.time, compareRunId)) : undefined}
                        compareActions={compareRunId ? findEntryById(compareRunId)?.actions : undefined}
                        compareTime={compareRunId ? findEntryById(compareRunId)?.time : undefined}
                        comparePlayerName={compareRunId ? findEntryById(compareRunId)?.playerName : undefined}
                        compareEntryId={compareRunId || undefined}
                        onClearCompare={() => setCompareRunId(null)}
                      />
                    )}
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

                  {(() => {
                    const isUserPbExpanded = expandedRunId === 'user_pb';
                    return (
                      <div className="flex flex-col gap-2 w-full">
                        <div
                          className="flex items-center justify-between p-3.5 rounded-xl border transition-all duration-200 bg-emerald-500/5 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.02)]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 flex justify-center">
                              <span className="text-xs font-mono font-bold text-emerald-400">#{userRankIndexWorld + 1}</span>
                            </div>

                            {/* Player Icon (Emoji and Theme Background) */}
                            {(() => {
                              const playerIcon = getPlayerIcon(currentUser?.username || 'Guest');
                              return (
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-sm border border-neutral-700/50 flex-shrink-0 ${playerIcon.avatarBg}`}>
                                  {playerIcon.avatar}
                                </div>
                              );
                            })()}

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-emerald-400 font-bold">
                                  {currentUser?.username || 'Guest'}
                                </span>
                                <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-mono font-medium">You</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {expandedRunId && !isUserPbExpanded && (
                              <button
                                onClick={() => setCompareRunId(compareRunId === 'user_pb' ? null : 'user_pb')}
                                className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center border ${
                                  compareRunId === 'user_pb'
                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.15)]'
                                    : 'text-neutral-550 hover:text-amber-400 hover:bg-neutral-800 border-transparent'
                                }`}
                                title={compareRunId === 'user_pb' ? "Remove from comparison" : "Compare with active graph"}
                              >
                                <GitCompare className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (isUserPbExpanded) {
                                  setExpandedRunId(null);
                                  setCompareRunId(null);
                                } else {
                                  setExpandedRunId('user_pb');
                                  if (compareRunId === 'user_pb') {
                                    setCompareRunId(null);
                                  }
                                }
                              }}
                              className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer flex items-center justify-center border ${
                                isUserPbExpanded 
                                  ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30 shadow-[0_0_8px_rgba(99,102,241,0.15)]' 
                                  : 'text-neutral-500 hover:text-indigo-400 hover:bg-neutral-800 border-transparent'
                              }`}
                              title="Show velocity graph"
                            >
                              <LineChart className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-sm font-bold font-mono text-emerald-300">
                              {playerPBEntry ? formatTime(playerPBEntry.time) : ''}
                            </span>
                          </div>
                        </div>

                        {isUserPbExpanded && playerPBEntry && (
                          <VelocityChart
                            speeds={playerPBEntry.speeds || generateSyntheticSpeeds(playerPBEntry.time, playerPBEntry.id)}
                            actions={playerPBEntry.actions}
                            time={playerPBEntry.time}
                            playerName={playerPBEntry.playerName}
                            entryId={playerPBEntry.id}
                            compareSpeeds={compareRunId ? (findEntryById(compareRunId)?.speeds || generateSyntheticSpeeds(findEntryById(compareRunId)!.time, compareRunId)) : undefined}
                            compareActions={compareRunId ? findEntryById(compareRunId)?.actions : undefined}
                            compareTime={compareRunId ? findEntryById(compareRunId)?.time : undefined}
                            comparePlayerName={compareRunId ? findEntryById(compareRunId)?.playerName : undefined}
                            compareEntryId={compareRunId || undefined}
                            onClearCompare={() => setCompareRunId(null)}
                          />
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}

const generateSyntheticSpeeds = (time: number, entryId: string): number[] => {
  const points = 60;
  const speeds: number[] = [];
  
  // Create a pseudo-random seed from the entryId
  let seed = 0;
  for (let i = 0; i < entryId.length; i++) {
    seed += entryId.charCodeAt(i);
  }
  
  for (let i = 0; i < points; i++) {
    const progress = i / (points - 1);
    
    // Initial acceleration phase
    let speed = 0;
    if (progress < 0.15) {
      speed = (progress / 0.15) * 12;
    } else {
      // Base runner speed around 12 - 16 m/s
      speed = 12 + Math.sin(progress * Math.PI * 4 + seed) * 3;
      
      // Add a couple of speed boost peaks (boosters/conveyors)
      const peak1 = Math.sin(seed * 0.7) * 0.3 + 0.4; // between 0.1 and 0.7
      const peak2 = Math.sin(seed * 1.3) * 0.3 + 0.7; // between 0.4 and 1.0
      
      if (Math.abs(progress - peak1) < 0.1) {
        const factor = 1 - Math.abs(progress - peak1) / 0.1;
        speed += factor * 14; // speed booster spike up to 26-30m/s!
      }
      if (Math.abs(progress - peak2) < 0.08) {
        const factor = 1 - Math.abs(progress - peak2) / 0.08;
        speed += factor * 10;
      }
      
      // Add a slight slide/deceleration dip
      const dip = Math.sin(seed * 2.1) * 0.2 + 0.55;
      if (Math.abs(progress - dip) < 0.07) {
        const factor = 1 - Math.abs(progress - dip) / 0.07;
        speed -= factor * 4;
      }
    }
    
    // Add minor micro-fluctuations (physics noise)
    const noise = Math.sin(progress * 50 + seed) * 0.6;
    speed = Math.max(0.5, speed + noise);
    speeds.push(parseFloat(speed.toFixed(2)));
  }
  
  return speeds;
};

const generateSyntheticActions = (speeds: number[], time: number, entryId: string): string[] => {
  const totalPoints = speeds.length;
  const actions: string[] = [];
  
  // Create a pseudo-random seed from the entryId
  let seed = 0;
  for (let i = 0; i < entryId.length; i++) {
    seed += entryId.charCodeAt(i);
  }
  
  for (let i = 0; i < totalPoints; i++) {
    const progress = i / (totalPoints - 1);
    const speed = speeds[i];
    
    let action = 'Sprinting';
    
    // Initial jump phase after starting (progress around 0.08 - 0.18)
    const jumpStart = 0.08 + (seed % 4) * 0.03;
    const jumpEnd = jumpStart + 0.12;
    
    if (progress < 0.04) {
      action = 'Sprinting';
    } else if (progress >= jumpStart && progress < jumpEnd) {
      action = 'Airborne';
    } else if (speed > 20) {
      action = 'Wall Riding';
    } else if (speed < 7 && progress > 0.4) {
      action = 'Climbing';
    } else if (speed < 11.5) {
      action = 'Sliding';
    } else {
      action = 'Sprinting';
    }
    
    actions.push(action);
  }
  
  return actions;
};

interface VelocityChartProps {
  speeds: number[];
  actions?: string[];
  time: number;
  playerName: string;
  entryId: string;
  
  compareSpeeds?: number[];
  compareActions?: string[];
  compareTime?: number;
  comparePlayerName?: string;
  compareEntryId?: string;
  onClearCompare?: () => void;
}

function VelocityChart({ 
  speeds, 
  actions, 
  time, 
  playerName, 
  entryId,
  compareSpeeds,
  compareActions,
  compareTime,
  comparePlayerName,
  compareEntryId,
  onClearCompare
}: VelocityChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  
  const totalPoints = speeds.length;
  if (totalPoints === 0) return null;

  // Compute scale based on the maximum of both runs!
  const allSpeeds = compareSpeeds ? [...speeds, ...compareSpeeds] : speeds;
  const maxSpeed = Math.max(...allSpeeds, 1);
  const avgSpeed = parseFloat((speeds.reduce((a, b) => a + b, 0) / totalPoints).toFixed(1));

  const compareAvgSpeed = compareSpeeds 
    ? parseFloat((compareSpeeds.reduce((a, b) => a + b, 0) / compareSpeeds.length).toFixed(1))
    : undefined;

  // Determine actions for the runs
  const runActions = actions && actions.length === totalPoints 
    ? actions 
    : generateSyntheticActions(speeds, time, entryId);

  const compareRunActions = compareSpeeds && compareTime && compareEntryId
    ? (compareActions && compareActions.length === compareSpeeds.length
       ? compareActions
       : generateSyntheticActions(compareSpeeds, compareTime, compareEntryId))
    : [];

  // Dimensions of SVG
  const width = 500;
  const height = 140;
  const paddingX = 40;
  const paddingY = 20;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  // Build points for primary run
  const points = speeds.map((speed, idx) => {
    const x = paddingX + (idx / (totalPoints - 1)) * chartWidth;
    const y = paddingY + chartHeight - (speed / maxSpeed) * chartHeight;
    return { x, y, speed, index: idx };
  });

  const linePath = points.map((p, idx) => {
    return `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(' ');

  const fillPath = `${linePath} L ${(paddingX + chartWidth).toFixed(1)} ${(paddingY + chartHeight).toFixed(1)} L ${paddingX} ${(paddingY + chartHeight).toFixed(1)} Z`;

  // Build points for comparison run
  const comparePoints = compareSpeeds ? compareSpeeds.map((speed, idx) => {
    const x = paddingX + (idx / (compareSpeeds.length - 1)) * chartWidth;
    const y = paddingY + chartHeight - (speed / maxSpeed) * chartHeight;
    return { x, y, speed, index: idx };
  }) : [];

  const compareLinePath = comparePoints.map((p, idx) => {
    return `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
  }).join(' ');

  const compareFillPath = comparePoints.length > 0 
    ? `${compareLinePath} L ${(paddingX + chartWidth).toFixed(1)} ${(paddingY + chartHeight).toFixed(1)} L ${paddingX} ${(paddingY + chartHeight).toFixed(1)} Z`
    : '';

  // Grid lines
  const gridLines = [0.25, 0.5, 0.75, 1.0].map((ratio) => {
    const val = maxSpeed * ratio;
    const y = paddingY + chartHeight - ratio * chartHeight;
    return { y, label: `${val.toFixed(1)}` };
  });

  const getActionTag = (actionName: string) => {
    switch (actionName) {
      case 'Sprinting':
        return { text: '🏃 SPRINTS', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' };
      case 'Wall Riding':
        return { text: '🧱 WALL RIDE', color: 'text-cyan-400 bg-cyan-500/15 border-cyan-500/30' };
      case 'Sliding':
        return { text: '🛹 SLIDING', color: 'text-amber-400 bg-amber-500/15 border-amber-500/30' };
      case 'Climbing':
        return { text: '🧗 CLIMBING', color: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30' };
      case 'Airborne':
        return { text: '🪶 AIR TIME', color: 'text-purple-400 bg-purple-500/15 border-purple-500/30' };
      default:
        return { text: '🏃 SPRINTS', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30' };
    }
  };

  const activePoint = hoveredIdx !== null ? points[hoveredIdx] : null;
  const compareActivePoint = hoveredIdx !== null && comparePoints.length > 0 
    ? comparePoints[Math.min(hoveredIdx, comparePoints.length - 1)] 
    : null;

  return (
    <div className="bg-neutral-900/90 border border-neutral-800/80 rounded-2xl p-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-xs font-bold font-mono tracking-wider text-neutral-300 uppercase">
            {compareSpeeds ? (activePoint ? 'Comparative Trace' : 'Run Comparison Profile') : (activePoint ? 'Trace' : 'Speed Profile')}
          </span>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {activePoint ? (
            <>
              {/* Primary Player Trace */}
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg font-mono text-[10px] ${
                compareSpeeds 
                  ? 'bg-emerald-500/10 border border-emerald-500/20' 
                  : 'bg-neutral-950 border border-neutral-800/50'
              }`}>
                {compareSpeeds && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                {compareSpeeds && <span className="text-neutral-300 font-bold">{playerName}:</span>}
                <span className="text-emerald-400 font-black">
                  {((activePoint.index / (totalPoints - 1)) * time).toFixed(2)}s
                </span>
                <span className="text-neutral-505">@</span>
                <span className="text-amber-400 font-black">
                  {activePoint.speed.toFixed(1)} m/s
                </span>
                {(() => {
                  const actionName = runActions[activePoint.index] || 'Sprinting';
                  const tag = getActionTag(actionName);
                  return (
                    <span className="text-neutral-300 text-[8px] opacity-90 px-1 py-0.2 bg-neutral-950/40 rounded font-bold">
                      {tag.text.split(' ')[1]}
                    </span>
                  );
                })()}
              </div>

              {/* Compared Player Trace */}
              {compareActivePoint && compareTime && comparePlayerName && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 font-mono text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <span className="text-neutral-300 font-bold">{comparePlayerName}:</span>
                  <span className="text-amber-400 font-black">
                    {((compareActivePoint.index / (comparePoints.length - 1)) * compareTime).toFixed(2)}s
                  </span>
                  <span className="text-neutral-505">@</span>
                  <span className="text-cyan-400 font-black">
                    {compareActivePoint.speed.toFixed(1)} m/s
                  </span>
                  {(() => {
                    const actionName = compareRunActions[compareActivePoint.index] || 'Sprinting';
                    const tag = getActionTag(actionName);
                    return (
                      <span className="text-neutral-300 text-[8px] opacity-90 px-1 py-0.2 bg-neutral-950/40 rounded font-bold">
                        {tag.text.split(' ')[1]}
                      </span>
                    );
                  })()}
                </div>
              )}
            </>
          ) : (
            <>
              {/* Primary Player Summary */}
              {compareSpeeds && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 font-mono text-[10px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span className="text-neutral-300 font-bold">{playerName}:</span>
                  <span className="text-neutral-550">MAX:</span>
                  <span className="text-amber-400 font-black">{Math.max(...speeds).toFixed(1)} m/s</span>
                  <span className="text-neutral-550">AVG:</span>
                  <span className="text-indigo-400 font-black">{avgSpeed} m/s</span>
                  <span className="text-neutral-550">DUR:</span>
                  <span className="text-emerald-400 font-black">{time.toFixed(3)}s</span>
                </div>
              )}

              {/* Compared Player Summary */}
              {compareSpeeds && compareTime && comparePlayerName && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 font-mono text-[10px] relative">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-neutral-300 font-bold">{comparePlayerName}:</span>
                  <span className="text-neutral-550">MAX:</span>
                  <span className="text-amber-400 font-black">{Math.max(...compareSpeeds).toFixed(1)} m/s</span>
                  <span className="text-neutral-550">AVG:</span>
                  <span className="text-indigo-400 font-black">{compareAvgSpeed} m/s</span>
                  <span className="text-neutral-550">DUR:</span>
                  <span className="text-emerald-400 font-black">{compareTime.toFixed(3)}s</span>
                  <button 
                    onClick={onClearCompare}
                    className="ml-1 text-[11px] text-neutral-400 hover:text-amber-400 cursor-pointer font-bold select-none p-0.5 line-none border-none outline-none"
                    title="Remove comparison overlay"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Default single summary if no comparison selected */}
              {!compareSpeeds && (
                <>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800/50 font-mono text-[10px]">
                    <span className="text-neutral-505">MAX SPEED:</span>
                    <span className="text-amber-400 font-black">{maxSpeed.toFixed(1)} m/s</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800/50 font-mono text-[10px]">
                    <span className="text-neutral-505">AVG SPEED:</span>
                    <span className="text-indigo-400 font-black">{avgSpeed} m/s</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-neutral-950 border border-neutral-800/50 font-mono text-[10px]">
                    <span className="text-neutral-505">DURATION:</span>
                    <span className="text-emerald-400 font-black">{time.toFixed(3)}s</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* SVG Interactive Canvas */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible cursor-crosshair"
          onMouseMove={(e) => {
            const svg = e.currentTarget;
            const rect = svg.getBoundingClientRect();
            const clientX = e.clientX - rect.left;
            
            // Map clientX back to the chart data coordinates
            const xPercent = (clientX - (paddingX / width) * rect.width) / ((chartWidth / width) * rect.width);
            const dataIdx = Math.round(xPercent * (totalPoints - 1));
            if (dataIdx >= 0 && dataIdx < totalPoints) {
              setHoveredIdx(dataIdx);
            }
          }}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            {/* Glowing stroke gradient */}
            <linearGradient id="speed-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#10b981" />
              <stop offset="50%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>

            {/* Glowing stroke gradient for compared run */}
            <linearGradient id="compare-gradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f59e0b" />
              <stop offset="50%" stopColor="#ec4899" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>

            {/* Glowing fill gradient */}
            <linearGradient id="speed-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.0" />
            </linearGradient>

            {/* Glowing fill gradient for compared run */}
            <linearGradient id="compare-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ec4899" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#ec4899" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {gridLines.map((line, i) => (
            <g key={i}>
              <line
                x1={paddingX}
                y1={line.y}
                x2={paddingX + chartWidth}
                y2={line.y}
                stroke="#1f2937"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
              <text
                x={paddingX - 8}
                y={line.y + 4}
                fill="#6b7280"
                fontSize="9"
                fontFamily="monospace"
                textAnchor="end"
              >
                {line.label}
              </text>
            </g>
          ))}

          {/* Fill under line */}
          <path d={fillPath} fill="url(#speed-fill)" />

          {/* Fill under compared line if active */}
          {comparePoints.length > 0 && (
            <path d={compareFillPath} fill="url(#compare-fill)" />
          )}

          {/* Speed line for compared run */}
          {comparePoints.length > 0 && (
            <path
              d={compareLinePath}
              fill="none"
              stroke="url(#compare-gradient)"
              strokeWidth="2.0"
              strokeDasharray="4 3"
              strokeLinecap="round"
              opacity="0.85"
            />
          )}

          {/* Speed line */}
          <path
            d={linePath}
            fill="none"
            stroke="url(#speed-gradient)"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Hover effects */}
          {activePoint && (
            <g>
              {/* Vertical guideline */}
              <line
                x1={activePoint.x}
                y1={paddingY}
                x2={activePoint.x}
                y2={paddingY + chartHeight}
                stroke="#4b5563"
                strokeWidth="1.5"
                strokeDasharray="2 2"
              />

              {/* Glowing outer circle */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="6.5"
                fill="#6366f1"
                fillOpacity="0.4"
              />

              {/* Solid inner circle */}
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="3.5"
                fill="#ffffff"
                stroke="#6366f1"
                strokeWidth="2"
              />

              {/* Glowing outer & solid inner circle - Compared */}
              {compareActivePoint && (
                <g>
                  <circle
                    cx={compareActivePoint.x}
                    cy={compareActivePoint.y}
                    r="6.0"
                    fill="#ec4899"
                    fillOpacity="0.4"
                  />
                  <circle
                    cx={compareActivePoint.x}
                    cy={compareActivePoint.y}
                    r="3.0"
                    fill="#ffffff"
                    stroke="#ec4899"
                    strokeWidth="2"
                  />
                </g>
              )}
            </g>
          )}

          {/* Bottom baseline */}
          <line
            x1={paddingX}
            y1={paddingY + chartHeight}
            x2={paddingX + chartWidth}
            y2={paddingY + chartHeight}
            stroke="#374151"
            strokeWidth="1.5"
          />

          {/* Baseline labels */}
          <text
            x={paddingX}
            y={paddingY + chartHeight + 14}
            fill="#6b7280"
            fontSize="9"
            fontFamily="monospace"
            textAnchor="middle"
          >
            0.0s
          </text>
          <text
            x={paddingX + chartWidth / 2}
            y={paddingY + chartHeight + 14}
            fill="#6b7280"
            fontSize="9"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {(time / 2).toFixed(1)}s
          </text>
          <text
            x={paddingX + chartWidth}
            y={paddingY + chartHeight + 14}
            fill="#6b7280"
            fontSize="9"
            fontFamily="monospace"
            textAnchor="middle"
          >
            {time.toFixed(1)}s
          </text>
        </svg>
      </div>
    </div>
  );
}
