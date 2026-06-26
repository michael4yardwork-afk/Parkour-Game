import React, { useState } from 'react';
import { Code, Settings, Trophy, ArrowRight, ShieldCheck, Info, LogOut, User, KeyRound, Sparkles, Check, Lock, ShieldAlert } from 'lucide-react';
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
    
    if (totalLen === 0) return 0;
    return Math.round((rankIdx / totalLen) * 100);
  } catch (e) {
    return 0;
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
            <span className="text-sm font-black text-indigo-400 font-sans leading-none">Δ</span>
            V0.4 Community Release
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-none">
            Delta Rush
          </h1>
          <p className="text-sm text-neutral-300 mt-4 leading-relaxed max-w-lg">
            A high-skill 3D parkour time-trial racer focused on flow, momentum preservation, and precision routing. Sprint, wall-run, leap off rails, and shave precious milliseconds off your runs as <span className="text-indigo-400 font-bold">{currentUser.username}</span>.
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

    </div>
  );
}
