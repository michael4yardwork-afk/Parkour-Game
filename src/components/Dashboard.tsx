import React, { useState } from 'react';
import { Code, Settings, Trophy, ArrowRight, ShieldCheck, Gamepad2, Info, LogOut, User, KeyRound, Sparkles, Check, Lock, ShieldAlert } from 'lucide-react';
import { GameSettings, UserAccount } from '../types';
import { DEFAULT_LEVELS } from '../defaultLevels';
import { synths } from '../audio';

interface DashboardProps {
  settings: GameSettings;
  onChangeSettings: (settings: GameSettings) => void;
  onNavigate: (tab: 'levels' | 'editor') => void;
  currentUser: UserAccount;
  onLogout: () => void;
  onUpdateCurrentUser: (updatedUser: UserAccount) => void;
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
];

const AVATAR_BGS = [
  { class: 'bg-rose-500/20 border-rose-500/40 text-rose-300', value: 'bg-rose-500', label: 'Crimson' },
  { class: 'bg-green-500/20 border-green-500/40 text-green-300', value: 'bg-green-500', label: 'Volt' },
  { class: 'bg-purple-500/20 border-purple-500/40 text-purple-300', value: 'bg-purple-500', label: 'Neon' },
  { class: 'bg-blue-500/20 border-blue-500/40 text-blue-300', value: 'bg-blue-500', label: 'Cyber' },
  { class: 'bg-amber-500/20 border-amber-500/40 text-amber-300', value: 'bg-amber-500', label: 'Solar' },
  { class: 'bg-indigo-505/20 border-indigo-505/40 text-indigo-300', value: 'bg-indigo-505', label: 'Slate' },
];

const getPercentileForLevel = (levelId: string, time: number | null, username: string) => {
  if (time === null || time <= 0.05) return null;
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
    const totalLen = otherPlayerTimes.length;
    
    if (totalLen <= 1) return 100;
    return Math.round((1 - (rankIdx / (totalLen - 1))) * 100);
  } catch (e) {
    return 100;
  }
};

export default function Dashboard({ settings, onChangeSettings, onNavigate, currentUser, onLogout, onUpdateCurrentUser }: DashboardProps) {
  // Security Panel State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

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

    // Save update
    const updatedUser: UserAccount = {
      ...currentUser,
      passwordHash: btoa(newPassword)
    };
    onUpdateCurrentUser(updatedUser);
    setPasswordFeedback({ type: 'success', message: 'Security password changed successfully!' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    synths.playFinish();
  };

  const selectAvatar = (emoji: string) => {
    synths.playTick();
    onUpdateCurrentUser({
      ...currentUser,
      avatar: emoji
    });
  };

  const selectBg = (bgValue: string) => {
    synths.playTick();
    onUpdateCurrentUser({
      ...currentUser,
      avatarBg: bgValue
    });
  };

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
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full font-mono uppercase tracking-wider">Aesthetic Tracker</span>
            </div>
            <p className="text-xs text-neutral-500 mt-0.5 font-mono">
              Registrant Since: {currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString() : 'Active Session'}
            </p>
          </div>
        </div>

        {/* Quick profile stats */}
        <div className="flex flex-wrap gap-4 text-xs font-mono">
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
      <div className="relative rounded-3xl overflow-hidden bg-neutral-900 text-white p-8 md:p-12 shadow-2xl flex flex-col justify-between min-h-[340px] border border-neutral-800">
        {/* Sky glow effect */}
        <div className="absolute inset-x-0 bottom-0 top-1/2 bg-gradient-to-t from-indigo-500/10 via-transparent to-transparent pointer-events-none" />

        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 rounded-full text-[10px] font-mono uppercase font-bold tracking-wider mb-5">
            <Gamepad2 className="w-3.5 h-3.5" />
            V0.4 Community Release
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
            Momentum Parkour
          </h1>
          <p className="text-sm text-neutral-300 mt-4 leading-relaxed max-w-lg">
            A high-skill 3D parkour time-trial racer focused on flow, momentum preservation, and precision routing. Sprint, slide, leap off wall-run rails, and shave precious milliseconds off your runs as <span className="text-indigo-400 font-bold">{currentUser.username}</span>.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 mt-8 pt-6 border-t border-neutral-800/60">
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
                    <span className="uppercase tracking-wider">Standing:</span>
                    {(() => {
                      const pct = getPercentileForLevel(lvl.id, time, currentUser?.username || 'Guest');
                      if (pct === null) return <span className="font-bold text-neutral-400">N/A</span>;
                      return (
                        <span className="font-bold font-sans text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">
                          Top {pct}%
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mechanics Grid & Config Customizations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Movement Mechanics Overview (7 columns width) */}
        <div className="lg:col-span-7 space-y-6">
          <h2 className="text-xl font-bold text-neutral-900 tracking-tight flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Info className="w-5 h-5 text-indigo-500" />
            The Movement Lexicon
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mechanic 1: Slide Boost */}
            <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200/60 leading-relaxed shadow-sm">
              <span className="inline-block p-2 bg-indigo-50 text-indigo-600 rounded-xl font-mono text-[10px] font-bold uppercase mb-3">
                L-SHIFT / C Key
              </span>
              <h3 className="font-bold text-sm text-neutral-800">Slide Dash &amp; Slip</h3>
              <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                Sliding mid-stride reduces player height by 50% allowing you to pass through narrow utility gaps. If moving with high momentum, sliding triggers an acceleration surge!
              </p>
            </div>

            {/* Mechanic 2: Wallrunning */}
            <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200/60 leading-relaxed shadow-sm">
              <span className="inline-block p-2 bg-purple-50 text-purple-600 rounded-xl font-mono text-[10px] font-bold uppercase mb-3">
                Forward near wall
              </span>
              <h3 className="font-bold text-sm text-neutral-800">Vertical Wall Run</h3>
              <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                Sprint forward along the side of flat purple panels to stick to the surface. Vertical gravity decreases by 70%, letting you run high above lava hazards!
              </p>
            </div>

            {/* Mechanic 3: Wall Jumping */}
            <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200/60 leading-relaxed shadow-sm">
              <span className="inline-block p-2 bg-amber-50 text-amber-600 rounded-xl font-mono text-[10px] font-bold uppercase mb-3">
                Space during wall-run
              </span>
              <h3 className="font-bold text-sm text-neutral-800">Wall Kickback</h3>
              <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                Jumping while wall-running kicks you off the wall with a direct horizontal boost, pushing you to opposite walls or platforms for quick zig-zag leaps!
              </p>
            </div>

            {/* Mechanic 4: Jump Pads */}
            <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-200/60 leading-relaxed shadow-sm">
              <span className="inline-block p-2 bg-emerald-50 text-emerald-600 rounded-xl font-mono text-[10px] font-bold uppercase mb-3">
                Touch launch surface
              </span>
              <h3 className="font-bold text-sm text-neutral-800">Thermal Jump Pads</h3>
              <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
                Golden orange platforms launch you 20 meters vertical into the sky, preserving forward velocity! Perfect for executing massive shortcuts high above.
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Character Glyph & Customization (5 columns width) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-neutral-50 p-6 rounded-3xl border border-neutral-200/80 space-y-6 shadow-sm">
            <div>
              <h2 className="text-base font-bold text-neutral-900 uppercase tracking-wider font-mono border-b border-neutral-200 pb-3 mb-5 flex items-center gap-2">
                <User className="w-4 h-4 text-neutral-600" />
                Runner Customization
              </h2>
              
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block mb-2 text-left">
                    Signature Emoji Glyph
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {AVATARS.map(avatar => (
                      <button
                        key={avatar.emoji}
                        onClick={() => selectAvatar(avatar.emoji)}
                        className={`py-2 rounded-xl text-lg flex items-center justify-center border transition ${
                          currentUser.avatar === avatar.emoji
                            ? 'bg-indigo-600/10 border-indigo-600 text-indigo-700 font-bold'
                            : 'bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300'
                        }`}
                        title={avatar.name}
                      >
                        {avatar.emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block mb-2 text-left">
                    Icon Theme Signature
                  </span>
                  <div className="flex flex-wrap gap-2.5">
                    {AVATAR_BGS.map(bg => (
                      <button
                        key={bg.value}
                        onClick={() => selectBg(bg.value)}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition focus:outline-none ${
                          bg.value === (currentUser.avatarBg || 'bg-rose-500')
                            ? 'border-indigo-600 shadow-sm scale-105'
                            : 'border-transparent'
                        } ${bg.value}`}
                        title={bg.label}
                      >
                        {bg.value === (currentUser.avatarBg || 'bg-rose-500') && (
                          <Check className="w-3.5 h-3.5 stroke-[3] text-white" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Standard FOV settings and options */}
            <div className="pt-4 border-t border-neutral-200/60">
              <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
                <Settings className="w-3.5 h-3.5 text-neutral-500" />
                CALIBRATION
              </h2>

              <div className="space-y-4">
                {/* FOV */}
                <div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-neutral-500 block">Field of View (FOV)</span>
                    <span className="font-semibold text-neutral-800">{settings.fov}°</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="110"
                    step="5"
                    value={settings.fov}
                    onChange={(e) => handleFovChange(parseInt(e.target.value))}
                    className="w-full mt-2 accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Toggle Ghost */}
                <div className="flex items-center justify-between py-2 border-t border-neutral-200/50">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-neutral-800">Ghost Racer Replay</span>
                    <span className="text-[10px] text-neutral-400 mt-0.5">Render PB run as competitor</span>
                  </div>
                  <button
                    onClick={() => onChangeSettings({ ...settings, showGhost: !settings.showGhost })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.showGhost ? 'bg-indigo-600' : 'bg-neutral-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        settings.showGhost ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Password Management Option (Security Amenity) */}
            <div className="pt-4 border-t border-neutral-200/60 leading-relaxed">
              <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider font-mono mb-3.5 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 text-neutral-500" />
                PASSWORD &amp; SECURITY
              </h2>

              <form onSubmit={handleUpdatePassword} className="space-y-3">
                {passwordFeedback && (
                  <div className={`p-2.5 text-[10px] rounded-lg border leading-snug font-mono ${
                    passwordFeedback.type === 'error'
                      ? 'bg-rose-50/50 border-rose-200 text-rose-600'
                      : 'bg-green-50/50 border-green-200 text-green-600'
                  }`}>
                    {passwordFeedback.message}
                  </div>
                )}

                <div className="grid grid-cols-1 gap-2 text-xs">
                  <input
                    type="password"
                    placeholder="Current Password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-white border border-neutral-250 py-1.5 px-3 rounded-lg text-neutral-800"
                    required
                  />
                  <input
                    type="password"
                    placeholder="New Password (Min. 6)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-white border border-neutral-250 py-1.5 px-3 rounded-lg text-neutral-800"
                    required
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full bg-white border border-neutral-250 py-1.5 px-3 rounded-lg text-neutral-800"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-[10px] font-mono uppercase tracking-widest rounded-lg transition"
                >
                  Confirm Password Change
                </button>
              </form>
            </div>

            <div className="pt-4 border-t border-neutral-250 text-[10px] text-neutral-400 font-mono flex items-center justify-between gap-2">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Telemetry Authenticated
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-500 fill-current opacity-80" />
            </div>
          </div>
        </div>

      </div>

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-neutral-200/90 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative space-y-4 animate-in fade-in duration-200 text-center">
            <div className="h-12 w-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mx-auto">
              <LogOut className="w-5 h-5" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-neutral-900 tracking-tight">Sign Out of Momentum?</h3>
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

    </div>
  );
}
