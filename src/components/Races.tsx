import React, { useState, useEffect, useRef } from 'react';
import { Trophy, Timer, Bot, User, Users, Flame, History, Play, Sparkles } from 'lucide-react';
import { LevelConfig, UserAccount, RaceParticipant, RaceHistoryEntry } from '../types';
import { synths } from '../audio';
import { DEFAULT_LEVELS } from '../defaultLevels';
import { api } from '../api';

interface RacesProps {
  currentUser: UserAccount;
  onSelectLevel: (level: LevelConfig, raceMode: boolean, raceOpponents: RaceParticipant[]) => void;
}

// Fixed list of vibrant opponent colors
const OPPONENT_COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#10b981', // Green
  '#a855f7', // Purple
  '#f59e0b', // Yellow/Gold
  '#ec4899', // Pink
  '#f97316', // Orange
];

const BOT_NAMES = [
  'AeroRunner',
  'VelocityViper',
  'SprintSpecter',
  'LeapLizard',
  'GlidePhantom',
  'DashDemon',
  'GravityGhost',
  'ForceFighter',
  'KineticKangaroo',
  'MomentumMaster'
];

export default function Races({ currentUser, onSelectLevel }: RacesProps) {
  // Stats
  const [rating, setRating] = useState<number>(100);
  const [history, setHistory] = useState<RaceHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Fetch history and rating from server on every mount (i.e. every time user opens the Races tab)
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoadingHistory(true);
      try {
        const [raceHistory, ratingData] = await Promise.all([
          api.users.getRaceHistory(currentUser.username),
          api.users.getRating(currentUser.username),
        ]);
        if (!cancelled) {
          setHistory(raceHistory);
          setRating(ratingData.rating);
        }
      } catch (e) {
        console.error('Failed to load race data:', e);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [currentUser.username]);

  // Player selected color (randomized dynamically)
  const [playerColor, setPlayerColor] = useState<string>(() => {
    const randomColor = OPPONENT_COLORS[Math.floor(Math.random() * OPPONENT_COLORS.length)];
    localStorage.setItem(`racer_color_${currentUser.username}`, randomColor);
    return randomColor;
  });

  // Lobby/Matchmaking state
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [lobbyPlayers, setLobbyPlayers] = useState<RaceParticipant[]>([]);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const bcRef = useRef<BroadcastChannel | null>(null);

  // Statistics summaries
  const totalRaces = history.length;
  const firstPlaces = history.filter(h => h.place === 1).length;
  const podiums = history.filter(h => h.place <= 3).length;
  const winRatio = totalRaces > 0 ? Math.round((firstPlaces / totalRaces) * 100) : 0;

  // Initialize BroadcastChannel
  useEffect(() => {
    bcRef.current = new BroadcastChannel('momentum_races_channel');
    
    bcRef.current.onmessage = (event) => {
      const { type, data } = event.data;

      if (type === 'LOBBY_JOIN') {
        // Someone else is searching!
        if (isSearching) {
          setLobbyPlayers(prev => {
            // Avoid duplicates
            if (prev.some(p => p.username.toLowerCase().trim() === data.username.toLowerCase().trim())) {
              return prev;
            }
            synths.playTick();
            const newPlayers = [...prev, {
              username: data.username,
              color: data.color,
              avatar: data.avatar || '👤',
              isNpc: false,
              baseSpeed: 10 + Math.random() * 2,
              seed: Math.random()
            }];

            // Send handshake back so they know we are already here
            bcRef.current?.postMessage({
              type: 'LOBBY_HANDSHAKE',
              data: {
                username: currentUser.username,
                color: playerColor,
                avatar: currentUser.avatar,
                timeLeft: timeLeft // Sync remaining timer
              }
            });

            return newPlayers;
          });
        }
      } else if (type === 'LOBBY_HANDSHAKE') {
        if (isSearching) {
          setLobbyPlayers(prev => {
            if (prev.some(p => p.username.toLowerCase().trim() === data.username.toLowerCase().trim())) {
              return prev;
            }
            // Adopt smaller leftover timer to sync lobby starts
            if (data.timeLeft < timeLeft) {
              setTimeLeft(data.timeLeft);
            }
            return [...prev, {
              username: data.username,
              color: data.color,
              avatar: data.avatar || '👤',
              isNpc: false,
              baseSpeed: 10 + Math.random() * 2,
              seed: Math.random()
            }];
          });
        }
      } else if (type === 'LOBBY_START_GENERIC') {
        // Shared start trigger across tabs
        if (isSearching) {
          startRaceMatch(data.levelId, data.seed);
        }
      }
    };

    return () => {
      bcRef.current?.close();
    };
  }, [isSearching, timeLeft, playerColor, currentUser]);

  // Handle Matchmaking Search start
  const handleStartSearching = () => {
    synths.playTick();
    
    // Pick a new random color for this race
    const randomColor = OPPONENT_COLORS[Math.floor(Math.random() * OPPONENT_COLORS.length)];
    setPlayerColor(randomColor);
    localStorage.setItem(`racer_color_${currentUser.username}`, randomColor);

    setIsSearching(true);
    setTimeLeft(15);
    
    // Add ourselves as first participant
    const selfParticipant: RaceParticipant = {
      username: currentUser.username,
      color: randomColor,
      avatar: currentUser.avatar || '🏃',
      isNpc: false,
      baseSpeed: 11, // Standard default speed scalar
      seed: Math.random()
    };
    setLobbyPlayers([selfParticipant]);

    // Broadcast our search
    bcRef.current?.postMessage({
      type: 'LOBBY_JOIN',
      data: {
        username: currentUser.username,
        color: randomColor,
        avatar: currentUser.avatar
      }
    });
  };

  // Matchmaking Timer tick
  useEffect(() => {
    if (isSearching) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            return 0;
          }
          // Tick sound effect on timer decrement
          synths.playTick();
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isSearching]);

  // Conclude matchmaking when time runs out
  useEffect(() => {
    if (isSearching && timeLeft === 0) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      handleConcludeMatchmaking();
    }
  }, [timeLeft, isSearching]);

  const handleCancelSearching = () => {
    synths.playTick();
    setIsSearching(false);
    setLobbyPlayers([]);
  };

  // Force Start immediately
  const handleForceStart = () => {
    handleConcludeMatchmaking();
  };

  // Fill up with bots and choose a level to launch
  const handleConcludeMatchmaking = () => {
    if (!isSearching) return;
    
    // Pick any of the 6 default courses
    const randomLevel = DEFAULT_LEVELS[Math.floor(Math.random() * 6)];
    const sharedSeed = Math.random();

    // Broadcast trigger
    bcRef.current?.postMessage({
      type: 'LOBBY_START_GENERIC',
      data: {
        levelId: randomLevel.id,
        seed: sharedSeed
      }
    });

    startRaceMatch(randomLevel.id, sharedSeed);
  };

  const startRaceMatch = (levelId: string, seed: number) => {
    setIsSearching(false);
    synths.playFinish();

    const selectedLevel = DEFAULT_LEVELS.find(lvl => lvl.id === levelId) || DEFAULT_LEVELS[0];

    // Build unique opponent racers list up to 6 players from current lobby + NPCs
    const actualPlayersInLobby = [...lobbyPlayers];
    
    // Fill up remaining spots to reach 6 total racers
    let slotsRemaining = 6 - actualPlayersInLobby.length;
    let botIndex = 0;
    
    // Filter available colors (exclude colors already selected by human lobby players)
    const takenColors = actualPlayersInLobby.map(p => p.color.toLowerCase());
    let availableColors = OPPONENT_COLORS.filter(col => !takenColors.includes(col.toLowerCase()));
    if (availableColors.length === 0) availableColors = [...OPPONENT_COLORS];

    const npcs: RaceParticipant[] = [];
    while (slotsRemaining > 0 && botIndex < BOT_NAMES.length) {
      const botName = BOT_NAMES[Math.floor(newSeedRandom(seed + botIndex) * BOT_NAMES.length)];
      // Avoid duplicate names in this specific race
      if (!actualPlayersInLobby.some(p => p.username === botName) && !npcs.some(p => p.username === botName)) {
        const botColor = availableColors[npcs.length % availableColors.length];
        
        // Define tiered speeds to spread final times significantly within player speed limits (4.0 to 12.0 m/s)
        const speedRoll = newSeedRandom(seed + botIndex * 43);
        let botSpeed = 10.0;
        if (speedRoll < 0.15) {
          // Elite Speedrunner bot (15% chance): 11.4 to 12.0 m/s
          botSpeed = 11.4 + newSeedRandom(seed + botIndex * 15) * 0.6;
        } else if (speedRoll < 0.40) {
          // Expert bot (25% chance): 10.0 to 11.3 m/s
          botSpeed = 10.0 + newSeedRandom(seed + botIndex * 15) * 1.3;
        } else if (speedRoll < 0.70) {
          // Challenger/Regular bot (30% chance): 8.0 to 9.8 m/s
          botSpeed = 8.0 + newSeedRandom(seed + botIndex * 15) * 1.8;
        } else if (speedRoll < 0.90) {
          // Casual bot (20% chance): 5.5 to 7.8 m/s
          botSpeed = 5.5 + newSeedRandom(seed + botIndex * 15) * 2.3;
        } else {
          // Slow / Snail bot (10% chance): 3.8 to 5.2 m/s
          botSpeed = 3.8 + newSeedRandom(seed + botIndex * 15) * 1.4;
        }

        npcs.push({
          username: botName,
          color: botColor,
          avatar: '🤖',
          isNpc: true,
          baseSpeed: botSpeed,
          seed: newSeedRandom(seed + botIndex)
        });
        slotsRemaining--;
      }
      botIndex++;
    }

    const finalOpponents = [...actualPlayersInLobby.filter(p => p.username !== currentUser.username), ...npcs];
    
    // Start game canvas!
    onSelectLevel(selectedLevel, true, finalOpponents);
  };

  // Pseudo-random helper
  function newSeedRandom(val: number) {
    const x = Math.sin(val) * 10000;
    return x - Math.floor(x);
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-neutral-950 text-neutral-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Block with Stats Grid */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 border-b border-neutral-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 rounded text-[10px] font-bold font-mono tracking-wider uppercase border border-amber-500/20">
                Speed Racing League
              </span>
            </div>
            <h1 className="text-3xl font-black text-neutral-50 tracking-tight mt-1">Multiplayer Races</h1>
            <p className="text-sm text-neutral-400 mt-1">
              Race in real-time against other players across browser sessions, or challenge seasoned SpeedBots.
            </p>
          </div>

          {/* Profile rating board */}
          <div className="flex items-center gap-4 bg-neutral-900 border border-neutral-800 p-4 rounded-2xl shadow-xl">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl flex items-center justify-center text-2xl">
              🏆
            </div>
            <div>
              <div className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest font-bold">Racer Elo Rating</div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black font-mono text-amber-500 tracking-tight">{rating}</span>
                <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  Elite League
                </span>
              </div>
            </div>
          </div>
        </div>

        {!isSearching ? (
          <button
            onClick={handleStartSearching}
            className="w-full py-5 px-8 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black text-sm tracking-tight shadow-lg shadow-indigo-500/25 active:scale-98 transition duration-200 flex items-center justify-center gap-3 cursor-pointer group hover:border border-white/10"
          >
            <Trophy className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
            <span>Start Matching Queue</span>
          </button>
        ) : (
          <div className="w-full">
            {/* Matchmaking Lobby Block */}
            <div className="w-full space-y-6">
              <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 p-8 rounded-3xl relative overflow-hidden shadow-2xl flex flex-col justify-between min-h-[380px]">
                {/* SEARCHING/MATCHING QUEUE STATE */}
                <div className="space-y-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center bg-neutral-950/50 p-3 rounded-2xl border border-neutral-800/80 mb-6">
                      <div className="flex items-center gap-2">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-red-400">
                          Search Active
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 text-[11px] font-mono bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-xl">
                        <Timer className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Closing in:</span>
                        <span className="text-indigo-400 font-bold">{timeLeft}s</span>
                      </div>
                    </div>

                    <h3 className="text-lg font-bold tracking-tight flex items-center gap-1.5">
                      Matchmaking Room ({lobbyPlayers.length}/6 racers found)
                    </h3>
                  </div>

                  {/* Matchmaking status bars */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 my-4">
                    {Array.from({ length: 6 }).map((_, index) => {
                      const player = lobbyPlayers[index];
                      return (
                        <div
                          key={index}
                          className={`p-3 rounded-2xl border flex items-center gap-3 transition duration-200 ${
                            player 
                              ? 'bg-neutral-900 border-neutral-800' 
                              : 'bg-neutral-950/20 border-dashed border-neutral-800/60 opacity-60'
                          }`}
                        >
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shadow-sm shrink-0 border`}
                            style={{
                              backgroundColor: player ? player.color : '#262626',
                              borderColor: player ? 'rgba(255,255,255,0.15)' : 'transparent'
                            }}
                          >
                            {player ? player.avatar : '?'}
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-bold truncate">
                              {player ? player.username : 'Searching...'}
                            </div>
                            <div className="text-[8px] font-mono text-neutral-500">
                              {player ? (
                                player.isNpc ? 'SpeedBot' : 
                                player.username.toLowerCase().trim() === currentUser.username.toLowerCase().trim() ? 'You' : 'Opponent'
                              ) : 'Waiting'}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions during matchmaking state */}
                  <div className="flex gap-3 border-t border-neutral-800/80 pt-6">
                    <button
                      onClick={handleCancelSearching}
                      className="py-3 px-5 border border-neutral-800 hover:bg-neutral-900 text-neutral-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                    >
                      Leave Lobby
                    </button>
                    <button
                      onClick={handleForceStart}
                      className="flex-1 py-3 px-6 bg-neutral-100 hover:bg-neutral-200 text-neutral-950 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Bot className="w-4 h-4 text-neutral-900" />
                      <span>Start with NPCs / Bots</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Triple Bento Stats Block */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-neutral-900/60 border border-neutral-800/80 p-5 rounded-2xl flex flex-col justify-between">
            <div className="text-neutral-500 font-mono text-[9px] uppercase tracking-wider font-bold">Total Matches</div>
            <div className="text-3xl font-black font-mono text-neutral-50 mt-2">{totalRaces}</div>
          </div>
          <div className="bg-neutral-900/60 border border-neutral-800/80 p-5 rounded-2xl flex flex-col justify-between">
            <div className="text-neutral-500 font-mono text-[9px] uppercase tracking-wider font-bold">Champion Runs (1st)</div>
            <div className="text-3xl font-black font-mono text-emerald-400 mt-2">{firstPlaces}</div>
          </div>
          <div className="bg-neutral-900/60 border border-neutral-800/80 p-5 rounded-2xl flex flex-col justify-between">
            <div className="text-neutral-500 font-mono text-[9px] uppercase tracking-wider font-bold">Podium Finishes (Top 3)</div>
            <div className="text-3xl font-black font-mono text-amber-500 mt-2">{podiums}</div>
          </div>
          <div className="bg-neutral-900/60 border border-neutral-800/80 p-5 rounded-2xl flex flex-col justify-between">
            <div className="text-neutral-500 font-mono text-[9px] uppercase tracking-wider font-bold">Win Percentage</div>
            <div className="text-3xl font-black font-mono text-indigo-400 mt-2">{winRatio}%</div>
          </div>
        </div>

        {/* Races Log and History */}
        <div className="space-y-4">
          <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-400" />
            League Race History Log
          </h2>
          
          {loadingHistory ? (
            <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-8 text-center text-xs text-neutral-400">
              Loading race history...
            </div>
          ) : history.length === 0 ? (
            <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-2xl p-8 text-center text-xs text-neutral-400">
              No league records registered yet. Complete matchmaking races to pop up records.
            </div>
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden divide-y divide-neutral-800">
              {history.map((entry) => (
                <div key={entry.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono">
                  
                  {/* Place and Level */}
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black border ${
                        entry.place === 1 
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' 
                          : entry.place === 2 
                          ? 'bg-neutral-200/10 text-neutral-300 border-neutral-300/20' 
                          : entry.place === 3 
                          ? 'bg-amber-700/10 text-amber-700 border-amber-700/20'
                          : 'bg-neutral-950 text-neutral-500 border-neutral-800'
                      }`}
                    >
                      {entry.place === 1 ? '🥇' : entry.place === 2 ? '🥈' : entry.place === 3 ? '🥉' : `${entry.place}th`}
                    </div>
                    
                    <div>
                      <div className="font-bold text-neutral-100 font-sans text-sm">{entry.levelName}</div>
                      <div className="text-[10px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                        <span>Elapsed: {entry.time.toFixed(3)}s</span>
                        <span>•</span>
                        <span>{new Date(entry.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Opponent list summary capsules */}
                  <div className="flex items-center gap-1.5 max-w-xs overflow-x-auto py-1">
                    {entry.opponents.map((opp, idx) => (
                      <div
                        key={idx}
                        className="px-2 py-0.5 rounded bg-neutral-950 text-[9px] border text-neutral-400 flex items-center gap-1 shrink-0"
                        style={{ borderColor: opp.color + '30' }}
                        title={`${opp.username} (${opp.finished && opp.time ? opp.time.toFixed(3) + 's' : 'DNF'})`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: opp.color }} />
                        <span className="truncate max-w-[50px]">{opp.username}</span>
                      </div>
                    ))}
                  </div>

                  {/* Rating Points Change bubble */}
                  <div className="flex items-center gap-3 sm:text-right">
                    <div className="flex flex-col sm:items-end">
                      <span className={`font-bold text-xs ${entry.ratingChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {entry.ratingChange >= 0 ? `+${entry.ratingChange}` : entry.ratingChange} Rating
                      </span>
                      <span className="text-[10px] text-neutral-500 mt-0.5">Rating: {entry.newRating}</span>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
