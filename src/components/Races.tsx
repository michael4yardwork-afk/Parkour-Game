import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Timer, Bot, User, Users, Flame, History, Play, Sparkles, Crown, Globe, X } from 'lucide-react';
import PlatinumGate from './PlatinumGate';
import { LevelConfig, UserAccount, RaceParticipant, RaceHistoryEntry } from '../types';
import { synths } from '../audio';
import { DEFAULT_LEVELS } from '../defaultLevels';
import { api } from '../api';
import { isChampionRace } from '../utils/raceStats';

interface RacesProps {
  currentUser: UserAccount;
  onSelectLevel: (
    level: LevelConfig,
    raceMode: boolean,
    raceOpponents: RaceParticipant[],
    ws?: WebSocket | null,
    roomId?: string | null,
    raceStartTime?: number | null
  ) => void;
  /** Bumped by the parent whenever a race result finishes saving, so stats refresh immediately. */
  refreshKey?: number;
  isPlatinum?: boolean;
  onUpgrade?: () => void;
  onViewProfile?: (username: string) => void;
}

interface EloLeaderboardEntry {
  username: string;
  rating: number;
  avatar: string;
  avatarBg: string;
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

interface League {
  name: string;
  color: string;   // Tailwind text colour
  bg: string;      // Tailwind bg colour
  icon: string;
}

function getLeague(rating: number): League {
  if (rating <= 250)  return { name: 'Amateur',     color: 'text-neutral-400',  bg: 'bg-neutral-500/10',  icon: '🎮' };
  if (rating <= 500)  return { name: 'Rookie',       color: 'text-sky-400',      bg: 'bg-sky-500/10',      icon: '🌀' };
  if (rating <= 1000) return { name: 'Racer',        color: 'text-teal-400',     bg: 'bg-teal-500/10',     icon: '🏃' };
  if (rating <= 2500) return { name: 'Expert',       color: 'text-emerald-400',  bg: 'bg-emerald-500/10',  icon: '⚡' };
  if (rating <= 5000) return { name: 'Elite',        color: 'text-amber-400',    bg: 'bg-amber-500/10',    icon: '🔥' };
  if (rating <= 10000) return { name: 'Pro',         color: 'text-orange-400',   bg: 'bg-orange-500/10',   icon: '🎯' };
  if (rating <= 25000) return { name: 'Master',      color: 'text-violet-400',   bg: 'bg-violet-500/10',   icon: '👑' };
  if (rating <= 50000) return { name: 'Champion',    color: 'text-rose-400',     bg: 'bg-rose-500/10',     icon: '🏆' };
  return                      { name: 'Delta',       color: 'text-red-400',      bg: 'bg-red-500/15',      icon: '⚡🔺' };
}

export default function Races({ currentUser, onSelectLevel, refreshKey, isPlatinum, onUpgrade, onViewProfile }: RacesProps) {
  const [gate, setGate] = useState<{ feature: string; description?: string } | null>(null);
  // Stats
  const [rating, setRating] = useState<number>(100);
  const [worldRank, setWorldRank] = useState<number | null>(null);
  const [history, setHistory] = useState<RaceHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  // ELO leaderboard modal
  const [showEloLeaderboard, setShowEloLeaderboard] = useState(false);
  const [eloLeaderboard, setEloLeaderboard] = useState<EloLeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Fetch history and rating from server on mount, whenever the user changes, and whenever
  // the parent bumps refreshKey (e.g. right after a race result finishes saving) so stats
  // stay current even if this tab never unmounted.
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
          setWorldRank(ratingData.rank ?? null);
        }
      } catch (e) {
        console.error('Failed to load race data:', e);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [currentUser.username, refreshKey]);

  // Player selected color (randomized dynamically)
  const [playerColor, setPlayerColor] = useState<string>(() => {
    const randomColor = OPPONENT_COLORS[Math.floor(Math.random() * OPPONENT_COLORS.length)];
    localStorage.setItem(`racer_color_${currentUser.username}`, randomColor);
    return randomColor;
  });

  // Lobby/Matchmaking state
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(10);
  const [timerActive, setTimerActive] = useState<boolean>(false);
  const [lobbyPlayers, setLobbyPlayers] = useState<RaceParticipant[]>([]);

  // WebSocket ref — lives for the duration of one matchmaking session
  const wsRef = useRef<WebSocket | null>(null);
  // Set to true right before handing off to the race canvas so the unmount
  // cleanup does NOT kill the socket that GameCanvas needs for in-race sync.
  const raceActiveRef = useRef<boolean>(false);

  // Statistics summaries
  const totalRaces = history.length;
  const firstPlaces = history.filter(isChampionRace).length;
  const podiums = history.filter(h => h.place <= 3).length;
  const winRatio = totalRaces > 0 ? Math.round((firstPlaces / totalRaces) * 100) : 0;

  // ── WebSocket helpers ──────────────────────────────────────────────────────

  const connectAndJoin = (color: string) => {
    // Close any stale connection first
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'QUEUE_JOIN',
        username: currentUser.username,
        color,
        avatar: currentUser.avatar || '🏃',
        avatarBg: currentUser.avatarBg || '',
      }));
    };

    ws.onmessage = (event) => {
      let msg: any;
      try { msg = JSON.parse(event.data); } catch { return; }

      if (msg.type === 'QUEUE_UPDATE') {
        setTimeLeft(msg.timeLeft);
        setTimerActive(msg.timerActive);
        // Play tick sound whenever countdown advances
        if (msg.timerActive) synths.playTick();
        setLobbyPlayers(
          (msg.players as { username: string; color: string; avatar: string; avatarBg?: string; rating?: number }[]).map(p => ({
            username: p.username,
            color: p.color,
            avatar: p.avatar || '🏃',
            avatarBg: p.avatarBg || '',
            isNpc: false,
            baseSpeed: 10 + Math.random() * 2,
            seed: Math.random(),
            rating: p.rating,
          }))
        );
      } else if (msg.type === 'RACE_START') {
        // msg.players contains only the real human players from the server
        startRaceMatch(msg.roomId, msg.levelId, msg.seed, msg.players as { username: string; color: string; avatar: string; avatarBg?: string; isNpc: boolean }[], msg.startTime as number | undefined);
      }
    };

    ws.onerror = () => {
      console.warn('[Races] WebSocket error — falling back to NPC-only match');
    };

    ws.onclose = () => {
      // If closed while still searching, treat as no-opponent scenario (lobby stays open)
    };
  };

  // ── Handle Matchmaking Search start ──────────────────────────────────────

  const handleStartSearching = () => {
    synths.playTick();

    // Pick a new random color for this race
    const randomColor = OPPONENT_COLORS[Math.floor(Math.random() * OPPONENT_COLORS.length)];
    setPlayerColor(randomColor);
    localStorage.setItem(`racer_color_${currentUser.username}`, randomColor);

    setIsSearching(true);
    setTimeLeft(10);
    setTimerActive(false);

    // Optimistically show ourselves immediately
    setLobbyPlayers([{
      username: currentUser.username,
      color: randomColor,
      avatar: currentUser.avatar || '🏃',
      avatarBg: currentUser.avatarBg || '',
      isNpc: false,
      baseSpeed: 11,
      seed: Math.random(),
    }]);

    connectAndJoin(randomColor);
  };

  const handleCancelSearching = () => {
    synths.playTick();
    // Tell server we're leaving
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'QUEUE_LEAVE' }));
    }
    wsRef.current?.close();
    wsRef.current = null;
    setIsSearching(false);
    setLobbyPlayers([]);
    setTimerActive(false);
  };

  // Force Start immediately (fills remaining spots with NPCs on client)
  const handleForceStart = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'FORCE_START' }));
    } else {
      // WebSocket not available — start locally with only NPCs
      const randomLevel = DEFAULT_LEVELS[Math.floor(Math.random() * 6)];
      startRaceMatch(null, randomLevel.id, Math.random(), []);
    }
  };

  // Cleanup on unmount — skip if a race just launched (GameCanvas owns the WS now)
  useEffect(() => {
    return () => {
      if (raceActiveRef.current) return; // handed off to GameCanvas
      if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
        wsRef.current.send(JSON.stringify({ type: 'QUEUE_LEAVE' }));
        wsRef.current.close();
      }
    };
  }, []);

  const startRaceMatch = (
    roomId: string | null,
    levelId: string,
    seed: number,
    serverPlayers: { username: string; color: string; avatar: string; avatarBg?: string; isNpc: boolean }[],
    raceStartTime?: number
  ) => {
    setIsSearching(false);
    synths.playFinish();

    const selectedLevel = DEFAULT_LEVELS.find(lvl => lvl.id === levelId) || DEFAULT_LEVELS[0];

    // Build participant list: server-provided real players (excluding self) + NPC fill
    const humanOpponents: RaceParticipant[] = serverPlayers
      .filter(p => p.username.toLowerCase().trim() !== currentUser.username.toLowerCase().trim())
      .slice(0, 5)
      .map(p => ({
        username: p.username,
        color: p.color,
        avatar: p.avatar || '👤',
        avatarBg: p.avatarBg || '',
        isNpc: false,
        baseSpeed: 10 + Math.random() * 2,
        seed: Math.random(),
      }));

    // Fill remaining slots up to 6 total (self + humanOpponents + npcs)
    const totalHumans = humanOpponents.length + 1; // +1 for self
    const slotsRemaining = Math.max(0, 6 - totalHumans);

    const takenColors = [playerColor, ...humanOpponents.map(p => p.color)].map(c => c.toLowerCase());
    let availableColors = OPPONENT_COLORS.filter(col => !takenColors.includes(col.toLowerCase()));
    if (availableColors.length === 0) availableColors = [...OPPONENT_COLORS];

    const humanNames = new Set(humanOpponents.map(p => p.username.toLowerCase().trim()));
    const candidateBotNames = BOT_NAMES
      .filter(name => !humanNames.has(name.toLowerCase()) && name.toLowerCase() !== currentUser.username.toLowerCase().trim())
      // Sort once into a deterministic, seed-based order. Unlike repeatedly
      // sampling random names, this cannot waste attempts on duplicates.
      .sort((a, b) => newSeedRandom(seed + BOT_NAMES.indexOf(a) * 7919) - newSeedRandom(seed + BOT_NAMES.indexOf(b) * 7919));

    const npcs: RaceParticipant[] = candidateBotNames
      .slice(0, slotsRemaining)
      .map((botName, botIndex) => {
        const botColor = availableColors[botIndex % availableColors.length];
        const speedRoll = newSeedRandom(seed + botIndex * 43);
        let botSpeed = 10.0;
        if (speedRoll < 0.15) {
          botSpeed = 11.4 + newSeedRandom(seed + botIndex * 15) * 0.6;
        } else if (speedRoll < 0.40) {
          botSpeed = 10.0 + newSeedRandom(seed + botIndex * 15) * 1.3;
        } else if (speedRoll < 0.70) {
          botSpeed = 8.0 + newSeedRandom(seed + botIndex * 15) * 1.8;
        } else if (speedRoll < 0.90) {
          botSpeed = 5.5 + newSeedRandom(seed + botIndex * 15) * 2.3;
        } else {
          botSpeed = 3.8 + newSeedRandom(seed + botIndex * 15) * 1.4;
        }

        return {
          username: botName,
          color: botColor,
          avatar: '🤖',
          isNpc: true,
          baseSpeed: botSpeed,
          seed: newSeedRandom(seed + botIndex),
        };
      });

    const finalOpponents = [...humanOpponents, ...npcs];

    // Signal unmount cleanup to leave the socket open — GameCanvas owns it now
    raceActiveRef.current = true;
    // Hand off the WebSocket and roomId to GameCanvas via App so it can sync positions
    onSelectLevel(selectedLevel, true, finalOpponents, wsRef.current, roomId, raceStartTime ?? null);
  };

  // Fetch ELO leaderboard when modal opens
  useEffect(() => {
    if (!showEloLeaderboard) return;
    let cancelled = false;
    setLoadingLeaderboard(true);
    api.users.getEloLeaderboard().then(data => {
      if (!cancelled) { setEloLeaderboard(data); setLoadingLeaderboard(false); }
    }).catch(() => { if (!cancelled) setLoadingLeaderboard(false); });
    return () => { cancelled = true; };
  }, [showEloLeaderboard]);

  // Pseudo-random helper
  function newSeedRandom(val: number) {
    const x = Math.sin(val) * 10000;
    return x - Math.floor(x);
  }

  const league = getLeague(rating);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-neutral-950 text-neutral-100 font-sans">
      {/* Speed-line grid overlay on the whole screen */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.018] z-0"
        style={{
          backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,1) 0px, rgba(255,255,255,1) 1px, transparent 1px, transparent 100px), repeating-linear-gradient(0deg, rgba(255,255,255,1) 0px, rgba(255,255,255,1) 1px, transparent 1px, transparent 100px)',
        }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8 space-y-6">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 text-amber-400 rounded-lg text-[9px] font-black font-mono tracking-widest uppercase"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                ⚡ Speed Racing League
              </span>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter leading-none">Multiplayer Races</h1>
            <p className="text-sm text-neutral-500 mt-1.5 leading-snug max-w-md">
              Race real-time against players across browser sessions, or challenge seasoned SpeedBots.
            </p>
          </div>

          {/* Rating card + World Rankings */}
          <div className="flex flex-col gap-2 items-stretch md:items-end shrink-0">
            <div className="flex items-center gap-4 rounded-2xl px-5 py-4"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.08), rgba(15,15,25,0.9))',
                border: '1px solid rgba(245,158,11,0.2)',
                boxShadow: '0 0 30px rgba(245,158,11,0.06)',
              }}
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0"
                style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                {league.icon}
              </div>
              <div>
                <div className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest font-bold">Racer ELO Rating</div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-black font-mono text-amber-400 tracking-tight">{rating}</span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${league.color} ${league.bg}`}>
                    {league.name}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (!isPlatinum) {
                  setGate({ feature: 'World ELO Leaderboard', description: 'See how top players rank worldwide and compare with your own ELO rating.' });
                  return;
                }
                setShowEloLeaderboard(true);
              }}
              className="flex items-center justify-center gap-2 text-[11px] font-semibold text-neutral-500 hover:text-amber-400 rounded-xl px-4 py-2 transition duration-200 cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <Globe className="w-3.5 h-3.5" />
              View World ELO Rankings
            </button>
          </div>
        </div>

        {/* ── Start Race / Lobby ───────────────────────────────────────────── */}
        {!isSearching ? (
          <button
            onClick={handleStartSearching}
            className="relative w-full overflow-hidden rounded-2xl cursor-pointer group transition duration-300 hover:scale-[1.005] active:scale-[0.998]"
            style={{
              background: 'linear-gradient(135deg, #312e81 0%, #4f46e5 50%, #7c3aed 100%)',
              boxShadow: '0 8px 40px rgba(99,102,241,0.35), 0 0 0 1px rgba(255,255,255,0.08) inset',
              padding: '1.5rem 2rem',
            }}
          >
            {/* Shine sweep */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition duration-500 pointer-events-none"
              style={{ background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.08) 50%, transparent 60%)' }} />
            {/* Speed lines */}
            <div className="absolute inset-0 pointer-events-none opacity-10"
              style={{ backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 60px)' }} />
            <div className="relative z-10 flex items-center justify-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/15">
                <Trophy className="w-5 h-5 text-white group-hover:rotate-12 transition-transform duration-300" />
              </div>
              <div className="text-left">
                <div className="text-base font-black text-white tracking-tight leading-none">Start Matching Queue</div>
                <div className="text-xs text-indigo-200/70 mt-0.5 font-mono">Join the global race lobby</div>
              </div>
              <div className="ml-auto text-white/40 group-hover:text-white/70 transition">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </div>
          </button>
        ) : (
          /* ── Matchmaking lobby ── */
          <div className="rounded-3xl overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, rgba(15,15,30,0.95), rgba(10,10,20,0.98))',
              border: '1px solid rgba(99,102,241,0.25)',
              boxShadow: '0 0 50px rgba(99,102,241,0.08)',
            }}
          >
            {/* Lobby header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                </span>
                <span className="text-[10px] font-mono tracking-widest uppercase font-bold text-red-400">Live — Search Active</span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] font-mono px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                <Timer className="w-3.5 h-3.5 text-indigo-400" />
                {timerActive ? (
                  <>
                    <span className="text-neutral-400">Closing in</span>
                    <span className="text-indigo-400 font-black">{timeLeft}s</span>
                  </>
                ) : (
                  <span className="text-neutral-500">Waiting for opponent…</span>
                )}
              </div>
            </div>

            <div className="p-6 space-y-5">
              <div className="flex items-baseline gap-2">
                <h3 className="text-base font-black text-white tracking-tight">Race Grid</h3>
                <span className="text-xs font-mono text-neutral-500">({lobbyPlayers.length}/6 racers)</span>
              </div>

              {/* Racer slots — race-grid style */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, index) => {
                  const player = lobbyPlayers[index];
                  const isSelf = player?.username.toLowerCase() === currentUser.username.toLowerCase();
                  return (
                    <div
                      key={index}
                      className="relative rounded-xl overflow-hidden flex items-center gap-3 p-3 transition duration-300"
                      style={player ? {
                        background: isSelf
                          ? 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(99,102,241,0.04))'
                          : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isSelf ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      } : {
                        background: 'rgba(255,255,255,0.01)',
                        border: '1px dashed rgba(255,255,255,0.06)',
                      }}
                    >
                      {/* Starting position number */}
                      <span className="absolute top-1.5 right-2 text-[9px] font-black font-mono text-neutral-700">#{index + 1}</span>

                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0 border ${player ? (isSelf ? (currentUser.avatarBg || 'bg-indigo-600') : (player.avatarBg || 'bg-neutral-700')) : 'bg-neutral-900'}`}
                        style={{ borderColor: player ? (player.color + '40') : 'rgba(255,255,255,0.06)' }}
                      >
                        {player ? player.avatar : <span className="text-neutral-700 text-xs">?</span>}
                      </div>

                      <div className="truncate min-w-0">
                        <div className="text-xs font-bold text-white truncate leading-tight">
                          {player ? player.username : <span className="text-neutral-700 italic font-normal text-[11px]">Searching…</span>}
                        </div>
                        <div className="text-[9px] font-mono mt-0.5" style={{ color: player ? (player.color || '#666') : '#333' }}>
                          {player ? (
                            player.isNpc ? '🤖 SpeedBot' :
                            isSelf ? '● You' : '◆ Opponent'
                          ) : '—'}
                        </div>
                        {player && !player.isNpc && player.rating != null && (
                          <div className="text-[9px] font-mono text-amber-400 font-bold">{player.rating} ELO</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lobby actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancelSearching}
                  className="py-2.5 px-5 text-neutral-400 hover:text-neutral-200 text-xs font-semibold rounded-xl transition duration-200 cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  Leave Lobby
                </button>
                {lobbyPlayers.length >= 2 ? (
                  <div className="flex-1 py-2.5 px-5 text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', color: '#666' }}>
                    <Bot className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                    <span className="text-neutral-500">Filling remaining slots with CPUs in</span>
                    <span className="text-indigo-400 font-black tabular-nums">{timeLeft}s</span>
                  </div>
                ) : (
                  <button
                    onClick={handleForceStart}
                    className="flex-1 py-2.5 px-6 text-neutral-900 text-xs font-bold rounded-xl transition duration-200 flex items-center justify-center gap-2 cursor-pointer"
                    style={{ background: 'linear-gradient(135deg, #e5e7eb, #d1d5db)' }}
                  >
                    <Bot className="w-4 h-4" />
                    Start with NPCs
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Stats bento ─────────────────────────────────────────────────── */}
        {isPlatinum ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {[
              { label: 'Total Matches', value: totalRaces.toString(), color: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.08)', text: '#e5e7eb' },
              { label: 'Champion Runs', value: firstPlaces.toString(), color: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', text: '#34d399' },
              { label: 'Podium Finishes', value: podiums.toString(), color: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
              { label: 'Win Percentage', value: `${winRatio}%`, color: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)', text: '#818cf8' },
              { label: 'World ELO Rank', value: worldRank ? `#${worldRank.toLocaleString()}` : '—', color: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
            ].map(stat => (
              <div key={stat.label}
                className="rounded-2xl p-5 flex flex-col justify-between transition duration-200 hover:scale-[1.02]"
                style={{ background: `linear-gradient(135deg, ${stat.color}, rgba(10,10,20,0.8))`, border: `1px solid ${stat.border}` }}>
                <div className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-widest">{stat.label}</div>
                <div className="text-3xl font-black font-mono mt-3 leading-none" style={{ color: stat.text }}>{stat.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setGate({ feature: 'Race Statistics', description: 'Track your wins, podiums, and performance across all your multiplayer races.' })}
            className="w-full rounded-2xl p-8 text-center cursor-pointer transition duration-200 hover:scale-[1.005]"
            style={{ background: 'rgba(245,158,11,0.04)', border: '1.5px dashed rgba(245,158,11,0.2)' }}
          >
            <Crown className="w-7 h-7 text-amber-400/50 mx-auto mb-3" />
            <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-amber-500/60 mb-1">Platinum Feature</p>
            <p className="text-sm font-bold text-neutral-400">Race Statistics</p>
            <p className="text-xs text-neutral-600 mt-1">Upgrade to Platinum to unlock your race stats</p>
          </button>
        )}

        {/* ── Race history log ─────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-black text-white tracking-tight">League Race History</h2>
          </div>

          {loadingHistory ? (
            <div className="rounded-2xl p-8 text-center text-xs text-neutral-600 font-mono"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
              Loading race history…
            </div>
          ) : history.length === 0 ? (
            <div className="rounded-2xl p-10 text-center"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}>
              <Trophy className="w-8 h-8 text-neutral-700 mx-auto mb-3" />
              <p className="text-xs text-neutral-600 font-mono">No league records yet. Complete matchmaking races to build your history.</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: 'rgba(10,10,20,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {history.map((entry, i) => {
                const isFirst = entry.place === 1;
                const isSecond = entry.place === 2;
                const isThird = entry.place === 3;
                const isDNF = entry.place === 99;
                const placeEmoji = isFirst ? '🥇' : isSecond ? '🥈' : isThird ? '🥉' : isDNF ? 'DNF' : `${entry.place}`;
                const ratingPositive = entry.ratingChange >= 0;

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 transition duration-150 hover:bg-white/[0.025]"
                    style={i < history.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.05)' } : {}}
                  >
                    <div className="flex items-center gap-3.5">
                      {/* Place badge */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${
                        isFirst ? 'bg-amber-500/10 border border-amber-500/25' :
                        isSecond ? 'bg-neutral-200/5 border border-neutral-300/15' :
                        isThird ? 'bg-amber-700/10 border border-amber-700/20' :
                        'bg-neutral-950 border border-neutral-800/60'
                      }`}>
                        {placeEmoji}
                      </div>

                      <div>
                        <div className="text-sm font-bold text-white leading-tight">{entry.levelName}</div>
                        <div className="text-[10px] text-neutral-600 font-mono flex items-center gap-1.5 mt-0.5">
                          {!isDNF && <><span>{entry.time.toFixed(3)}s</span><span>·</span></>}
                          <span>{new Date(entry.date).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:text-right shrink-0">
                      <div className={`text-xs font-black font-mono px-2.5 py-1 rounded-lg ${ratingPositive ? 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' : 'text-red-400 bg-red-500/10 border border-red-500/20'}`}>
                        {ratingPositive ? `+${entry.ratingChange}` : entry.ratingChange}
                      </div>
                      <div className="text-[10px] font-mono text-neutral-500">{entry.newRating} ELO</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {gate && (
        <PlatinumGate
          isVisible
          feature={gate.feature}
          description={gate.description}
          onClose={() => setGate(null)}
          onUpgrade={onUpgrade ?? (() => {})}
        />
      )}

      {/* ── World ELO Leaderboard Modal ──────────────────────────────────── */}
      <AnimatePresence>
        {showEloLeaderboard && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-neutral-950/85 backdrop-blur-sm"
              onClick={() => setShowEloLeaderboard(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ type: 'spring', damping: 24, stiffness: 300 }}
              className="relative z-10 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[80vh]"
              style={{
                background: '#09090f',
                border: '1px solid rgba(245,158,11,0.2)',
                boxShadow: '0 0 60px rgba(245,158,11,0.08)',
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <Globe className="w-4 h-4 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white tracking-tight">World ELO Rankings</h3>
                    <p className="text-[10px] font-mono text-neutral-600">Top 100 racers by rating</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEloLeaderboard(false)}
                  className="p-1.5 text-neutral-600 hover:text-neutral-300 rounded-lg transition cursor-pointer hover:bg-white/5"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* List */}
              <div className="overflow-y-auto flex-1">
                {loadingLeaderboard ? (
                  <div className="p-8 text-center text-xs text-neutral-600 font-mono">Loading rankings…</div>
                ) : eloLeaderboard.length === 0 ? (
                  <div className="p-8 text-center text-xs text-neutral-600 font-mono">No ratings recorded yet.</div>
                ) : (
                  <div>
                    {eloLeaderboard.map((entry, idx) => {
                      const entryLeague = getLeague(entry.rating);
                      const isSelf = entry.username.toLowerCase() === currentUser.username.toLowerCase();
                      return (
                        <div
                          key={entry.username}
                          className="flex items-center gap-3 px-5 py-3 transition duration-150"
                          style={{
                            background: isSelf ? 'rgba(99,102,241,0.06)' : 'transparent',
                            borderLeft: isSelf ? '2px solid rgba(99,102,241,0.5)' : '2px solid transparent',
                            borderBottom: idx < eloLeaderboard.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                          }}
                        >
                          <span className={`text-[11px] font-black font-mono w-7 shrink-0 ${
                            idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-neutral-300' : idx === 2 ? 'text-amber-700' : 'text-neutral-700'
                          }`}>
                            #{idx + 1}
                          </span>

                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0 ${entry.avatarBg || 'bg-neutral-800'}`}>
                            {entry.avatar}
                          </div>

                          <button
                            onClick={() => { onViewProfile?.(entry.username); setShowEloLeaderboard(false); }}
                            className="text-xs font-bold text-neutral-300 hover:text-indigo-400 transition truncate flex-1 text-left cursor-pointer"
                          >
                            {entry.username}
                            {isSelf && <span className="ml-1.5 text-[9px] font-mono text-indigo-500 font-normal">(you)</span>}
                          </button>

                          <span className={`hidden sm:inline text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${entryLeague.color} ${entryLeague.bg}`}>
                            {entryLeague.icon} {entryLeague.name}
                          </span>

                          <span className="text-xs font-black font-mono text-amber-400 shrink-0 w-14 text-right">
                            {entry.rating.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
