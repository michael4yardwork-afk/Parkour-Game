import React, { useState, useEffect } from 'react';
import { Play, Plus, Trash2, Code, Upload, Download, Award, Compass, Sparkles, Map } from 'lucide-react';
import { LevelConfig, SceneTheme } from '../types';
import { DEFAULT_LEVELS } from '../defaultLevels';

interface LevelSelectorProps {
  onSelectLevel: (level: LevelConfig) => void;
  onCreateNewCustom: () => void;
  onEditCustom: (level: LevelConfig) => void;
}

export default function LevelSelector({ onSelectLevel, onCreateNewCustom, onEditCustom }: LevelSelectorProps) {
  const [customLevels, setCustomLevels] = useState<LevelConfig[]>([]);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');
  const [showImportDialog, setShowImportDialog] = useState(false);

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

  const handleImportLevel = () => {
    try {
      setImportError('');
      if (!importText.trim()) {
        setImportError('Please paste some level JSON code.');
        return;
      }
      const data = JSON.parse(importText);
      if (!data.id || !data.name || !Array.isArray(data.blocks)) {
        setImportError('Invalid format. Level must have a name, ID, and list of blocks.');
        return;
      }

      // Safeguard duplicates or override
      const sanitizedId = `imported_${Date.now()}`;
      const newLvl: LevelConfig = {
        ...data,
        id: sanitizedId,
        isCustom: true
      };

      const updated = [...customLevels, newLvl];
      setCustomLevels(updated);
      localStorage.setItem('custom_parkour_levels', JSON.stringify(updated));
      setShowImportDialog(false);
      setImportText('');
      alert(`Successfully imported: "${newLvl.name}"!`);
    } catch (e) {
      setImportError('Failed to parse JSON. Please check compatibility.');
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
            Shave off milliseconds by mastering movement. Leap, slide, wall-run, and discover shortcuts across high-skill courses.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowImportDialog(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl font-medium text-xs transition duration-200 cursor-pointer border border-neutral-200"
          >
            <Upload className="w-4 h-4" />
            Import JSON Link
          </button>
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

            return (
              <div
                key={level.id}
                onClick={() => onSelectLevel(level)}
                className="group relative bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-neutral-300 transition-all duration-300 cursor-pointer overflow-hidden flex flex-col justify-between min-h-[190px]"
              >
                {/* Accent Tag */}
                <span className={`absolute top-0 right-0 py-1 px-3 text-[10px] font-semibold tracking-wider font-mono uppercase bg-neutral-100 text-neutral-600 group-hover:bg-indigo-50 group-hover:text-indigo-600 rounded-bl-xl transition duration-300`}>
                  {themeName}
                </span>

                <div>
                  <h3 className="text-lg font-bold text-neutral-800 group-hover:text-indigo-600 transition duration-200 mr-20">
                    {level.name}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-2 line-clamp-3 leading-relaxed">
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
                  <button className="flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 group-hover:bg-indigo-600 text-white rounded-xl text-xs font-semibold transition-all duration-300">
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Community Levels */}
      <div>
        <div className="flex items-center gap-2 mb-6 border-b border-neutral-100 pb-3">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          <h2 className="text-xl font-bold text-neutral-800 tracking-tight">Your Custom &amp; Imported Levels</h2>
        </div>

        {customLevels.length === 0 ? (
          <div className="bg-neutral-50 border border-dashed border-neutral-200 rounded-2xl py-12 px-6 text-center max-w-xl mx-auto">
            <Code className="w-10 h-10 text-neutral-400 mx-auto opacity-40 mb-3" />
            <h3 className="text-sm font-semibold text-neutral-700">No custom levels found</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-xs mx-auto">
              Open the Course Builder to design a layout from scratch, or import a JSON string shared by friends!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {customLevels.map(level => {
              const pb = getPB(level.id);
              return (
                <div
                  key={level.id}
                  onClick={() => onSelectLevel(level)}
                  className="group bg-white border border-neutral-200/80 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-neutral-300 transition-all duration-200 cursor-pointer flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h3 className="text-base font-bold text-neutral-800 group-hover:text-emerald-600 transition duration-150">
                        {level.name}
                      </h3>
                      <p className="text-xs text-neutral-500 mt-1 line-clamp-2">
                        {level.description || 'Created in Custom Course Builder.'}
                      </p>
                      <div className="flex gap-2 items-center text-[10px] text-neutral-400 font-mono mt-2">
                        <span>Theme: {formatTheme(level.theme)}</span>
                        <span>•</span>
                        <span>{level.blocks.length} elements</span>
                      </div>
                    </div>

                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={(e) => exportLevelJSON(level, e)}
                        className="p-1.5 text-neutral-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="Copy level code string to share"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditCustom(level);
                        }}
                        className="p-1.5 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                        title="Edit level"
                      >
                        <Code className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => deleteCustomLevel(level.id, e)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        title="Delete level"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-neutral-100 pt-3 mt-4">
                    <div className="font-mono text-[11px]">
                      {pb ? (
                        <span className="flex items-center gap-1 bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-bold border border-amber-200">
                          PB: {pb}
                        </span>
                      ) : (
                        <span className="text-neutral-400">No attempts</span>
                      )}
                    </div>
                    <button className="flex items-center gap-1 py-1.5 px-3 bg-neutral-900 group-hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold transition duration-200">
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* JSON Import Dialog overlay */}
      {showImportDialog && (
        <div className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl border border-neutral-200">
            <h2 className="text-lg font-extrabold text-neutral-900">Import Custom Level Code</h2>
            <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
              Paste the level JSON text code block formatted by the Course Builder to play instantly!
            </p>

            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{ "id": "custom", "name": "...", "theme": "...", "blocks": [...] }'
              className="w-full h-44 mt-4 p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-800 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />

            {importError && (
              <p className="text-xs text-red-500 font-semibold mt-2">{importError}</p>
            )}

            <div className="flex gap-2 justify-end mt-4">
              <button
                onClick={() => {
                  setShowImportDialog(false);
                  setImportText('');
                  setImportError('');
                }}
                className="px-4 py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-700 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleImportLevel}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition shadow"
              >
                Assemble Level
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
