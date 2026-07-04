import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, KeyRound, Eye, EyeOff, UserPlus, LogIn, ChevronRight, Sparkles, Check, Zap, Hammer, Users, Trophy } from 'lucide-react';
import { UserAccount } from '../types';
import { synths } from '../audio';
import { hasVulgarLanguage } from '../utils';
import { api } from '../api';

interface AuthScreenProps {
  onLoginSuccess: (user: UserAccount) => void;
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

const AVATAR_BGS = [
  { class: 'bg-rose-500/20 border-rose-500/40 text-rose-300', value: 'bg-rose-500' },
  { class: 'bg-green-500/20 border-green-500/40 text-green-300', value: 'bg-green-500' },
  { class: 'bg-purple-500/20 border-purple-500/40 text-purple-300', value: 'bg-purple-500' },
  { class: 'bg-blue-500/20 border-blue-500/40 text-blue-300', value: 'bg-blue-500' },
  { class: 'bg-amber-500/20 border-amber-500/40 text-amber-300', value: 'bg-amber-500' },
  { class: 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300', value: 'bg-indigo-505' },
];

const GAME_FEATURES = [
  {
    id: 'gameplay',
    title: 'Velocity Rush',
    badge: 'Momentum',
    shortDesc: 'High-Velocity Physics Parkour',
    color: 'from-amber-500/10 to-orange-500/10 border-amber-500/30 text-amber-400',
    accentColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    accentBg: 'bg-amber-500'
  },
  {
    id: 'editor',
    title: 'Level Creator',
    badge: 'Sandbox',
    shortDesc: 'Create & Share Custom Courses',
    color: 'from-emerald-500/10 to-teal-500/10 border-emerald-500/30 text-emerald-400',
    accentColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    accentBg: 'bg-emerald-500'
  },
  {
    id: 'multiplayer',
    title: 'Speedrun Races',
    badge: 'Multiplayer',
    shortDesc: 'Real-Time Matchmaking Arenas',
    color: 'from-indigo-500/10 to-violet-500/10 border-indigo-500/30 text-indigo-400',
    accentColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
    accentBg: 'bg-indigo-500'
  },
  {
    id: 'leaderboard',
    title: 'Hall of Fame',
    badge: 'Ranked',
    shortDesc: 'Shave Milliseconds & Collect Medals',
    color: 'from-rose-500/10 to-pink-500/10 border-rose-500/30 text-rose-400',
    accentColor: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    accentBg: 'bg-rose-500'
  }
];

export default function AuthScreen({ onLoginSuccess }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [selectedAvatar, setSelectedAvatar] = useState('🚀');
  const [selectedBg, setSelectedBg] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  useEffect(() => {
    if (!isAutoPlay) return;
    const interval = setInterval(() => {
      setActiveTabIdx((prev) => (prev + 1) % GAME_FEATURES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlay, activeTabIdx]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<{
    x: number; y: number; vx: number; vy: number; size: number; rotation: number;
    rotationSpeed: number; opacity: number; fadeSpeed: number; color: string; isHollow: boolean;
  }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let isDragging = false;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    resizeCanvas();
    const resizeObserver = new ResizeObserver(() => resizeCanvas());
    resizeObserver.observe(container);

    const colors = [
      'rgba(99, 102, 241, #OP#)',
      'rgba(168, 85, 247, #OP#)',
      'rgba(236, 72, 153, #OP#)',
      'rgba(245, 158, 11, #OP#)',
      'rgba(34, 197, 94, #OP#)',
    ];

    const spawnParticle = (clientX: number, clientY: number, count = 1) => {
      const rect = container.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      for (let i = 0; i < count; i++) {
        const size = Math.random() * 12 + 6;
        const colorTemplate = colors[Math.floor(Math.random() * colors.length)];
        particlesRef.current.push({
          x, y,
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

    const handlePointerDown = (e: PointerEvent) => { isDragging = true; spawnParticle(e.clientX, e.clientY, 3); };
    const handlePointerMove = (e: PointerEvent) => { spawnParticle(e.clientX, e.clientY, isDragging ? 3 : 1); };
    const handlePointerUp = () => { isDragging = false; };

    container.addEventListener('pointerdown', handlePointerDown);
    container.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.rotation += p.rotationSpeed; p.opacity -= p.fadeSpeed;
        if (p.opacity <= 0) { particles.splice(i, 1); continue; }
        const color = p.color.replace('#OP#', p.opacity.toFixed(2));
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
        ctx.beginPath();
        const r = p.size;
        ctx.moveTo(Math.cos(-Math.PI / 2) * r, Math.sin(-Math.PI / 2) * r);
        ctx.lineTo(Math.cos(Math.PI / 6) * r, Math.sin(Math.PI / 6) * r);
        ctx.lineTo(Math.cos(5 * Math.PI / 6) * r, Math.sin(5 * Math.PI / 6) * r);
        ctx.closePath();
        ctx.shadowBlur = p.size * 0.8; ctx.shadowColor = color;
        if (p.isHollow) { ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, p.size * 0.15); ctx.stroke(); }
        else { ctx.fillStyle = color; ctx.fill(); }
        ctx.restore();
      }
      animationFrameId = requestAnimationFrame(render);
    };
    render();

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown);
      container.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, []);

  const clearInputs = () => { setUsername(''); setPassword(''); setConfirmPassword(''); setFeedback(null); };

  const notifyFeedback = (type: 'error' | 'success', message: string) => {
    setFeedback({ type, message });
    if (type === 'error') synths.playDeath();
    else synths.playFinish();
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    synths.playTick();

    const trimmedUsername = username.trim();
    if (!trimmedUsername) { notifyFeedback('error', 'Please enter a valid username.'); return; }
    if (trimmedUsername.length < 3) { notifyFeedback('error', 'Username must be at least 3 characters long.'); return; }
    if (password.length < 6) { notifyFeedback('error', 'Password must be at least 6 characters long.'); return; }

    setIsLoading(true);
    try {
      if (isSignUp) {
        if (hasVulgarLanguage(trimmedUsername)) {
          notifyFeedback('error', 'Explicit or vulgar language is prohibited.');
          return;
        }
        if (password !== confirmPassword) { notifyFeedback('error', 'Passwords do not match.'); return; }
        if (!selectedBg) { notifyFeedback('error', 'Please select an icon theme.'); return; }

        const result = await api.auth.signup(trimmedUsername, password, selectedAvatar, selectedBg);
        notifyFeedback('success', 'Account created successfully! Logging you in...');
        setTimeout(() => onLoginSuccess(result.user), 800);
      } else {
        const result = await api.auth.login(trimmedUsername, password);
        notifyFeedback('success', 'Logged in successfully! Loading dashboard...');
        setTimeout(() => onLoginSuccess(result.user), 800);
      }
    } catch (err: any) {
      notifyFeedback('error', err.message || 'Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-black via-neutral-950 to-blue-950 animate-gradient-flow text-neutral-100 flex items-center justify-center p-4 relative overflow-hidden font-sans select-none">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl pointer-events-none" />
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none z-0" />

      <div className="w-full max-w-md md:max-w-2xl relative z-10 space-y-6 animate-in fade-in zoom-in-95 duration-300">
        
        <div className="flex flex-col items-center justify-center space-y-3">
          <div className="w-14 h-14 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-600/25 border border-indigo-500/30 scale-105 flex items-center justify-center">
            <span className="text-3xl font-black font-sans leading-none select-none">Δ</span>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black font-sans uppercase tracking-widest text-neutral-50">
              DELTA RUSH<span className="text-sm font-mono font-bold text-indigo-500 lowercase ml-1">.win</span>
            </h1>
            <p className="text-xs text-neutral-400 font-mono uppercase tracking-widest mt-1">High Velocity Parkour Simulation</p>
          </div>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold font-mono uppercase tracking-wider text-neutral-25">
              {isSignUp ? 'Create Profile' : 'Member Portal'}
            </h2>
            <button
              onClick={() => { setIsSignUp(!isSignUp); clearInputs(); synths.playTick(); }}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-mono underline transition cursor-pointer"
            >
              {isSignUp ? 'Have an account? Sign In' : "No profile? Sign Up"}
            </button>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {feedback && (
              <div className={`p-3.5 rounded-xl border text-xs font-medium leading-relaxed ${
                feedback.type === 'error'
                  ? 'bg-rose-950/25 border-rose-800/40 text-rose-300'
                  : 'bg-green-950/25 border-green-800/40 text-green-300'
              }`}>
                {feedback.message}
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block ml-1">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500"><User className="w-4 h-4" /></span>
                <input
                  type="text" placeholder="e.g. SpeedLeaper9" value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/20 text-sm py-2.5 pl-10 pr-4 rounded-xl text-neutral-100 placeholder-neutral-600 transition"
                  maxLength={18} required
                />
              </div>
              {isSignUp && hasVulgarLanguage(username) && (
                <p className="text-rose-500 text-[10px] font-medium mt-1 pl-1">Explicit or vulgar language is prohibited.</p>
              )}
            </div>

            <div className="space-y-1.55">
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block ml-1">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500"><Lock className="w-4 h-4" /></span>
                <input
                  type={showPassword ? 'text' : 'password'} placeholder="Min. 6 alphanumeric" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/20 text-sm py-2.5 pl-10 pr-10 rounded-xl text-neutral-100 placeholder-neutral-600 transition"
                  minLength={6} required
                />
                <button type="button" onClick={() => { setShowPassword(!showPassword); synths.playTick(); }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300 transition">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {isSignUp && (
              <>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block ml-1">Confirm Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500"><KeyRound className="w-4 h-4" /></span>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'} placeholder="Repeat password" value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/20 text-sm py-2.5 pl-10 pr-10 rounded-xl text-neutral-100 placeholder-neutral-600 transition"
                      minLength={6} required
                    />
                    <button type="button" onClick={() => { setShowConfirmPassword(!showConfirmPassword); synths.playTick(); }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300 transition">
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-3.5 pt-2 border-t border-neutral-800/40">
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block ml-1 mb-1.5 text-left">Select Runner Glyph</span>
                    <div className="grid grid-cols-4 gap-2">
                      {AVATARS.map(item => (
                        <button key={item.emoji} type="button" onClick={() => { setSelectedAvatar(item.emoji); synths.playTick(); }}
                          className={`py-2 rounded-xl text-lg flex items-center justify-center border transition ${
                            selectedAvatar === item.emoji ? 'bg-indigo-600/25 border-indigo-500 text-white' : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700'
                          }`} title={item.name}>
                          {item.emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block ml-1 mb-1.5 text-left">Icon Theme</span>
                    <div className="flex gap-2">
                      {AVATAR_BGS.map(bg => (
                        <button key={bg.value} type="button" onClick={() => { setSelectedBg(bg.value); synths.playTick(); }}
                          className={`w-8 h-8 rounded-full border flex items-center justify-center transition focus:outline-none ${bg.class} relative`}>
                          {selectedBg === bg.value && <Check className="w-3.5 h-3.5 stroke-[3] text-white" />}
                        </button>
                      ))}
                    </div>
                    {isSignUp && !selectedBg && (
                      <p className="text-rose-500 text-[10px] font-medium mt-1 pl-1">Please select an icon theme.</p>
                    )}
                  </div>
                </div>
              </>
            )}

            <button
              type="submit" disabled={isLoading}
              className="w-full mt-4 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 transition flex items-center justify-center gap-2 cursor-pointer text-sm font-mono uppercase tracking-widest leading-none"
            >
              {isLoading ? (
                <span className="animate-pulse">Connecting...</span>
              ) : isSignUp ? (
                <><UserPlus className="w-4 h-4" />Create Account<ChevronRight className="w-4 h-4" /></>
              ) : (
                <><LogIn className="w-4 h-4" />Authenticate<ChevronRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-5 text-center flex items-center justify-center gap-1.5 text-[10px] font-mono text-neutral-500">
            <Sparkles className="w-3 h-3 text-indigo-500" />
            <span>Accounts secured server-side with bcrypt.</span>
          </div>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-800/60 pb-4">
            <h3 className="text-sm md:text-base font-mono font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500 animate-pulse" />
              <span>Explore Game Features</span>
            </h3>
            <button
              onClick={() => setIsAutoPlay(!isAutoPlay)}
              className="text-[10px] font-mono text-neutral-500 hover:text-neutral-300 transition"
            >
              {isAutoPlay ? 'Auto-rotating' : 'Paused'}
            </button>
          </div>

          <div className="flex gap-2 flex-wrap">
            {GAME_FEATURES.map((feature, idx) => (
              <button
                key={feature.id}
                onClick={() => { setActiveTabIdx(idx); setIsAutoPlay(false); synths.playTick(); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                  activeTabIdx === idx ? feature.accentColor : 'bg-neutral-800/50 border-neutral-700/50 text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <span className="text-[10px] font-mono uppercase tracking-wider">{feature.badge}</span>
              </button>
            ))}
          </div>

          {GAME_FEATURES.map((feature, idx) => (
            activeTabIdx === idx && (
              <div key={feature.id} className={`bg-gradient-to-br ${feature.color} border rounded-2xl p-5 space-y-2 animate-in fade-in duration-200`}>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border ${feature.accentColor}`}>
                  {feature.badge === 'Momentum' && <Zap className="w-3 h-3" />}
                  {feature.badge === 'Sandbox' && <Hammer className="w-3 h-3" />}
                  {feature.badge === 'Multiplayer' && <Users className="w-3 h-3" />}
                  {feature.badge === 'Ranked' && <Trophy className="w-3 h-3" />}
                  {feature.badge}
                </div>
                <h4 className="text-base font-black text-neutral-100 tracking-tight">{feature.title}</h4>
                <p className="text-xs text-neutral-400 leading-relaxed">{feature.shortDesc}</p>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
