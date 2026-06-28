import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, User, Settings, Lock, Sparkles, ShieldCheck, Check, Volume2 } from 'lucide-react';
import { GameSettings, UserAccount } from '../types';
import { synths } from '../audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GameSettings;
  onChangeSettings: (settings: GameSettings) => void;
  currentUser: UserAccount;
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

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onChangeSettings,
  currentUser,
  onUpdateCurrentUser,
}: SettingsModalProps) {
  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'error' | 'success'; message: string } | null>(null);

  const selectAvatar = (emoji: string) => {
    synths.playTick();
    onUpdateCurrentUser({
      ...currentUser,
      avatar: emoji,
    });
  };

  const selectBg = (bgValue: string) => {
    synths.playTick();
    onUpdateCurrentUser({
      ...currentUser,
      avatarBg: bgValue,
    });
  };

  const handleFovChange = (val: number) => {
    onChangeSettings({
      ...settings,
      fov: val,
    });
  };

  const handleVolumeChange = (val: number) => {
    onChangeSettings({
      ...settings,
      sfxVolume: val,
    });
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordFeedback(null);

    if (btoa(currentPassword) !== currentUser.passwordHash) {
      setPasswordFeedback({ type: 'error', message: 'Current password provided is incorrect.' });
      return;
    }

    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', message: 'New password must be at least 6 characters.' });
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setPasswordFeedback({ type: 'error', message: 'New passwords do not match.' });
      return;
    }

    onUpdateCurrentUser({
      ...currentUser,
      passwordHash: btoa(newPassword),
    });

    setPasswordFeedback({ type: 'success', message: 'Security password changed successfully!' });
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          {/* Backdrop blur & overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-neutral-950/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="bg-white border border-neutral-200/90 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl relative z-10 space-y-6"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600 animate-spin-slow" />
                <h2 className="text-lg font-bold text-neutral-900 tracking-tight">System Settings &amp; Customization</h2>
              </div>
              <button
                onClick={() => {
                  synths.playTick();
                  onClose();
                }}
                className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Avatar / BG Customization */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-neutral-950 uppercase tracking-wider font-mono flex items-center gap-2">
                <User className="w-4 h-4 text-neutral-600" />
                Runner Customization
              </h3>

              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/50 space-y-4">
                <div>
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block mb-2 text-left">
                    Signature Emoji Glyph
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {AVATARS.map((avatar) => (
                      <button
                        key={avatar.emoji}
                        onClick={() => selectAvatar(avatar.emoji)}
                        className={`py-2 rounded-xl text-lg flex items-center justify-center border transition cursor-pointer ${
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
                    {AVATAR_BGS.map((bg) => (
                      <button
                        key={bg.value}
                        onClick={() => selectBg(bg.value)}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition focus:outline-none cursor-pointer ${
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

            {/* Volume Control */}
            <div className="space-y-4 pt-2 border-t border-neutral-100">
              <h3 className="text-xs font-bold text-neutral-950 uppercase tracking-wider font-mono flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-neutral-600" />
                Master Audio Volume
              </h3>
              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/50 flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-neutral-400" />
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={settings.sfxVolume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                  title="Master volume"
                />
                <span className="text-xs font-mono font-bold text-neutral-600 w-8 text-right">
                  {Math.round(settings.sfxVolume * 100)}%
                </span>
              </div>
            </div>

            {/* Calibration settings (FOV, Ghost) */}
            <div className="space-y-4 pt-2 border-t border-neutral-100">
              <h3 className="text-xs font-bold text-neutral-950 uppercase tracking-wider font-mono flex items-center gap-2">
                <Settings className="w-4 h-4 text-neutral-600" />
                Calibration &amp; Optics
              </h3>

              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/50 space-y-4">
                {/* FOV */}
                <div>
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-neutral-500 block">Field of View (FOV)</span>
                    <span className="font-semibold text-neutral-800">{settings.fov}°</span>
                  </div>
                  <input
                    type="range"
                    min="60"
                    max="140"
                    step="5"
                    value={settings.fov}
                    onChange={(e) => handleFovChange(parseInt(e.target.value))}
                    className="w-full mt-2 accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* Toggle Ghost */}
                <div className="flex items-center justify-between py-2 border-t border-neutral-200/30">
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

                {/* Toggle Adjustable Perspective */}
                <div className="flex items-center justify-between py-2 border-t border-neutral-200/30">
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-neutral-800">Adjustable Perspective</span>
                    <span className="text-[10px] text-neutral-400 mt-0.5">Allow dragging or look-controls to adjust camera view</span>
                  </div>
                  <button
                    onClick={() => onChangeSettings({ ...settings, adjustablePerspective: !settings.adjustablePerspective })}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      settings.adjustablePerspective ? 'bg-indigo-600' : 'bg-neutral-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        settings.adjustablePerspective ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Password/Security */}
            <div className="space-y-4 pt-2 border-t border-neutral-100">
              <h3 className="text-xs font-bold text-neutral-950 uppercase tracking-wider font-mono flex items-center gap-2">
                <Lock className="w-4 h-4 text-neutral-600" />
                Password &amp; Security
              </h3>

              <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-200/50">
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
                    className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white font-semibold text-[10px] font-mono uppercase tracking-widest rounded-lg transition cursor-pointer"
                  >
                    Confirm Password Change
                  </button>
                </form>
              </div>
            </div>

            {/* Footer telemetry indicator */}
            <div className="pt-4 border-t border-neutral-150 text-[10px] text-neutral-400 font-mono flex items-center justify-between gap-2">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                Telemetry Authenticated
              </span>
              <ShieldCheck className="w-4 h-4 text-emerald-500 fill-current opacity-80" />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
