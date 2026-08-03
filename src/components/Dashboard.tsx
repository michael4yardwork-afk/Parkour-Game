import React, { useState, useRef, useEffect } from 'react';
import { Code, Settings, Trophy, ArrowRight, ShieldCheck, Info, LogOut, User, KeyRound, Sparkles, Check, Lock, ShieldAlert, Users, Star, Flag, Zap, Swords, Hammer, Medal, Crown } from 'lucide-react';
import PlatinumGate from './PlatinumGate';
import { GameSettings, UserAccount, RaceHistoryEntry } from '../types';
import { DEFAULT_LEVELS } from '../defaultLevels';
import { synths } from '../audio';
import { api } from '../api';
import { formatPercentile, getPlayerRanking, PlayerRanking } from '../utils/rankings';
import { isChampionRace } from '../utils/raceStats';

interface DashboardProps {
  settings: GameSettings;
  onChangeSettings: (settings: GameSettings) => void;
  onNavigate: (tab: 'levels' | 'editor') => void;
  currentUser: UserAccount;
  onLogout: () => void;
  onUpdateCurrentUser: (updates: Partial<UserAccount>) => void;
  isPlatinum?: boolean;
  onUpgrade?: () => void;
}

const AVATARS = [
  { emoji: '🚀', name: 'Speedrunner' },
  { emoji: '⚡', name: 'Volt Sprint' },
  { emoji: '🛹', name: 'Skater' },
  { emoji: '🐺', name: 'Alpha Wolf' },
  { emoji: '🐉', name: 'Dragon Master' },
  { emoji: '🤖', name: 'Cybernetic' },
  { emoji: '🐱', name: 'Ninja Cat' },
  { emoji: '🦊', name: 'Swift Fox' },
  { emoji: '🎯', name: 'Apex Precision' },
  { emoji: '🔥', name: 'Overdrive' },
  { emoji: '👑', name: 'Championship' },
  { emoji: '🦁', name: 'Primal Spirit' },
];

export default function Dashboard({ settings, onChangeSettings, onNavigate, currentUser, onLogout, onUpdateCurrentUser, isPlatinum, onUpgrade }: DashboardProps) {
  const [gate, setGate] = useState<{ feature: string; description?: string } | null>(null);
  // Security Panel State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Social stats
  const [followers, setFollowers] = useState<number | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [ratingColor, setRatingColor] = useState('#3b82f6');

  // Activity stats
  const [raceHistory, setRaceHistory] = useState<RaceHistoryEntry[]>([]);
  const [mostLikedCourse, setMostLikedCourse] = useState<{ name: string; likes: number } | null>(null);
  const [courseStandings, setCourseStandings] = useState<Record<string, PlayerRanking | null>>({});

  useEffect(() => {
    api.users.getProfile(currentUser.username).then(data => {
      setFollowers(data.followersCount ?? 0);
      setRating(data.rating ?? null);
      setRatingColor(data.color ?? '#3b82f6');
    }).catch(() => {});

    api.users.getRaceHistory(currentUser.username).then(history => {
      setRaceHistory(history ?? []);
    }).catch(() => {});

    api.community.getCourses().then(({ courses }) => {
      const mine = courses.filter(c =>
        c.creator?.toLowerCase().trim() === currentUser.username.toLowerCase().trim()
      );
      if (mine.length === 0) return;
      const top = mine.reduce((best, c) =>
        (c.likesCount ?? 0) > (best.likesCount ?? 0) ? c : best
      );
      setMostLikedCourse({ name: top.name, likes: top.likesCount ?? 0 });
    }).catch(() => {});
  }, [currentUser.username]);

  useEffect(() => {
    let cancelled = false;

    Promise.all(DEFAULT_LEVELS.map(async level => {
      const localBestRaw = localStorage.getItem(`best_time_${level.id}`);
      const localBest = localBestRaw ? parseFloat(localBestRaw) : null;
      const entries = await api.leaderboard.get(level.id);
      return [
        level.id,
        getPlayerRanking(entries, currentUser.username, localBest),
      ] as const;
    })).then(results => {
      if (cancelled) return;
      const standings: Record<string, PlayerRanking | null> = {};
      results.forEach(([levelId, ranking]) => {
        standings[levelId] = ranking;
      });
      setCourseStandings(standings);
    });

    return () => {
      cancelled = true;
    };
  }, [currentUser.username]);

  // Derived stats from local data
  const totalCompletions = parseInt(localStorage.getItem('delta_rush_total_completions') ?? '0', 10);

  const customLevels: any[] = (() => {
    try { return JSON.parse(localStorage.getItem('custom_parkour_levels') ?? '[]'); } catch { return []; }
  })();
  const coursesBuilt = customLevels.length;

  const totalRaces = raceHistory.length;
  const raceWins = raceHistory.filter(isChampionRace).length;

  const bestRank = (() => {
    let best: number | null = null;
    for (const lvl of DEFAULT_LEVELS) {
      const rank = courseStandings[lvl.id]?.rank ?? null;
      if (rank !== null && (best === null || rank < best)) best = rank;
    }
    return best;
  })();

  const handleFovChange = (val: number) => {
    onChangeSettings({ ...settings, fov: val });
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);
    synths.playTick();

    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', message: 'New password must be at least 6 characters.' });
      synths.playDeath();
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordFeedback({ type: 'error', message: 'New passwords do not match.' });
      synths.playDeath();
      return;
    }

    try {
      const { api } = await import('../api');
      await api.auth.changePassword(currentPassword, newPassword);
      setPasswordFeedback({ type: 'success', message: 'Password changed successfully!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      synths.playFinish();
    } catch (err: any) {
      setPasswordFeedback({ type: 'error', message: err.message || 'Failed to change password.' });
      synths.playDeath();
    }
  };

  const selectAvatar = (emoji: string) => {
    synths.playTick();
    onUpdateCurrentUser({ avatar: emoji });
  };

  const selectBg = (bgValue: string) => {
    synths.playTick();
    onUpdateCurrentUser({ avatarBg: bgValue });
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    rotation: number;
    rotationSpeed: number;
    opacity: number;
    fadeSpeed: number;
    color: string;
    isHollow: boolean;
  }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const banner = bannerRef.current;
    if (!canvas || !banner) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isDragging = false;

    const resizeCanvas = () => {
      const rect = banner.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(banner);

    const colors = [
      'rgba(99, 102, 241, #OP#)',  // Indigo
      'rgba(168, 85, 247, #OP#)', // Purple
      'rgba(236, 72, 153, #OP#)', // Pink/Magenta
      'rgba(245, 158, 11, #OP#)',  // Gold
      'rgba(34, 197, 94, #OP#)',   // Emerald
    ];

    const spawnParticle = (clientX: number, clientY: number, count = 1) => {
      const rect = banner.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      for (let i = 0; i < count; i++) {
        const size = Math.random() * 12 + 6;
        const colorTemplate = colors[Math.floor(Math.random() * colors.length)];
        
        particlesRef.current.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -Math.random() * 1.5 - 0.5,
          size,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.1,
          opacity: 1.0,
          fadeSpeed: Math.random() * 0.02 + 0.015,
          color: colorTemplate,
          isHollow: Math.random() > 0.4,
        });
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      isDragging = true;
      spawnParticle(e.clientX, e.clientY, 3);
    };

    const handlePointerMove = (e: PointerEvent) => {
      const spawnCount = isDragging ? 3 : 1;
      spawnParticle(e.clientX, e.clientY, spawnCount);
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    banner.addEventListener('pointerdown', handlePointerDown);
    banner.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        p.opacity -= p.fadeSpeed;

        if (p.opacity <= 0) {
          particles.splice(i, 1);
          continue;
        }

        const color = p.color.replace('#OP#', p.opacity.toFixed(2));

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        
        ctx.beginPath();
        const r = p.size;
        const angle1 = -Math.PI / 2;
        const angle2 = Math.PI / 6;
        const angle3 = 5 * Math.PI / 6;

        ctx.moveTo(Math.cos(angle1) * r, Math.sin(angle1) * r);
        ctx.lineTo(Math.cos(angle2) * r, Math.sin(angle2) * r);
        ctx.lineTo(Math.cos(angle3) * r, Math.sin(angle3) * r);
        ctx.closePath();

        ctx.shadowBlur = p.size * 0.8;
        ctx.shadowColor = color;

        if (p.isHollow) {
          ctx.strokeStyle = color;
          ctx.lineWidth = Math.max(1.5, p.size * 0.15);
          ctx.stroke();
        } else {
          ctx.fillStyle = color;
          ctx.fill();
        }

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      banner.removeEventListener('pointerdown', handlePointerDown);
      banner.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      resizeObserver.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="min-h-full bg-neutral-950 text-neutral-100 font-sans select-none">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">

        {/* ── Profile ribbon ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 px-5 py-4 bg-neutral-900 border border-neutral-800 rounded-2xl">
          <div className="flex items-center gap-4">
            {/* Avatar with glow ring */}
            <div className="relative">
              <div
                className={`w-13 h-13 w-[52px] h-[52px] rounded-xl flex items-center justify-center text-2xl shadow-lg border border-white/10 ${currentUser.avatarBg || 'bg-indigo-600'}`}
                style={{ boxShadow: '0 0 18px rgba(99,102,241,0.35)' }}
              >
                {currentUser.avatar}
              </div>
              {isPlatinum && (
                <span className="absolute -bottom-1.5 -right-1.5 w-5 h-5 bg-amber-400 rounded-full flex items-center justify-center text-[9px]">👑</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-black text-white tracking-tight">
                  {currentUser.username}
                </h2>
                {isPlatinum ? (
                  <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 text-[9px] font-bold rounded-full font-mono uppercase tracking-wider border border-amber-500/25">Platinum</span>
                ) : (
                  <span className="px-2 py-0.5 bg-neutral-800 text-neutral-500 text-[9px] font-bold rounded-full font-mono uppercase tracking-wider border border-neutral-700">Free</span>
                )}
              </div>
              <p className="text-[11px] text-neutral-500 mt-0.5 font-mono">
                Member since {currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'active session'}
              </p>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="flex items-center gap-2 flex-wrap">
            {followers !== null && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800/80 border border-neutral-700/60 rounded-xl">
                <Users className="w-3 h-3 text-indigo-400" />
                <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">Followers</span>
                <span className="text-xs font-black text-white font-mono">{followers.toLocaleString()}</span>
              </div>
            )}
            {rating !== null && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800/80 border border-neutral-700/60 rounded-xl">
                <Star className="w-3 h-3" style={{ color: ratingColor }} />
                <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">Rating</span>
                <span className="text-xs font-black font-mono" style={{ color: ratingColor }}>{Math.round(rating)}</span>
              </div>
            )}
            <button
              onClick={() => {
                synths.playTick();
                setShowLogoutConfirm(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-red-500/15 border border-neutral-700 hover:border-red-500/40 text-neutral-400 hover:text-red-400 rounded-xl transition duration-200 cursor-pointer text-[10px] font-bold font-mono uppercase tracking-wider"
            >
              <LogOut className="w-3 h-3" />
              Sign Out
            </button>
          </div>
        </div>

        {/* ── Hero banner ─────────────────────────────────────────────────── */}
        <div
          ref={bannerRef}
          className="relative rounded-3xl overflow-hidden cursor-crosshair select-none min-h-[300px] flex flex-col justify-between"
          style={{
            background: 'linear-gradient(135deg, #0a0a14 0%, #0f0f1e 40%, #0e0a20 100%)',
            border: '1px solid rgba(99,102,241,0.2)',
            boxShadow: '0 0 60px rgba(99,102,241,0.08), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Speed-line grid */}
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.035]"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, rgba(255,255,255,1) 0px, rgba(255,255,255,1) 1px, transparent 1px, transparent 80px), repeating-linear-gradient(0deg, rgba(255,255,255,1) 0px, rgba(255,255,255,1) 1px, transparent 1px, transparent 80px)',
            }}
          />
          {/* Radial glow */}
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', transform: 'translate(30%, -30%)' }} />
          <div className="absolute bottom-0 left-1/3 w-96 h-60 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, rgba(168,85,247,0.07) 0%, transparent 70%)' }} />

          {/* Particle canvas */}
          <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

          <div className="relative z-20 pointer-events-none p-8 md:p-12">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-full text-[9px] font-mono uppercase font-bold tracking-widest mb-4">
              <span className="text-xs font-black text-indigo-300 leading-none">Δ</span>
              V0.4 Community Release
            </span>
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes rainbow-flow {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
              .rainbow-text {
                background: linear-gradient(
                  90deg,
                  #ff3366, #ff9933, #33cc66, #3399ff, #9933ff, #ff3366
                );
                background-size: 300% 100%;
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                text-fill-color: transparent;
                animation: rainbow-flow 6s linear infinite;
                display: inline-block;
              }
            `}} />
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter leading-none text-white mb-1">
              <span className="rainbow-text">Delta Rush</span>
            </h1>
            <p className="text-sm text-neutral-400 mt-4 leading-relaxed max-w-md">
              High-skill 3D parkour time-trial racing. Flow, momentum, precision routing.
              Run as <span className="text-indigo-400 font-bold">{currentUser.username}</span> and shave milliseconds off every run.
            </p>
          </div>

          <div className="relative z-20 flex flex-wrap gap-3 px-8 md:px-12 pb-8 md:pb-10">
            <button
              onClick={() => onNavigate('levels')}
              className="flex items-center gap-2 px-6 py-3 text-white rounded-xl font-bold text-xs transition duration-200 cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                boxShadow: '0 4px 20px rgba(99,102,241,0.4)',
              }}
            >
              Select Course
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('editor')}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-neutral-300 rounded-xl font-semibold text-xs transition duration-200 cursor-pointer backdrop-blur-sm"
            >
              <Code className="w-4 h-4" />
              Sandbox Builder
            </button>
          </div>
        </div>

        {/* ── Personal Records ─────────────────────────────────────────────── */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <Trophy className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-tight">Personal Records</h2>
              <p className="text-[11px] text-neutral-500 font-mono">Best times across all handcrafted courses</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {DEFAULT_LEVELS.map((lvl, i) => {
              const score = localStorage.getItem(`best_time_${lvl.id}`);
              let time = score ? parseFloat(score) : null;
              if (time !== null && time <= 0.05) {
                localStorage.removeItem(`best_time_${lvl.id}`);
                time = null;
              }
              // Cycle through accent colors per course
              const accents = [
                { glow: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.3)', text: '#818cf8' },
                { glow: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)', text: '#34d399' },
                { glow: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', text: '#fbbf24' },
                { glow: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.25)', text: '#f472b6' },
                { glow: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.25)', text: '#a78bfa' },
                { glow: 'rgba(6,182,212,0.12)', border: 'rgba(6,182,212,0.25)', text: '#22d3ee' },
              ];
              const accent = accents[i % accents.length];
              return (
                <div
                  key={lvl.id}
                  className="relative rounded-2xl p-4 flex flex-col justify-between overflow-hidden transition duration-200 hover:scale-[1.01]"
                  style={{
                    background: time ? `linear-gradient(135deg, ${accent.glow}, rgba(15,15,25,0.9))` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${time ? accent.border : 'rgba(255,255,255,0.07)'}`,
                  }}
                >
                  <span className="text-[9px] font-mono font-bold text-neutral-500 block uppercase tracking-widest">{lvl.name}</span>
                  <div className="mt-3 flex items-baseline gap-1.5">
                    {time !== null ? (
                      <>
                        <span className="text-2xl font-black font-mono text-white">
                          {(() => {
                            const totalMilliseconds = Math.round(time * 1000);
                            const m = Math.floor(totalMilliseconds / 60000);
                            const s = Math.floor((totalMilliseconds % 60000) / 1000);
                            const ms = totalMilliseconds % 1000;
                            return `${m > 0 ? `${m}:` : ''}${s.toString().padStart(m > 0 ? 2 : 1, '0')}.${ms.toString().padStart(3, '0')}s`;
                          })()}
                        </span>
                        <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded uppercase" style={{ color: accent.text, background: accent.glow, border: `1px solid ${accent.border}` }}>PB</span>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-neutral-600 font-mono italic">No record yet</span>
                    )}
                  </div>

                  {time !== null && (
                    <div className="mt-3 pt-2.5 border-t border-white/5 text-[9px] font-mono flex items-center justify-between text-neutral-500">
                      {(() => {
                        const ranking = courseStandings[lvl.id];
                        return (
                          <>
                            <span className="uppercase tracking-wider">
                              Rank: <span className="font-bold text-neutral-300">#{ranking?.rank ?? 'N/A'}</span>
                              {ranking && <span className="text-neutral-600"> / {ranking.total}</span>}
                            </span>
                            {ranking && (
                              <span className="font-bold rounded px-1.5 py-0.5" style={{ color: accent.text, background: accent.glow }}>
                                Top {formatPercentile(ranking.percentile)}%
                              </span>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Activity Statistics ──────────────────────────────────────────── */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-xl" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)' }}>
              <Zap className="w-4 h-4 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white tracking-tight">Activity Statistics</h2>
              <p className="text-[11px] text-neutral-500 font-mono">Your overall Delta Rush career snapshot</p>
            </div>
          </div>

          {isPlatinum ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* Total Completions */}
              <div className="rounded-2xl p-4 flex flex-col gap-3 transition duration-200 group hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(245,158,11,0.04))', border: '1px solid rgba(245,158,11,0.2)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-widest">Completions</span>
                  <Flag className="w-3 h-3 text-amber-400" />
                </div>
                <span className="text-3xl font-black font-mono text-white leading-none">{totalCompletions}</span>
                <span className="text-[9px] text-neutral-600 font-mono">runs finished</span>
              </div>

              {/* Most Liked Course */}
              <div className="rounded-2xl p-4 flex flex-col gap-3 transition duration-200 group hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.1), rgba(236,72,153,0.04))', border: '1px solid rgba(236,72,153,0.2)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-widest">Most Liked</span>
                  <Star className="w-3 h-3 text-pink-400" />
                </div>
                {mostLikedCourse !== null ? (
                  <>
                    <span className="text-3xl font-black font-mono text-white leading-none">{mostLikedCourse.likes}</span>
                    <span className="text-[9px] text-neutral-600 font-mono truncate" title={mostLikedCourse.name}>♥ {mostLikedCourse.name}</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg font-semibold text-neutral-600 font-mono leading-none">—</span>
                    <span className="text-[9px] text-neutral-600 font-mono">no published courses</span>
                  </>
                )}
              </div>

              {/* Best World Rank */}
              <div className="rounded-2xl p-4 flex flex-col gap-3 transition duration-200 group hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.04))', border: '1px solid rgba(99,102,241,0.2)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-widest">Best Rank</span>
                  <Medal className="w-3 h-3 text-indigo-400" />
                </div>
                <span className="text-3xl font-black font-mono text-white leading-none">{bestRank !== null ? `#${bestRank}` : '—'}</span>
                <span className="text-[9px] text-neutral-600 font-mono">world leaderboard</span>
              </div>

              {/* Total Races */}
              <div className="rounded-2xl p-4 flex flex-col gap-3 transition duration-200 group hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(139,92,246,0.04))', border: '1px solid rgba(139,92,246,0.2)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-widest">Total Races</span>
                  <Swords className="w-3 h-3 text-violet-400" />
                </div>
                <span className="text-3xl font-black font-mono text-white leading-none">{totalRaces}</span>
                <span className="text-[9px] text-neutral-600 font-mono">multiplayer bouts</span>
              </div>

              {/* Race Wins */}
              <div className="rounded-2xl p-4 flex flex-col gap-3 transition duration-200 group hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.04))', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-widest">Race Wins</span>
                  <Trophy className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-3xl font-black font-mono text-emerald-400 leading-none">{raceWins}</span>
                <span className="text-[9px] text-neutral-600 font-mono">
                  {totalRaces > 0 ? `${Math.round((raceWins / totalRaces) * 100)}% win rate` : 'no races yet'}
                </span>
              </div>

              {/* Courses Built */}
              <div className="rounded-2xl p-4 flex flex-col gap-3 transition duration-200 group hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(6,182,212,0.04))', border: '1px solid rgba(6,182,212,0.2)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-widest">Courses Built</span>
                  <Hammer className="w-3 h-3 text-cyan-400" />
                </div>
                <span className="text-3xl font-black font-mono text-white leading-none">{coursesBuilt}</span>
                <span className="text-[9px] text-neutral-600 font-mono">in sandbox builder</span>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setGate({ feature: 'Activity Statistics', description: 'Track your race wins, completions, world rank, and full career performance data.' })}
              className="w-full rounded-2xl p-8 text-center cursor-pointer transition duration-200 hover:scale-[1.005]"
              style={{ background: 'rgba(245,158,11,0.04)', border: '1.5px dashed rgba(245,158,11,0.2)' }}
            >
              <Crown className="w-7 h-7 text-amber-400/50 mx-auto mb-3" />
              <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-amber-500/60 mb-1">Platinum Feature</p>
              <p className="text-sm font-bold text-neutral-400">Activity Statistics</p>
              <p className="text-xs text-neutral-600 mt-1">Upgrade to Platinum to see your career stats</p>
            </button>
          )}
        </div>

      </div>

      {/* ── Logout confirm modal ──────────────────────────────────────────── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] bg-neutral-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-sm w-full p-7 shadow-2xl relative space-y-5 text-center"
            style={{ boxShadow: '0 0 60px rgba(0,0,0,0.6)' }}>
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-white tracking-tight">Sign Out of Delta Rush?</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Your session will end. Re-authenticate to access your levels and stats.
              </p>
            </div>
            <div className="flex gap-3 font-mono text-[11px]">
              <button
                onClick={() => { synths.playTick(); setShowLogoutConfirm(false); }}
                className="flex-1 py-2.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 font-bold rounded-xl transition cursor-pointer uppercase tracking-wider"
              >
                No, Stay
              </button>
              <button
                onClick={() => { setShowLogoutConfirm(false); onLogout(); }}
                className="flex-1 py-2.5 text-white font-bold rounded-xl transition cursor-pointer uppercase tracking-wider"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', boxShadow: '0 4px 16px rgba(99,102,241,0.3)' }}
              >
                Yes, Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {gate && (
        <PlatinumGate
          isVisible
          feature={gate.feature}
          description={gate.description}
          onClose={() => setGate(null)}
          onUpgrade={onUpgrade ?? (() => {})}
        />
      )}
    </div>
  );
}
