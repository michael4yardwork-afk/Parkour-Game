import React, { useState, useEffect, useRef } from 'react';
import { User, Lock, KeyRound, Eye, EyeOff, UserPlus, LogIn, ChevronRight, Sparkles, Hammer, Users, TrendingUp, BarChart2, Smartphone, Tablet, Monitor, Mail, ArrowLeft, RotateCcw } from 'lucide-react';
import { UserAccount } from '../types';
import { synths } from '../audio';
import { hasVulgarLanguage } from '../utils';
import { api } from '../api';
import { SIGNUP_AVATAR_BGS } from '../avatarThemes';

interface AuthScreenProps {
  onLoginSuccess: (user: UserAccount, isNewAccount?: boolean) => void;
  onPlayDemo?: () => void;
  initialMode?: 'login' | 'signup';
}

const AVATARS = [
  { emoji: '🚀', name: 'Speedrunner' },
  { emoji: '⚡', name: 'Volt Sprint' },
  { emoji: '🛹', name: 'Skater' },
  { emoji: '🐺', name: 'Alpha Wolf' },
];

const GAME_FEATURES = [
  {
    id: 'improve',
    title: 'Track Your Progress',
    badge: 'Improve',
    shortDesc: 'Chase personal bests on every course. Study your run history, watch your times drop, and push yourself further with each attempt.',
    icon: 'improve',
    color: 'from-amber-500/20 via-orange-500/10 to-rose-500/5 border-amber-500/40',
    accentColor: 'text-amber-400 bg-amber-500/15 border-amber-500/30',
    glowColor: 'rgba(245,158,11,0.35)',
    decorBg: 'bg-amber-400/20',
    progressColor: 'bg-gradient-to-r from-amber-400 to-orange-400',
  },
  {
    id: 'compare',
    title: 'See How You Rank',
    badge: 'Compare',
    shortDesc: 'Real-time leaderboards show exactly where you stand on every course. Filter by level, spot the top runners, and find the gaps to close.',
    icon: 'compare',
    color: 'from-sky-500/20 via-cyan-500/10 to-blue-500/5 border-sky-500/40',
    accentColor: 'text-sky-400 bg-sky-500/15 border-sky-500/30',
    glowColor: 'rgba(14,165,233,0.35)',
    decorBg: 'bg-sky-400/20',
    progressColor: 'bg-gradient-to-r from-sky-400 to-cyan-400',
  },
  {
    id: 'race',
    title: 'Compete Live',
    badge: 'Race',
    shortDesc: 'Jump into matchmaking and go head-to-head against real players. Win races to earn ELO — lose and you\'ll drop. Every second counts.',
    icon: 'race',
    color: 'from-indigo-500/20 via-violet-600/10 to-purple-500/5 border-indigo-500/40',
    accentColor: 'text-indigo-400 bg-indigo-500/15 border-indigo-500/30',
    glowColor: 'rgba(99,102,241,0.35)',
    decorBg: 'bg-violet-400/20',
    progressColor: 'bg-gradient-to-r from-indigo-400 to-violet-400',
  },
  {
    id: 'create',
    title: 'Build & Share',
    badge: 'Create',
    shortDesc: 'Design your own parkour courses with the in-game editor. Place platforms, set traps, tune physics, and publish them for the whole community to run.',
    icon: 'create',
    color: 'from-emerald-500/20 via-teal-500/10 to-cyan-500/5 border-emerald-500/40',
    accentColor: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30',
    glowColor: 'rgba(16,185,129,0.35)',
    decorBg: 'bg-emerald-400/20',
    progressColor: 'bg-gradient-to-r from-emerald-400 to-teal-400',
  },
];

type AuthMode = 'login' | 'signup' | 'forgot' | 'check-email' | 'verify' | 'reset';

export default function AuthScreen({ onLoginSuccess, onPlayDemo, initialMode }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(initialMode === 'signup');
  // 'forgot' = request recovery email; 'reset' = set new password after clicking email link
  const [authMode, setAuthMode] = useState<AuthMode>(initialMode === 'signup' ? 'signup' : 'login');
  // Email carried through the forgot → verify → reset flow
  const [recoveryEmail, setRecoveryEmail] = useState<string>('');
  const [recoveryAccessToken, setRecoveryAccessToken] = useState<string>('');
  const [recoveryRefreshToken, setRecoveryRefreshToken] = useState<string>('');
  // 6-digit code entered during the verify step
  const [verifyCode, setVerifyCode] = useState<string>('');

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showNewPasswordConfirm, setShowNewPasswordConfirm] = useState(false);

  // Randomly assigned at mount — user can change after signing in.
  const [selectedAvatar] = useState(() => AVATARS[Math.floor(Math.random() * AVATARS.length)].emoji);
  const [selectedBg] = useState(() => SIGNUP_AVATAR_BGS[Math.floor(Math.random() * SIGNUP_AVATAR_BGS.length)].value);
  const [selectedDevice, setSelectedDevice] = useState<'phone' | 'tablet' | 'computer' | null>('computer');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [usernameTaken, setUsernameTaken] = useState(false);

  // Clean up any legacy Supabase recovery URL parameters that may still appear
  // if the user follows an old-style recovery link.
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(window.location.search);
    const isRecovery = hashParams.get('type') === 'recovery' && hashParams.get('access_token');
    if (isRecovery) {
      setRecoveryAccessToken(hashParams.get('access_token') || '');
      setRecoveryRefreshToken(hashParams.get('refresh_token') || '');
      setAuthMode('reset');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (queryParams.get('error')) {
      // Strip invalid recovery parameters from the URL bar and show a notice.
      window.history.replaceState({}, document.title, window.location.pathname);
      setFeedback({ type: 'error', message: 'That recovery link is no longer valid. Please request a new one below.' });
    }
  }, []);

  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [isAutoPlay, setIsAutoPlay] = useState(true);

  // Debounced username availability check (sign-up only)
  useEffect(() => {
    if (!isSignUp || username.trim().length < 3) {
      setUsernameTaken(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username.trim())}`);
        const data = await res.json();
        setUsernameTaken(!!data.taken);
      } catch {
        setUsernameTaken(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username, isSignUp]);

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

  const clearInputs = () => {
    setUsername(''); setEmail(''); setPassword(''); setConfirmPassword('');
    setNewPassword(''); setNewPasswordConfirm(''); setVerifyCode('');
    setFeedback(null); setUsernameTaken(false);
  };

  const switchToLogin = () => {
    setAuthMode('login');
    setIsSignUp(false);
    clearInputs();
    setRecoveryEmail('');
    setRecoveryAccessToken('');
    setRecoveryRefreshToken('');
    synths.playTick();
  };
  const switchToSignup = () => { setAuthMode('signup'); setIsSignUp(true); clearInputs(); synths.playTick(); };
  const switchToForgot = () => { setAuthMode('forgot'); clearInputs(); synths.playTick(); };

  const notifyFeedback = (type: 'error' | 'success', message: string) => {
    setFeedback({ type, message });
    if (type === 'error') synths.playDeath();
    else synths.playFinish();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    synths.playTick();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      notifyFeedback('error', 'Please enter a valid email address.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await api.auth.forgotPassword(trimmedEmail);
      // Supabase sends a signed reset link; the legacy code path remains
      // available when Supabase public auth is not configured.
      setRecoveryEmail(trimmedEmail);
      setVerifyCode('');
      setFeedback(null);
      setAuthMode(result.method === 'supabase-link' ? 'check-email' : 'verify');
    } catch (err: any) {
      notifyFeedback('error', err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    synths.playTick();
    const trimmedCode = verifyCode.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      notifyFeedback('error', 'Please enter the 6-digit code from your email.');
      return;
    }
    setIsLoading(true);
    try {
      await api.auth.verifyResetCode(recoveryEmail, trimmedCode);
      // Code is valid — advance to the new-password step
      setFeedback(null);
      setAuthMode('reset');
    } catch (err: any) {
      notifyFeedback('error', err.message || 'Invalid or expired code. Please try again or request a new one.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    synths.playTick();
    if (newPassword.length < 6) {
      notifyFeedback('error', 'Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      notifyFeedback('error', 'Passwords do not match.');
      return;
    }
    setIsLoading(true);
    try {
      const result = recoveryAccessToken
        ? await api.auth.resetPasswordWithSupabase(recoveryAccessToken, recoveryRefreshToken, newPassword)
        : await api.auth.resetPassword(recoveryEmail, verifyCode.trim(), newPassword);
      notifyFeedback('success', 'Password updated. Logging you in…');
      setRecoveryEmail('');
      setVerifyCode('');
      setTimeout(() => onLoginSuccess(result.user), 800);
    } catch (err: any) {
      notifyFeedback('error', err.message || 'Failed to reset password. The code may have expired — request a new one.');
    } finally {
      setIsLoading(false);
    }
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
        if (!selectedDevice) { notifyFeedback('error', 'Please select your device type.'); return; }
        const trimmedEmail = email.trim();
        if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
          notifyFeedback('error', 'Please enter a valid email address.');
          return;
        }

        // Write device-appropriate defaults so the game loads with the right controls.
        const touchControls = selectedDevice === 'phone' || selectedDevice === 'tablet';
        const initialSettings = {
          mouseSensitivity: 1.5,
          fov: 85,
          musicVolume: 0.5,
          sfxVolume: 0.5,
          showGhost: true,
          invertY: false,
          showJoystick: touchControls,
          showJumpButton: touchControls,
        };
        localStorage.setItem('momentum_player_settings', JSON.stringify(initialSettings));

        const result = await api.auth.signup(trimmedUsername, password, selectedAvatar, selectedBg, selectedDevice ?? undefined, trimmedEmail);
        notifyFeedback('success', 'Account created successfully! Logging you in...');
        // Override server-returned avatar/avatarBg with the exact values the user
        // picked in the form. The server stores what was sent, but the fallback
        // values (|| '🚀' / || 'bg-indigo-500') can win if the field is somehow
        // falsy — guaranteeing consistency here means the displayed icon always
        // matches the signup picker regardless of any server-side edge case.
        const userWithChosenIcon = {
          ...result.user,
          avatar: selectedAvatar,
          avatarBg: selectedBg,
        };
          setTimeout(() => onLoginSuccess(userWithChosenIcon, true), 800);
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
            <p className="text-xs text-neutral-400 font-mono uppercase tracking-widest mt-1">High Velocity Minimalistic Speedrunning</p>
          </div>
        </div>

        <div className="text-center space-y-1 px-2">
          <p className="text-2xl md:text-3xl font-black text-neutral-50 tracking-tight leading-tight">
            Beat your best time.{' '}
            <span className="text-glory-rainbow">
              Earn global glory.
            </span>
          </p>
        </div>

        <div className="bg-neutral-900/80 border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl backdrop-blur-md">

          {/* ── Forgot Password ─────────────────────────────────────── */}
          {authMode === 'forgot' && (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold font-mono uppercase tracking-wider text-neutral-100">Recover Account</h2>
                <button
                  type="button"
                  onClick={switchToLogin}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 cursor-pointer bg-neutral-800/60 border-neutral-700/50 text-neutral-300 hover:text-white hover:border-neutral-600"
                >
                  <ArrowLeft className="w-3 h-3" />Back
                </button>
              </div>

              <p className="text-xs text-neutral-400 leading-relaxed mb-5">
                Enter the email address linked to your account. We'll send you a 6-digit verification code so you can set a new password.
              </p>

              <form onSubmit={handleForgotPassword} className="space-y-4">
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
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block ml-1">Email Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500"><Mail className="w-4 h-4" /></span>
                    <input
                      type="email" placeholder="you@example.com" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/20 text-sm py-2.5 pl-10 pr-4 rounded-xl text-neutral-100 placeholder-neutral-600 transition"
                      autoFocus required
                    />
                  </div>
                </div>

                <button
                  type="submit" disabled={isLoading}
                  className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 transition flex items-center justify-center gap-2 cursor-pointer text-sm font-mono uppercase tracking-widest leading-none"
                >
                  {isLoading ? (
                    <span className="animate-pulse">Sending…</span>
                  ) : (
                    <><Mail className="w-4 h-4" />Send Verification Code<ChevronRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <div className="mt-4 text-center flex items-center justify-center gap-1.5 text-[10px] font-mono text-neutral-500">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span>Verification code expires in 15 minutes.</span>
              </div>
            </>
          )}

          {/* ── Verify Code ──────────────────────────────────────────── */}
          {authMode === 'check-email' && (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold font-mono uppercase tracking-wider text-neutral-100">Check Your Email</h2>
                <button
                  type="button"
                  onClick={switchToForgot}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 cursor-pointer bg-neutral-800/60 border-neutral-700/50 text-neutral-300 hover:text-white hover:border-neutral-600"
                >
                  <ArrowLeft className="w-3 h-3" />Back
                </button>
              </div>
              <p className="text-xs text-neutral-400 leading-relaxed mb-5">
                If an account with <span className="text-neutral-200 font-medium">{recoveryEmail}</span> exists, Supabase has sent a secure password recovery link. Open it on this device to choose a new password. Check your spam folder if it does not arrive within a minute.
              </p>
              <div className="mt-4 text-center text-[10px] font-mono text-neutral-500">
                The link expires automatically for your security.
              </div>
            </>
          )}

          {authMode === 'verify' && (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold font-mono uppercase tracking-wider text-neutral-100">Enter Code</h2>
                <button
                  type="button"
                  onClick={switchToForgot}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 cursor-pointer bg-neutral-800/60 border-neutral-700/50 text-neutral-300 hover:text-white hover:border-neutral-600"
                >
                  <ArrowLeft className="w-3 h-3" />Back
                </button>
              </div>

              <p className="text-xs text-neutral-400 leading-relaxed mb-5">
                We sent a 6-digit verification code to <span className="text-neutral-200 font-medium">{recoveryEmail}</span>. Enter it below to continue. Check your spam folder if it doesn't arrive within a minute.
              </p>

              <form onSubmit={handleVerifyCode} className="space-y-4">
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
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block ml-1">Verification Code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    placeholder="000000"
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/20 text-2xl text-center py-3 px-4 rounded-xl text-neutral-100 placeholder-neutral-700 tracking-[0.5em] font-mono transition"
                    maxLength={6}
                    autoFocus
                    required
                  />
                </div>

                <button
                  type="submit" disabled={isLoading || verifyCode.length !== 6}
                  className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 transition flex items-center justify-center gap-2 cursor-pointer text-sm font-mono uppercase tracking-widest leading-none"
                >
                  {isLoading ? (
                    <span className="animate-pulse">Verifying…</span>
                  ) : (
                    <><KeyRound className="w-4 h-4" />Verify Code<ChevronRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <div className="mt-4 text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-neutral-500">
                  <Sparkles className="w-3 h-3 text-indigo-500" />
                  <span>Code expires in 15 minutes.</span>
                </div>
                <p className="text-[10px] font-mono text-neutral-600">
                  Didn't receive it?{' '}
                  <button
                    type="button"
                    onClick={switchToForgot}
                    className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 cursor-pointer transition"
                  >
                    Resend code
                  </button>
                </p>
              </div>
            </>
          )}

          {/* ── Reset Password ───────────────────────────────────────── */}
          {authMode === 'reset' && (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold font-mono uppercase tracking-wider text-neutral-100">Set New Password</h2>
                <button
                  type="button"
                  onClick={switchToLogin}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 cursor-pointer bg-neutral-800/60 border-neutral-700/50 text-neutral-300 hover:text-white hover:border-neutral-600"
                >
                  <ArrowLeft className="w-3 h-3" />Cancel
                </button>
              </div>

              <p className="text-xs text-neutral-400 leading-relaxed mb-5">
                Choose a new password for your account. You'll be logged in automatically after resetting.
              </p>

              <form onSubmit={handleResetPassword} className="space-y-4">
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
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block ml-1">New Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500"><Lock className="w-4 h-4" /></span>
                    <input
                      type={showNewPassword ? 'text' : 'password'} placeholder="Min. 6 characters" value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/20 text-sm py-2.5 pl-10 pr-10 rounded-xl text-neutral-100 placeholder-neutral-600 transition"
                      minLength={6} autoFocus required
                    />
                    <button type="button" onClick={() => { setShowNewPassword(!showNewPassword); synths.playTick(); }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300 transition">
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block ml-1">Confirm New Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500"><KeyRound className="w-4 h-4" /></span>
                    <input
                      type={showNewPasswordConfirm ? 'text' : 'password'} placeholder="Repeat new password" value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/20 text-sm py-2.5 pl-10 pr-10 rounded-xl text-neutral-100 placeholder-neutral-600 transition"
                      minLength={6} required
                    />
                    <button type="button" onClick={() => { setShowNewPasswordConfirm(!showNewPasswordConfirm); synths.playTick(); }}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-500 hover:text-neutral-300 transition">
                      {showNewPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPassword && newPasswordConfirm && newPassword !== newPasswordConfirm && (
                    <p className="text-rose-500 text-[10px] font-medium mt-1 pl-1">Passwords do not match.</p>
                  )}
                </div>

                <button
                  type="submit" disabled={isLoading}
                  className="w-full mt-2 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-lg shadow-indigo-600/10 transition flex items-center justify-center gap-2 cursor-pointer text-sm font-mono uppercase tracking-widest leading-none"
                >
                  {isLoading ? (
                    <span className="animate-pulse">Updating…</span>
                  ) : (
                    <><RotateCcw className="w-4 h-4" />Reset Password<ChevronRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              <div className="mt-4 text-center flex items-center justify-center gap-1.5 text-[10px] font-mono text-neutral-500">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span>Secured with bcrypt.</span>
              </div>
            </>
          )}

          {/* ── Login / Signup ───────────────────────────────────────── */}
          {(authMode === 'login' || authMode === 'signup') && (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold font-mono uppercase tracking-wider text-neutral-100">
                  {isSignUp ? 'Create Profile' : 'Member Portal'}
                </h2>
                <div className="flex items-center gap-2">
                  {onPlayDemo && (
                    <button
                      type="button"
                      onClick={() => { synths.playTick(); onPlayDemo(); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 cursor-pointer bg-neutral-800/60 border-neutral-700/50 text-neutral-300 hover:text-white hover:border-neutral-600"
                    >
                      <span className="text-[10px] leading-none">▶</span>Play Demo
                    </button>
                  )}
                  <button
                    onClick={() => isSignUp ? switchToLogin() : switchToSignup()}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all duration-200 cursor-pointer ${
                      isSignUp
                        ? 'bg-neutral-800/60 border-neutral-700/50 text-neutral-300 hover:text-white hover:border-neutral-600'
                        : 'bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20 hover:border-rose-500/50 hover:text-rose-300 shadow-sm shadow-rose-500/10'
                    }`}
                  >
                    {isSignUp ? (
                      <><LogIn className="w-3 h-3" />Sign In</>
                    ) : (
                      <><UserPlus className="w-3 h-3" />Sign Up</>
                    )}
                  </button>
                </div>
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
                  {isSignUp && usernameTaken && (
                    <p className="text-rose-500 text-[10px] font-medium mt-1 pl-1">Username already in use.</p>
                  )}
                  {isSignUp && hasVulgarLanguage(username) && (
                    <p className="text-rose-500 text-[10px] font-medium mt-1 pl-1">Explicit or vulgar language is prohibited.</p>
                  )}
                </div>

                {isSignUp && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block ml-1">Email</label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-neutral-500"><Mail className="w-4 h-4" /></span>
                      <input
                        type="email" placeholder="you@example.com" value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 focus:border-indigo-500/70 focus:ring-1 focus:ring-indigo-500/20 text-sm py-2.5 pl-10 pr-4 rounded-xl text-neutral-100 placeholder-neutral-600 transition"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between ml-1 mr-0.5">
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400">Password</label>
                    {!isSignUp && (
                      <button
                        type="button"
                        onClick={switchToForgot}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 font-mono transition cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
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

                    <div className="pt-2 border-t border-neutral-800/40">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block ml-1 mb-2 text-left">Your Device</span>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { value: 'computer', label: 'Computer', Icon: Monitor,    recommended: true  },
                          { value: 'tablet',   label: 'Tablet',   Icon: Tablet,     recommended: false },
                          { value: 'phone',    label: 'Phone',    Icon: Smartphone, recommended: false },
                        ] as const).map(({ value, label, Icon, recommended }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => { setSelectedDevice(value); synths.playTick(); }}
                            className={`relative flex flex-col items-center gap-1.5 py-3 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                              selectedDevice === value
                                ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300'
                                : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                            }`}
                          >
                            {recommended && (
                              <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                Recommended
                              </span>
                            )}
                            <Icon className="w-5 h-5" />
                            {label}
                          </button>
                        ))}
                      </div>
                      {isSignUp && !selectedDevice && (
                        <p className="text-rose-500 text-[10px] font-medium mt-1 pl-1">Please select your device type.</p>
                      )}
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
                    <><LogIn className="w-4 h-4" />Log In<ChevronRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              {!isSignUp && (
                <p className="mt-4 text-center text-[11px] text-neutral-500">
                  New user?{' '}
                  <button
                    type="button"
                    onClick={switchToSignup}
                    className="text-indigo-400 hover:text-indigo-300 underline underline-offset-2 cursor-pointer transition"
                  >
                    Create an account!
                  </button>
                </p>
              )}

              <div className="mt-4 text-center flex items-center justify-center gap-1.5 text-[10px] font-mono text-neutral-500">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span>Accounts secured server-side with bcrypt.</span>
              </div>
            </>
          )}
        </div>

        <div
          className="bg-neutral-900/80 border border-neutral-800/80 rounded-3xl p-6 md:p-8 backdrop-blur-md space-y-5 transition-all duration-500"
          style={{ boxShadow: `0 25px 60px -12px rgba(0,0,0,0.8), 0 0 50px -10px ${GAME_FEATURES[activeTabIdx].glowColor}` }}
        >
          {/* Tabs — centered */}
          <div className="flex gap-2 flex-wrap justify-center">
            {GAME_FEATURES.map((feature, idx) => (
              <button
                key={feature.id}
                onClick={() => { setActiveTabIdx(idx); setIsAutoPlay(false); synths.playTick(); }}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all duration-200 cursor-pointer ${
                  activeTabIdx === idx
                    ? `${feature.accentColor} scale-105 shadow-lg`
                    : 'bg-neutral-800/50 border-neutral-700/50 text-neutral-400 hover:text-neutral-200 hover:border-neutral-600'
                }`}
              >
                {feature.icon === 'improve' && <TrendingUp className="w-3 h-3" />}
                {feature.icon === 'compare' && <BarChart2 className="w-3 h-3" />}
                {feature.icon === 'race' && <Users className="w-3 h-3" />}
                {feature.icon === 'create' && <Hammer className="w-3 h-3" />}
                <span className="text-[10px] font-mono uppercase tracking-wider">{feature.badge}</span>
              </button>
            ))}
          </div>

          {/* Feature card */}
          {GAME_FEATURES.map((feature, idx) => (
            activeTabIdx === idx && (
              <div key={feature.id} className={`relative overflow-hidden bg-gradient-to-br ${feature.color} border rounded-2xl p-5 space-y-3 animate-in fade-in zoom-in-95 duration-200`}>
                {/* Decorative glow orb */}
                <div className={`absolute -top-8 -right-8 w-36 h-36 ${feature.decorBg} rounded-full blur-3xl pointer-events-none`} />
                <div className={`absolute -bottom-6 -left-6 w-24 h-24 ${feature.decorBg} rounded-full blur-2xl pointer-events-none opacity-60`} />

                <div className={`relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border ${feature.accentColor}`}>
                  {feature.icon === 'improve' && <TrendingUp className="w-3 h-3" />}
                  {feature.icon === 'compare' && <BarChart2 className="w-3 h-3" />}
                  {feature.icon === 'race' && <Users className="w-3 h-3" />}
                  {feature.icon === 'create' && <Hammer className="w-3 h-3" />}
                  {feature.badge}
                </div>
                <h4 className="relative text-base font-black text-neutral-100 tracking-tight">{feature.title}</h4>
                <p className="relative text-xs text-neutral-400 leading-relaxed">{feature.shortDesc}</p>

                {/* Progress dots */}
                <div className="relative flex gap-1.5 pt-1 items-center">
                  {GAME_FEATURES.map((f, i) => (
                    <div
                      key={i}
                      className={`h-1 rounded-full transition-all duration-300 ${
                        i === idx ? `flex-[3] ${feature.progressColor}` : 'flex-1 bg-neutral-700/50'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    </div>
  );
}
