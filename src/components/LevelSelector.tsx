import React, { useState, useEffect } from 'react';
import { Play, Plus, Trash2, Upload, Award, Compass, Map, Clock, Trophy, Zap, Medal } from 'lucide-react';
import { LevelConfig, SceneTheme, UserAccount } from '../types';
import { DEFAULT_LEVELS } from '../defaultLevels';
import { api } from '../api';
import { formatPercentile, getPlayerRanking } from '../utils/rankings';

interface LevelSelectorProps {
  onSelectLevel: (level: LevelConfig) => void;
  onCreateNewCustom: () => void;
  onEditCustom: (level: LevelConfig) => void;
  currentUser: UserAccount;
}

const LEVEL_ACCENT: Record<string, {
  border: string;
  stripe: string;
  glow: string;
  badge: string;
  wrText: string;
  pbText: string;
  runBtn: string;
  icon: string;
}> = {
  tutorial_skyway: {
    border: 'border-sky-500/30 hover:border-sky-400/60',
    stripe: 'bg-sky-500',
    glow: 'hover:shadow-sky-500/10',
    badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    wrText: 'text-sky-300',
    pbText: 'text-amber-300',
    runBtn: 'bg-sky-600 hover:bg-sky-500 shadow-sky-600/20',
    icon: 'text-sky-500',
  },
  neon_velocity: {
    border: 'border-violet-500/30 hover:border-violet-400/60',
    stripe: 'bg-violet-500',
    glow: 'hover:shadow-violet-500/10',
    badge: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    wrText: 'text-violet-300',
    pbText: 'text-amber-300',
    runBtn: 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/20',
    icon: 'text-violet-500',
  },
  rust_ascent: {
    border: 'border-amber-500/30 hover:border-amber-400/60',
    stripe: 'bg-amber-500',
    glow: 'hover:shadow-amber-500/10',
    badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    wrText: 'text-amber-300',
    pbText: 'text-amber-300',
    runBtn: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20',
    icon: 'text-amber-500',
  },
  sunset_ridge: {
    border: 'border-rose-500/30 hover:border-rose-400/60',
    stripe: 'bg-rose-500',
    glow: 'hover:shadow-rose-500/10',
    badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    wrText: 'text-rose-300',
    pbText: 'text-amber-300',
    runBtn: 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20',
    icon: 'text-rose-500',
  },
  monochrome_void: {
    border: 'border-emerald-500/30 hover:border-emerald-400/60',
    stripe: 'bg-emerald-500',
    glow: 'hover:shadow-emerald-500/10',
    badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    wrText: 'text-emerald-300',
    pbText: 'text-amber-300',
    runBtn: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20',
    icon: 'text-emerald-500',
  },
  lava_patchwork: {
    border: 'border-orange-500/30 hover:border-orange-400/60',
    stripe: 'bg-gradient-to-r from-orange-500 to-red-500',
    glow: 'hover:shadow-orange-500/10',
    badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    wrText: 'text-orange-300',
    pbText: 'text-amber-300',
    runBtn: 'bg-orange-600 hover:bg-orange-500 shadow-orange-600/20',
    icon: 'text-orange-500',
  },
};

const DEFAULT_ACCENT = {
  border: 'border-indigo-500/30 hover:border-indigo-400/60',
  stripe: 'bg-indigo-500',
  glow: 'hover:shadow-indigo-500/10',
  badge: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  wrText: 'text-indigo-300',
  pbText: 'text-amber-300',
  runBtn: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20',
  icon: 'text-indigo-500',
};

const formatTime = (seconds: number): string => {
  const totalMs = Math.round(seconds * 1000);
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${m > 0 ? `${m}:` : ''}${s.toString().padStart(m > 0 ? 2 : 1, '0')}.${ms.toString().padStart(3, '0')}`;
};

const formatTheme = (theme: SceneTheme) => {
  switch (theme) {
    case 'sky_islands': return 'Sky Islands';
    case 'neon_grid': return 'Neon Grid';
    case 'industrial_rust': return 'Industrial';
    case 'mountain_sunset': return 'Sunset';
    case 'abstract_white': default: return 'Abstract';
  }
};

export default function LevelSelector({ onSelectLevel, onCreateNewCustom, onEditCustom, currentUser }: LevelSelectorProps) {
  const [customLevels, setCustomLevels] = useState<LevelConfig[]>([]);
  const [courseStats, setCourseStats] = useState<Record<string, {
    worldRecord: string | null;
    percentile: number | null;
  }>>({});

  useEffect(() => {
    const list = localStorage.getItem('custom_parkour_levels');
    if (list) {
      try { setCustomLevels(JSON.parse(list)); } catch {}
    }
  }, []);

  useEffect(() => {
    Promise.all(
      DEFAULT_LEVELS.map(async (lvl) => {
        try {
          const entries = await api.leaderboard.get(lvl.id);
          // Include a newly completed local PB while it is still waiting to sync.
          const localPb = localStorage.getItem(`best_time_${lvl.id}`);
          const localPbSeconds = localPb ? parseFloat(localPb) : NaN;
          const ranking = getPlayerRanking(
            entries,
            currentUser.username,
            Number.isFinite(localPbSeconds) ? localPbSeconds : null
          );
          const validTimes = entries
            .map(entry => entry.time)
            .filter(time => Number.isFinite(time) && time > 0.05);

          return [lvl.id, {
            worldRecord: validTimes.length > 0 ? formatTime(Math.min(...validTimes)) : null,
            percentile: ranking?.percentile ?? null
          }] as const;
        } catch {
          return [lvl.id, { worldRecord: null, percentile: null }] as const;
        }
      })
    ).then(pairs => {
      const map: Record<string, { worldRecord: string | null; percentile: number | null }> = {};
      pairs.forEach(([id, stats]) => { map[id] = stats; });
      setCourseStats(map);
    });
  }, [currentUser.username]);

  const deleteCustomLevel = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Delete this custom level? This cannot be undone.')) {
      const updated = customLevels.filter(lvl => lvl.id !== id);
      setCustomLevels(updated);
      localStorage.setItem('custom_parkour_levels', JSON.stringify(updated));
    }
  };

  const exportLevelJSON = (lvl: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(lvl, null, 2));
    alert(`Copied "${lvl.name}" level code to clipboard!`);
  };

  const getPB = (id: string): string | null => {
    const score = localStorage.getItem(`best_time_${id}`);
    if (!score) return null;
    const parsed = parseFloat(score);
    if (parsed <= 0.05) { localStorage.removeItem(`best_time_${id}`); return null; }
    return formatTime(parsed);
  };

  return (
    <div className="relative min-h-full overflow-hidden bg-[#0b1020] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(79,70,229,0.24),transparent_34%),radial-gradient(circle_at_88%_18%,rgba(14,165,233,0.13),transparent_30%)]" />
      <div className="relative max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-black text-neutral-50 tracking-tight flex items-center gap-2.5 font-sans">
            <Zap className="w-7 h-7 text-indigo-400" />
            Rush!
          </h1>
          <p className="text-xs text-neutral-500 mt-1 font-mono uppercase tracking-widest">
            Handcrafted time trials — beat the world record
          </p>
        </div>
        <button
          onClick={onCreateNewCustom}
          className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-600 text-neutral-200 rounded-xl font-semibold text-xs transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Course Builder
        </button>
      </div>

      {/* Default levels grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {DEFAULT_LEVELS.map(level => {
          const pb = getPB(level.id);
          const stats = courseStats[level.id];
          const wr = stats?.worldRecord;
          const accent = LEVEL_ACCENT[level.id] ?? DEFAULT_ACCENT;

          return (
            <div
              key={level.id}
              onClick={() => onSelectLevel(level)}
              className={`group relative rounded-2xl border bg-neutral-900 overflow-hidden cursor-pointer transition-all duration-200 shadow-lg ${accent.border} ${accent.glow} hover:shadow-xl hover:-translate-y-0.5`}
            >
              {/* Colored accent stripe across top */}
              <div className={`h-0.5 w-full ${accent.stripe}`} />

              <div className="p-5">
                {/* Title row */}
                <div className="flex items-start justify-between mb-5">
                  <h3 className="text-base font-black text-neutral-100 leading-tight tracking-tight pr-2">
                    {level.name}
                  </h3>
                  <span className={`shrink-0 text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${accent.badge}`}>
                    {formatTheme(level.theme)}
                  </span>
                </div>

                {/* WR + PB — the main focus */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {/* World Record */}
                  <div className="bg-neutral-800/60 rounded-xl p-3 border border-neutral-700/40">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Trophy className={`w-3 h-3 ${accent.icon}`} />
                      <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-neutral-500">World Record</span>
                    </div>
                    {stats === undefined ? (
                      <span className="text-sm font-mono font-bold text-neutral-600 animate-pulse">···</span>
                    ) : wr ? (
                      <span className={`text-lg font-black font-mono ${accent.wrText} leading-none`}>{wr}</span>
                    ) : (
                      <span className="text-sm font-mono font-bold text-neutral-600">—</span>
                    )}
                  </div>

                  {/* Personal Best */}
                  <div className="bg-neutral-800/60 rounded-xl p-3 border border-neutral-700/40">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Award className="w-3 h-3 text-amber-500" />
                      <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-neutral-500">Personal Best</span>
                    </div>
                    {pb ? (
                      <span className={`text-lg font-black font-mono ${accent.pbText} leading-none`}>{pb}</span>
                    ) : (
                      <span className="text-sm font-mono font-bold text-neutral-600">—</span>
                    )}
                  </div>
                </div>

                {/* Community standing */}
                <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2.5 mb-5">
                  <div className="flex items-center gap-1.5">
                    <Medal className="w-3.5 h-3.5 text-indigo-300" />
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-indigo-200/70">Your Standing</span>
                  </div>
                  {stats === undefined ? (
                    <span className="text-xs font-mono font-bold text-indigo-300/50 animate-pulse">···</span>
                  ) : stats.percentile !== null ? (
                    <span className="text-sm font-black font-mono text-indigo-200">Top {formatPercentile(stats.percentile)}%</span>
                  ) : (
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-200/50">Not ranked</span>
                  )}
                </div>

                {/* Run button */}
                <button className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-xs font-bold font-mono uppercase tracking-widest transition-all duration-200 shadow-md ${accent.runBtn} cursor-pointer`}>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Run Course
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom levels */}
      {customLevels.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4 border-b border-neutral-800 pb-3">
            <Map className="w-4 h-4 text-neutral-500" />
            <h2 className="text-sm font-bold font-mono uppercase tracking-widest text-neutral-400">Your Custom Courses</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customLevels.map(level => {
              const pb = getPB(level.id);
              return (
                <div
                  key={level.id}
                  onClick={() => onSelectLevel(level)}
                  className="group relative rounded-2xl border border-neutral-700/50 hover:border-indigo-500/40 bg-neutral-900 overflow-hidden cursor-pointer transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                  <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 to-violet-500" />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-4">
                      <h3 className="text-sm font-black text-neutral-100 leading-tight pr-2">{level.name}</h3>
                      <span className="shrink-0 text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border bg-indigo-500/10 text-indigo-400 border-indigo-500/20">
                        Custom
                      </span>
                    </div>

                    <div className="bg-neutral-800/60 rounded-xl p-3 border border-neutral-700/40 mb-4">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Award className="w-3 h-3 text-amber-500" />
                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-neutral-500">Personal Best</span>
                      </div>
                      {pb ? (
                        <span className="text-lg font-black font-mono text-amber-300 leading-none">{pb}</span>
                      ) : (
                        <span className="text-sm font-mono font-bold text-neutral-600">—</span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); onEditCustom(level); }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-300 text-xs font-bold font-mono uppercase tracking-wider transition cursor-pointer"
                      >
                        Edit
                      </button>
                      <button
                        onClick={(e) => exportLevelJSON(level, e)}
                        className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-400 hover:text-neutral-200 transition cursor-pointer"
                        title="Copy JSON"
                      >
                        <Upload className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => deleteCustomLevel(level.id, e)}
                        className="px-3 py-2 rounded-xl bg-neutral-800 hover:bg-rose-900/40 border border-neutral-700 hover:border-rose-700/50 text-neutral-400 hover:text-rose-400 transition cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
