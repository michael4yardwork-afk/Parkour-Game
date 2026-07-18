import React, { useState, useRef, useEffect } from 'react';
import { Code, Settings, Trophy, ArrowRight, ShieldCheck, Info, LogOut, User, KeyRound, Sparkles, Check, Lock, ShieldAlert, Users, Star, Flag, Zap, Swords, Hammer, Medal, Crown } from 'lucide-react';
import PlatinumGate from './PlatinumGate';
import { GameSettings, UserAccount, RaceHistoryEntry } from '../types';
import { DEFAULT_LEVELS } from '../defaultLevels';
import { synths } from '../audio';
import { api } from '../api';

const formatPercentile = (p: number): string => {
  if (p < 1) return p.toFixed(2);
  if (p < 5) return p.toFixed(1);
  return Math.round(p).toString();
};

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

const getWorldRankAndPercentile = (levelId: string, time: number | null, username: string) => {
  if (time === null || time <= 0.05) return { rank: null, total: 0, percentile: null };
  try {
    const stored = localStorage.getItem(`leaderboard_${levelId}`);
    const entries = stored ? JSON.parse(stored) : [];
    const activeName = username.toLowerCase().trim();
    
    const playerBests: { [username: string]: number } = {};
    entries.forEach((r: any) => {
      if (!r.time || r.time <= 0.05) return;
      const name = r.playerName.toLowerCase().trim();
      if (!playerBests[name] || r.time < playerBests[name]) {
        playerBests[name] = r.time;
      }
    });
    
    const otherPlayerTimes = Object.keys(playerBests)
      .filter(name => name !== activeName)
      .map(name => playerBests[name]);
      
    otherPlayerTimes.push(time);
    otherPlayerTimes.sort((a, b) => a - b);
    
    const rankIdx = otherPlayerTimes.indexOf(time);
    const rank = rankIdx + 1;
    const totalLen = otherPlayerTimes.length;
    
    let percentile = 0;
    if (totalLen > 1) {
      percentile = (rankIdx / (totalLen - 1)) * 100;
    } else {
      percentile = 0;
    }
    
    return { rank, total: totalLen, percentile };
  } catch (e) {
    return { rank: null, total: 0, percentile: null };
  }
};

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

  // Derived stats from local data
  const totalCompletions = parseInt(localStorage.getItem('delta_rush_total_completions') ?? '0', 10);

  const customLevels: any[] = (() => {
    try { return JSON.parse(localStorage.getItem('custom_parkour_levels') ?? '[]'); } catch { return []; }
  })();
  const coursesBuilt = customLevels.length;

  const totalRaces = raceHistory.length;
  const raceWins = raceHistory.filter(r => r.place === 1).length;

  const bestRank = (() => {
    let best: number | null = null;
    for (const lvl of DEFAULT_LEVELS) {
      const { rank } = getWorldRankAndPercentile(lvl.id, parseFloat(localStorage.getItem(`best_time_${lvl.id}`) ?? '0'), currentUser.username);
      if (rank !== null && (best === null || rank < best)) best = rank;
    }
    return best;
  })();

  const handleFovChange = (val: number) => {
    onChangeSettings({ ...settings, fov: val });
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);
    synths.playTick();

    if (btoa(currentPassword) !== currentUser.passwordHash) {
      setPasswordFeedback({ type: 'error', message: 'Current password provided is incorrect.' });
      synths.playDeath();
      return;
    }

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

    onUpdateCurrentUser({ passwordHash: btoa(newPassword) });
    setPasswordFeedback({ type: 'success', message: 'Security password changed successfully!' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    synths.playFinish();
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
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-12 font-sans text-neutral-800 select-none">
      
      {/* Top Welcome Ribbon / Profile Widget */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between p-6 bg-neutral-50 rounded-3xl border border-neutral-200/80 gap-6">
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-md border border-neutral-200 ${currentUser.avatarBg || 'bg-indigo-600'}`}>
            {currentUser.avatar}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-neutral-950 tracking-tight">Greetings, {currentUser.username}</h2>
              {isPlatinum ? (
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full font-mono uppercase tracking-wider">Platinum Plan</span>
              ) : (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full font-mono uppercase tracking-wider">Regular Plan</span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 font-mono">
              Registrant Since: {currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'Active Session'}
            </p>
          </div>
        </div>

        {/* Quick profile stats */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          {followers !== null && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-neutral-200 rounded-xl shadow-sm">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              <span className="text-neutral-500 uppercase tracking-wider text-[10px]">Followers</span>
              <span className="font-bold text-neutral-800">{followers.toLocaleString()}</span>
            </div>
          )}
          {rating !== null && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white border border-neutral-200 rounded-xl shadow-sm">
              <Star className="w-3.5 h-3.5" style={{ color: ratingColor }} />
              <span className="text-neutral-500 uppercase tracking-wider text-[10px]">Rating</span>
              <span className="font-bold" style={{ color: ratingColor }}>{Math.round(rating)}</span>
            </div>
          )}
          <button
            onClick={() => {
              synths.playTick();
              setShowLogoutConfirm(true);
            }}
            className="px-4 py-2 bg-neutral-900 text-white rounded-xl hover:bg-neutral-800 transition flex items-center gap-2 cursor-pointer font-semibold uppercase text-[10px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Title Hero */}
      <div 
        ref={bannerRef}
        className="relative rounded-3xl overflow-hidden bg-neutral-900 text-white p-8 md:p-12 shadow-2xl flex flex-col justify-between min-h-[340px] border border-neutral-800 cursor-crosshair hover:border-indigo-500/40 hover:shadow-indigo-500/5 active:scale-[0.99] transition-all duration-300 select-none"
      >
        {/* Sky glow effect */}
        <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-indigo-500/10 via-transparent to-transparent pointer-events-none" />

        {/* Dynamic Sparkle Canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-10" />

        <div className="max-w-xl relative z-20 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider mb-5">
            <span className="text-sm font-black text-indigo-400 font-sans leading-none">Δ</span>
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
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none text-white">
            <span className="rainbow-text">Delta Rush</span>
          </h1>
          <p className="text-sm text-neutral-300 mt-4 leading-relaxed max-w-lg">
            A high-skill 3D parkour time-trial racer focused on flow, momentum preservation, and precision routing. Run, wall-run, leap off rails, and shave precious milliseconds off your runs as <span className="text-indigo-400 font-bold">{currentUser.username}</span>.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-neutral-800/60 relative z-20">
          <button
            onClick={() => onNavigate('levels')}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs transition duration-200 shadow-lg hover:shadow-indigo-500/10 hover:scale-102 cursor-pointer"
          >
            Select Course
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('editor')}
            className="flex items-center gap-2 px-6 py-3 bg-neutral-850 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 rounded-2xl font-semibold text-xs transition duration-200 cursor-pointer"
          >
            <Code className="w-4 h-4" />
            Sandbox Builder
          </button>
        </div>
      </div>

      {/* Personal Records Panel */}
      <div className="bg-neutral-50 rounded-3xl p-6 md:p-8 border border-neutral-200/80">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Your Personal Records</h2>
            <p className="text-xs text-neutral-500">Track your best times across the handcrafted courses</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {DEFAULT_LEVELS.map(lvl => {
            const score = localStorage.getItem(`best_time_${lvl.id}`);
            let time = score ? parseFloat(score) : null;
            if (time !== null && time <= 0.05) {
              localStorage.removeItem(`best_time_${lvl.id}`);
              time = null;
            }
            return (
              <div 
                key={lvl.id} 
                className="bg-white border border-neutral-200/60 p-4.5 rounded-2xl flex flex-col justify-between shadow-sm hover:border-neutral-300 transition duration-200"
              >
                <span className="text-[10px] font-mono font-bold text-neutral-400 block uppercase tracking-wider">{lvl.name}</span>
                <div className="mt-2.5 flex items-baseline gap-1.55">
                  {time !== null ? (
                    <>
                      <span className="text-2xl font-black font-mono text-neutral-800">
                        {(() => {
                          const totalMilliseconds = Math.round(time * 1000);
                          const m = Math.floor(totalMilliseconds / 60000);
                          const s = Math.floor((totalMilliseconds % 60000) / 1000);
                          const ms = totalMilliseconds % 1000;
                          return `${m > 0 ? `${m}:` : ''}${s.toString().padStart(m > 0 ? 2 : 1, '0')}.${ms.toString().padStart(3, '0')}s`;
                        })()}
                      </span>
                      <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded uppercase font-mono">PB</span>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-neutral-400 font-mono italic">No record yet</span>
                  )}
                </div>

                {time !== null && (
                  <div id={`standing-percentile-lvl-${lvl.id}`} className="mt-3 text-[10px] font-mono flex items-center justify-between text-neutral-500 border-t border-neutral-100/60 pt-2.5">
                    {(() => {
                      const { rank, total, percentile } = getWorldRankAndPercentile(lvl.id, time, currentUser?.username || 'Guest');
                      return (
                        <>
                          <span className="uppercase tracking-wider">
                            World Rank: <span className="font-bold text-neutral-700">#{rank ?? 'N/A'}</span>
                            {rank !== null && <span className="text-neutral-400 font-normal font-sans"> / {total}</span>}
                          </span>
                          {percentile !== null && (
                            <span className="font-bold font-sans text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">
                              Top {formatPercentile(percentile)}%
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

      {/* Activity Statistics */}
      <div className="bg-neutral-50 rounded-3xl p-6 md:p-8 border border-neutral-200/80">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-neutral-900 tracking-tight">Activity Statistics</h2>
            <p className="text-xs text-neutral-500">A snapshot of your overall Delta Rush career</p>
          </div>
        </div>

        {isPlatinum ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Total Completions */}
          <div className="bg-white border border-neutral-200/60 rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:border-amber-300/60 hover:shadow-amber-500/5 transition duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Total Completions</span>
              <Flag className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-3xl font-black font-mono text-neutral-800 leading-none">{totalCompletions}</span>
            <span className="text-[10px] text-neutral-400 font-mono">runs finished</span>
          </div>

          {/* Most Liked Course */}
          <div className="bg-white border border-neutral-200/60 rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:border-pink-300/60 hover:shadow-pink-500/5 transition duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Most Liked</span>
              <Star className="w-3.5 h-3.5 text-pink-400 group-hover:scale-110 transition-transform" />
            </div>
            {mostLikedCourse !== null ? (
              <>
                <span className="text-2xl font-black font-mono text-neutral-800 leading-none">{mostLikedCourse.likes}</span>
                <span className="text-[10px] text-neutral-400 font-mono truncate" title={mostLikedCourse.name}>
                  ♥ {mostLikedCourse.name}
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-neutral-400 font-mono italic leading-none">—</span>
                <span className="text-[10px] text-neutral-400 font-mono">no published courses</span>
              </>
            )}
          </div>

          {/* Best World Rank */}
          <div className="bg-white border border-neutral-200/60 rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:border-indigo-300/60 hover:shadow-indigo-500/5 transition duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Best Rank</span>
              <Medal className="w-3.5 h-3.5 text-indigo-400 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-3xl font-black font-mono text-neutral-800 leading-none">
              {bestRank !== null ? `#${bestRank}` : '—'}
            </span>
            <span className="text-[10px] text-neutral-400 font-mono">world leaderboard</span>
          </div>

          {/* Total Races */}
          <div className="bg-white border border-neutral-200/60 rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:border-purple-300/60 hover:shadow-purple-500/5 transition duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Total Races</span>
              <Swords className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-3xl font-black font-mono text-neutral-800 leading-none">{totalRaces}</span>
            <span className="text-[10px] text-neutral-400 font-mono">multiplayer bouts</span>
          </div>

          {/* Race Wins */}
          <div className="bg-white border border-neutral-200/60 rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:border-rose-300/60 hover:shadow-rose-500/5 transition duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Race Wins</span>
              <Trophy className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-3xl font-black font-mono text-neutral-800 leading-none">{raceWins}</span>
            <span className="text-[10px] text-neutral-400 font-mono">
              {totalRaces > 0 ? `${Math.round((raceWins / totalRaces) * 100)}% win rate` : 'no races yet'}
            </span>
          </div>

          {/* Courses Built */}
          <div className="bg-white border border-neutral-200/60 rounded-2xl p-4 flex flex-col gap-2 shadow-sm hover:border-cyan-300/60 hover:shadow-cyan-500/5 transition duration-200 group">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">Courses Built</span>
              <Hammer className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            </div>
            <span className="text-3xl font-black font-mono text-neutral-800 leading-none">{coursesBuilt}</span>
            <span className="text-[10px] text-neutral-400 font-mono">in sandbox builder</span>
          </div>
        </div>
        ) : (
        <button
          onClick={() => setGate({ feature: 'Activity Statistics', description: 'Track your race wins, completions, world rank, and full career performance data.' })}
          className="w-full rounded-2xl border-2 border-dashed border-yellow-400/20 bg-yellow-500/5 hover:bg-yellow-500/10 transition p-8 text-center cursor-pointer"
        >
          <Crown className="w-7 h-7 text-yellow-400/60 mx-auto mb-2.5" />
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-yellow-500/70 mb-1">Platinum Feature</p>
          <p className="text-sm font-semibold text-neutral-400">Activity Statistics</p>
          <p className="text-xs text-neutral-600 mt-1">Upgrade to Platinum to see your career stats</p>
        </button>
        )}
      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200/90 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative space-y-4 animate-in fade-in duration-200 text-center">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-neutral-900 tracking-tight">Sign Out of Delta Rush?</h3>
              <p className="text-xs text-neutral-500 leading-relaxed">
                Are you sure you want to exit your active runner session? You will need to authenticate again to access your custom levels and stats.
              </p>
            </div>
            <div className="flex gap-3 pt-2 font-mono text-[11px]">
              <button
                onClick={() => {
                  synths.playTick();
                  setShowLogoutConfirm(false);
                }}
                className="flex-1 py-2.5 bg-neutral-100 hover:bg-neutral-200/80 border border-neutral-200 text-neutral-700 font-bold rounded-xl transition cursor-pointer uppercase tracking-wider"
              >
                No, Stay
              </button>
              <button
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md shadow-indigo-600/15 transition cursor-pointer uppercase tracking-wider"
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
