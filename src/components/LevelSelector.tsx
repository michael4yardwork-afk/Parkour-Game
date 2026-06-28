import React, { useState, useEffect } from 'react';
import { Play, Plus, Trash2, Code, Upload, Download, Award, Compass, Sparkles, Map } from 'lucide-react';
import { LevelConfig, SceneTheme } from '../types';
import { DEFAULT_LEVELS } from '../defaultLevels';

interface LevelSelectorProps {
  onSelectLevel: (level: LevelConfig) => void;
  onCreateNewCustom: () => void;
  onEditCustom: (level: LevelConfig) => void;
}

const getLevelTheme = (id: string) => {
  switch (id) {
    case 'tutorial_skyway':
      return {
        card: 'bg-[#ecf5fc] border-sky-200 hover:bg-[#e2eff9] hover:border-sky-300',
        badge: 'bg-sky-100 text-sky-800 group-hover:bg-sky-200 group-hover:text-sky-900',
        title: 'text-sky-950 group-hover:text-sky-800',
        desc: 'text-sky-800/80',
        button: 'bg-sky-900 group-hover:bg-sky-600 text-white'
      };
    case 'neon_velocity':
      return {
        card: 'bg-[#f0effd] border-indigo-200 hover:bg-[#e7e4fc] hover:border-indigo-300',
        badge: 'bg-indigo-100 text-indigo-800 group-hover:bg-indigo-200 group-hover:text-indigo-900',
        title: 'text-indigo-950 group-hover:text-indigo-800',
        desc: 'text-indigo-800/80',
        button: 'bg-indigo-900 group-hover:bg-indigo-600 text-white'
      };
    case 'rust_ascent':
      return {
        card: 'bg-[#fdf6e9] border-amber-200 hover:bg-[#fbf0da] hover:border-amber-300',
        badge: 'bg-amber-100 text-amber-800 group-hover:bg-amber-200 group-hover:text-amber-900',
        title: 'text-amber-950 group-hover:text-amber-800',
        desc: 'text-amber-800/80',
        button: 'bg-amber-900 group-hover:bg-amber-600 text-white'
      };
    case 'sunset_ridge':
      return {
        card: 'bg-[#fdf0f1] border-rose-200 hover:bg-[#fbe3e6] hover:border-rose-300',
        badge: 'bg-rose-100 text-rose-800 group-hover:bg-rose-200 group-hover:text-rose-900',
        title: 'text-rose-950 group-hover:text-rose-800',
        desc: 'text-rose-800/80',
        button: 'bg-rose-900 group-hover:bg-rose-600 text-white'
      };
    case 'monochrome_void':
      return {
        card: 'bg-[#eefcf5] border-emerald-200 hover:bg-[#e0f9ec] hover:border-emerald-300',
        badge: 'bg-emerald-100 text-emerald-800 group-hover:bg-emerald-200 group-hover:text-emerald-900',
        title: 'text-emerald-950 group-hover:text-emerald-800',
        desc: 'text-emerald-800/80',
        button: 'bg-emerald-900 group-hover:bg-emerald-600 text-white'
      };
    case 'lava_patchwork':
      return {
        card: 'bg-[#fdf2f2] border-red-200 hover:bg-[#fee2e2] hover:border-red-300',
        badge: 'bg-red-100 text-red-800 group-hover:bg-red-200 group-hover:text-red-900',
        title: 'text-red-950 group-hover:text-red-800',
        desc: 'text-red-800/80',
        button: 'bg-red-900 group-hover:bg-red-600 text-white'
      };
    default:
      return {
        card: 'bg-[#f9effc] border-purple-200 hover:bg-[#f4defa] hover:border-purple-300',
        badge: 'bg-purple-100 text-purple-800 group-hover:bg-purple-200 group-hover:text-purple-900',
        title: 'text-purple-950 group-hover:text-purple-800',
        desc: 'text-purple-800/80',
        button: 'bg-purple-900 group-hover:bg-purple-600 text-white'
      };
  }
};

export default function LevelSelector({ onSelectLevel, onCreateNewCustom, onEditCustom }: LevelSelectorProps) {
  const [customLevels, setCustomLevels] = useState<LevelConfig[]>([]);

  // Load custom levels from storage
  useEffect(() => {
    const list = localStorage.getItem('custom_parkour_levels');
    if (list) {
      try {
        setCustomLevels(JSON.parse(list));
      } catch (e) {
        console.error('Error loading custom levels', e);
      }
    }
  }, []);

  const deleteCustomLevel = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this custom level? This cannot be undone.')) {
      const updated = customLevels.filter(lvl => lvl.id !== id);
      setCustomLevels(updated);
      localStorage.setItem('custom_parkour_levels', JSON.stringify(updated));
    }
  };



  const exportLevelJSON = (lvl: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    const jsonStr = JSON.stringify(lvl, null, 2);
    navigator.clipboard.writeText(jsonStr);
    alert(`Copied "${lvl.name}" level code to clipboard! You can share this text with other players.`);
  };

  const formatTheme = (theme: SceneTheme) => {
    switch (theme) {
      case 'sky_islands': return 'Sky Islands';
      case 'neon_grid': return 'Neon Vector Grid';
      case 'industrial_rust': return 'Industrial Rust';
      case 'mountain_sunset': return 'Mountain Sunset';
      case 'abstract_white': default: return 'Abstract Geometry';
    }
  };

  // Helper to fetch high-score PB from localstorage
  const getPB = (id: string) => {
    const score = localStorage.getItem(`best_time_${id}`);
    if (score) {
      const parsed = parseFloat(score);
      if (parsed <= 0.05) {
        localStorage.removeItem(`best_time_${id}`);
        return null;
      }
      const totalMilliseconds = Math.round(parsed * 1000);
      const m = Math.floor(totalMilliseconds / 60000);
      const s = Math.floor((totalMilliseconds % 60000) / 1000);
      const ms = totalMilliseconds % 1000;
      return `${m > 0 ? `${m}:` : ''}${s.toString().padStart(m > 0 ? 2 : 1, '0')}.${ms.toString().padStart(3, '0')}s`;
    }
    return null;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Intro section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-extrabold text-neutral-900 tracking-tight flex items-center gap-2.5">
            <Compass className="w-9 h-9 text-indigo-600" />
            Parkour Time Trials
          </h1>
          <p className="text-sm text-neutral-600 mt-2 max-w-xl">
            Shave off milliseconds by mastering movement. Leap, run, wall-run, and discover shortcuts across high-skill courses.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCreateNewCustom}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-xs transition shadow-md hover:shadow duration-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Course Builder
          </button>
        </div>
      </div>

      {/* Handcrafted Campaign List */}
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-6 border-b border-neutral-100 pb-3">
          <Map className="w-5 h-5 text-indigo-500" />
          <h2 className="text-xl font-bold text-neutral-800 tracking-tight">Handcrafted Time Trials</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {DEFAULT_LEVELS.map(level => {
            const pb = getPB(level.id);
            const themeName = formatTheme(level.theme);
            const theme = getLevelTheme(level.id);

            return (
              <div
                key={level.id}
                onClick={() => onSelectLevel(level)}
                className={`group relative rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between min-h-[190px] border ${theme.card}`}
              >
                {/* Accent Tag */}
                <span className={`absolute top-0 right-0 py-1 px-3 text-[10px] font-semibold tracking-wider font-mono uppercase rounded-bl-xl transition duration-300 ${theme.badge}`}>
                  {themeName}
                </span>

                <div>
                  <h3 className={`text-lg font-bold transition duration-200 mr-20 ${theme.title}`}>
                    {level.name}
                  </h3>
                  <p className={`text-xs mt-2 line-clamp-3 leading-relaxed ${theme.desc}`}>
                    {level.description}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-100/90 pt-3.5 mt-4">
                  <div className="font-mono text-[11px]">
                    {pb ? (
                      <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2.5 py-1 rounded-lg font-bold border border-amber-200/50">
                        <Award className="w-3.5 h-3.5" />
                        PB: {pb}
                      </span>
                    ) : (
                      <span className="text-neutral-400">Not attempted yet</span>
                    )}
                  </div>
                  <button className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-300 ${theme.button}`}>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
