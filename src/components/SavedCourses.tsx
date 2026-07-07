import React, { useState, useEffect } from 'react';
import { Play, Plus, Trash2, Code, Award, Sparkles, FolderHeart, Globe, User, Search, RotateCcw, X, RefreshCw, EyeOff } from 'lucide-react';
import { LevelConfig, SceneTheme, UserAccount } from '../types';
import { synths } from '../audio';
import { api } from '../api';

interface SavedCoursesProps {
  onSelectLevel: (level: LevelConfig) => void;
  onCreateNewCustom: () => void;
  onEditCustom: (level: LevelConfig) => void;
  currentUser: UserAccount;
}

const formatWR = (seconds: number): string => {
  const totalMs = Math.round(seconds * 1000);
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${m > 0 ? `${m}:` : ''}${s.toString().padStart(m > 0 ? 2 : 1, '0')}.${ms.toString().padStart(3, '0')}s`;
};

export default function SavedCourses({ onSelectLevel, onCreateNewCustom, onEditCustom, currentUser }: SavedCoursesProps) {
  const [customLevels, setCustomLevels] = useState<LevelConfig[]>([]);
  const [deletingLevel, setDeletingLevel] = useState<LevelConfig | null>(null);
  const [publishingLevel, setPublishingLevel] = useState<LevelConfig | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [wrMap, setWrMap] = useState<Record<string, string | null>>({});

  const loadCustomLevels = async () => {
    try {
      const savedFromServer = await api.community.getSaved();
      const serverIds = new Set(savedFromServer.map(c => c.id));

      const localStored = localStorage.getItem('custom_parkour_levels');
      const localLevels: LevelConfig[] = localStored ? JSON.parse(localStored) : [];
      const localDrafts = localLevels.filter(lvl => !lvl.isPublished);
      const localPublished = localLevels.filter(lvl => lvl.isPublished && serverIds.has(lvl.id));

      const merged = [...localDrafts];
      savedFromServer.forEach(srvLvl => {
        if (!merged.some(l => l.id === srvLvl.id)) {
          merged.push(srvLvl);
        }
      });
      localPublished.forEach(pub => {
        if (!merged.some(l => l.id === pub.id)) {
          merged.push(pub);
        }
      });

      setCustomLevels(merged);
    } catch (e) {
      console.error('Error loading saved courses', e);
      const localStored = localStorage.getItem('custom_parkour_levels');
      if (localStored) {
        try { setCustomLevels(JSON.parse(localStored)); } catch { setCustomLevels([]); }
      }
    }
  };

  useEffect(() => {
    loadCustomLevels();
  }, []);

  useEffect(() => {
    if (customLevels.length === 0) return;
    Promise.all(
      customLevels.map(async (lvl) => {
        try {
          const entries = await api.leaderboard.get(lvl.id);
          return [lvl.id, entries.length > 0 ? formatWR(entries[0].time) : null] as const;
        } catch {
          return [lvl.id, null] as const;
        }
      })
    ).then(pairs => {
      const map: Record<string, string | null> = {};
      pairs.forEach(([id, wr]) => { map[id] = wr; });
      setWrMap(map);
    });
  }, [customLevels]);

  const handleUnpublish = async (level: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Unpublish "${level.name}"? It will be removed from the community workshop but kept in your saved courses.`)) return;
    try {
      await api.community.deleteCourse(level.id);
      setSavedLevels(prev => prev.map(l => l.id === level.id ? { ...l, isPublished: false } : l));
      synths.playTick();
    } catch (err: any) {
      console.error('Failed to unpublish course:', err);
      alert(err.message || 'Failed to unpublish course.');
    }
  };

  const deleteCustomLevel = (level: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingLevel(level);
    synths.playTick();
  };

  const confirmDeleteLevel = async () => {
    if (!deletingLevel) return;
    const { id } = deletingLevel;
    const isOwner = !deletingLevel.creator || deletingLevel.creator.toLowerCase().trim() === currentUser.username.toLowerCase().trim();

    if (isOwner && deletingLevel.isPublished) {
      try {
        await api.community.deleteCourse(id);
      } catch (e) {
        console.error('Failed to delete from community:', e);
      }
    } else if (!isOwner) {
      try {
        await api.community.toggleBookmark(id);
      } catch (e) {
        console.error('Failed to remove bookmark:', e);
      }
    }

    const updated = customLevels.filter(lvl => lvl.id !== id);
    setCustomLevels(updated);

    const localList = updated.filter(lvl => !lvl.isPublished || (lvl.creator?.toLowerCase() === currentUser.username.toLowerCase()));
    localStorage.setItem('custom_parkour_levels', JSON.stringify(localList));

    localStorage.removeItem(`best_time_${id}`);
    localStorage.removeItem(`ghost_replay_${id}`);

    setDeletingLevel(null);
    synths.playFinish();
  };

  const confirmPublishLevel = async () => {
    if (!publishingLevel) return;
    setPublishing(true);
    try {
      const published: LevelConfig = {
        ...publishingLevel,
        creator: currentUser.username,
        createdAt: Date.now(),
        isPublished: true,
        likesCount: 0
      };

      await api.community.publishCourse(published);

      const updatedList = customLevels.map(lvl =>
        lvl.id === publishingLevel.id ? { ...lvl, isPublished: true, creator: currentUser.username } : lvl
      );
      setCustomLevels(updatedList);

      const localList = updatedList;
      localStorage.setItem('custom_parkour_levels', JSON.stringify(localList));

      const savedDraft = localStorage.getItem('momentum_builder_draft');
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft) as LevelConfig;
          if (parsed.id === publishingLevel.id) {
            const decoupledDraft: LevelConfig = { ...parsed, id: `level_${Date.now()}`, isPublished: false };
            localStorage.setItem('momentum_builder_draft', JSON.stringify(decoupledDraft));
          }
        } catch { }
      }

      setPublishingLevel(null);
      synths.playFinish();
      alert(`"${published.name}" has been published to the community! Edits are now locked.`);
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to publish course. Please try again.');
    } finally {
      setPublishing(false);
    }
  };

  const exportLevelJSON = (lvl: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(JSON.stringify(lvl, null, 2));
    synths.playTick();
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

  const getPB = (id: string) => {
    const score = localStorage.getItem(`best_time_${id}`);
    if (score) {
      const parsed = parseFloat(score);
      if (parsed <= 0.05) { localStorage.removeItem(`best_time_${id}`); return null; }
      const totalMilliseconds = Math.round(parsed * 1000);
      const m = Math.floor(totalMilliseconds / 60000);
      const s = Math.floor((totalMilliseconds % 60000) / 1000);
      const ms = totalMilliseconds % 1000;
      return `${m > 0 ? `${m}:` : ''}${s.toString().padStart(m > 0 ? 2 : 1, '0')}.${ms.toString().padStart(3, '0')}s`;
    }
    return null;
  };

  const filteredLevels = customLevels.filter(lvl => {
    const query = searchQuery.toLowerCase().trim();
    return !query ||
      lvl.name.toLowerCase().includes(query) ||
      (lvl.description && lvl.description.toLowerCase().includes(query)) ||
      (lvl.creator && lvl.creator.toLowerCase().includes(query));
  });

  const sortedLevels = [...filteredLevels].sort((a, b) => {
    if (!a.isPublished && b.isPublished) return -1;
    if (a.isPublished && !b.isPublished) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div id="saved-courses-view" className="max-w-6xl mx-auto px-4 py-8 space-y-8 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-neutral-100 pb-6">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
            <FolderHeart className="w-8 h-8 text-rose-500" />
            Saved Courses
          </h1>
          <p className="text-sm text-neutral-500 mt-2">
            Organize, configure, edit, and play your own momentum arenas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadCustomLevels} className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:text-indigo-600 transition cursor-pointer" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            id="create-course-btn"
            onClick={() => { onCreateNewCustom(); synths.playTick(); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition shadow-md duration-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Launch Builder
          </button>
        </div>
      </div>

      {customLevels.length > 0 && (
        <div className="flex items-center gap-3 bg-neutral-100 border border-neutral-200/50 p-2.5 rounded-2xl w-full max-w-xl shadow-inner">
          <Search className="w-4 h-4 text-neutral-400 ml-1.5 shrink-0" />
          <input
            type="text" placeholder="Filter courses by name, creator, or keywords..."
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent text-sm text-neutral-800 w-full focus:outline-none placeholder-neutral-400 font-medium"
          />
        </div>
      )}

      {customLevels.length === 0 ? (
        <div className="bg-white border border-dashed border-neutral-200 rounded-3xl py-16 px-6 text-center max-w-xl mx-auto my-6 shadow-sm">
          <div className="w-14 h-14 bg-neutral-100 border border-neutral-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-neutral-400">
            <Code className="w-6 h-6 opacity-60" />
          </div>
          <h3 className="text-base font-bold text-neutral-850">Your course roster is empty</h3>
          <p className="text-xs text-neutral-500 mt-2 max-w-sm mx-auto leading-relaxed">
            Jump into the Course Builder! Create paths, hazards, and publish them to the community.
          </p>
          <div className="mt-6">
            <button onClick={() => { onCreateNewCustom(); synths.playTick(); }}
              className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white rounded-xl font-bold text-xs transition cursor-pointer">
              Start Building
            </button>
          </div>
        </div>
      ) : sortedLevels.length === 0 ? (
        <div className="bg-white border border-dashed border-neutral-200 rounded-3xl py-12 px-6 text-center max-w-md mx-auto">
          <h3 className="text-sm font-bold text-neutral-800">No courses match your criteria</h3>
          <button onClick={() => setSearchQuery('')}
            className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition cursor-pointer mx-auto">
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Search
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedLevels.map(level => {
            const pb = getPB(level.id);
            const isCreator = !level.creator || level.creator.toLowerCase().trim() === currentUser.username.toLowerCase().trim();
            const canEdit = isCreator && !level.isPublished;

            return (
              <div
                key={level.id}
                onClick={() => onSelectLevel(level)}
                className="group relative bg-white border border-neutral-200/90 hover:border-neutral-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[200px]"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="py-0.5 px-2.5 bg-neutral-100 text-neutral-600 font-semibold font-mono text-[9px] rounded-full tracking-wider">
                      {level.id in wrMap
                        ? (wrMap[level.id] ? `WR ${wrMap[level.id]}` : 'No WR')
                        : '…'}
                    </span>
                    {level.isPublished && (
                      <span className="py-0.5 px-2 bg-indigo-50 border border-indigo-150 text-indigo-700 font-semibold font-sans text-[9px] rounded-full uppercase tracking-wider flex items-center gap-0.5">
                        <Globe className="w-2.5 h-2.5" />Published
                      </span>
                    )}
                    {level.creator && level.creator.toLowerCase().trim() !== currentUser.username.toLowerCase().trim() && (
                      <span className="py-0.5 px-2 bg-teal-50 border border-teal-200 text-teal-700 font-semibold font-sans text-[9px] rounded-full uppercase tracking-wider flex items-center gap-0.5">
                        <User className="w-2.5 h-2.5" />By {level.creator}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition duration-200 select-none">
                    {canEdit && (
                      <button onClick={(e) => { e.stopPropagation(); onEditCustom(level); }}
                        className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="Edit in Builder">
                        <Code className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button onClick={(e) => deleteCustomLevel(level, e)}
                      className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title={isCreator ? 'Delete course' : 'Remove from saved'}>
                      {isCreator ? <Trash2 className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-black text-neutral-850 group-hover:text-indigo-600 transition-colors leading-tight">
                    {level.name}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                    {level.description || 'No description provided.'}
                  </p>
                  <div className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider mt-3.5 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    <span>{level.blocks?.length || 0} elements</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-100/80 pt-3.5 mt-5">
                  <div>
                    {pb ? (
                      <span className="flex items-center gap-1 bg-amber-50 border border-amber-200/50 text-amber-700 px-2 py-0.5 rounded-lg font-bold font-mono text-[10px]">
                        <Award className="w-3 h-3" />PB: {pb}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-neutral-400 italic">No record time</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {isCreator && !level.isPublished && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setPublishingLevel(level); synths.playTick(); }}
                        className="flex items-center gap-1 px-3 py-1 text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-xs font-bold transition cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />Publish
                      </button>
                    )}
                    {isCreator && level.isPublished && (
                      <button
                        onClick={(e) => handleUnpublish(level, e)}
                        className="flex items-center gap-1 px-3 py-1 text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 rounded-lg text-xs font-bold transition cursor-pointer"
                        title="Remove from the community workshop"
                      >
                        <EyeOff className="w-3.5 h-3.5" />Unpublish
                      </button>
                    )}
                    <button className="flex items-center gap-1 px-3.5 py-1 text-white bg-neutral-900 group-hover:bg-indigo-600 rounded-lg text-xs font-bold transition">
                      <Play className="w-3 h-3 fill-current" />Run
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {deletingLevel && (
        <div className="fixed inset-0 z-50 bg-neutral-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-neutral-200/80 animate-in fade-in zoom-in duration-200 text-center">
            <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500">
              <Trash2 className="w-5 h-5 animate-bounce" />
            </div>
            <h3 className="text-base font-black tracking-tight">
              {(!deletingLevel.creator || deletingLevel.creator.toLowerCase() === currentUser.username.toLowerCase()) ? 'Delete saved course?' : 'Remove from Saved?'}
            </h3>
            <p className="text-xs text-neutral-500 mt-2.5 leading-relaxed">
              Are you sure you want to {(!deletingLevel.creator || deletingLevel.creator.toLowerCase() === currentUser.username.toLowerCase()) ? 'permanently delete' : 'remove'} <span className="font-bold">"{deletingLevel.name}"</span>?
            </p>
            {deletingLevel.isPublished && deletingLevel.creator?.toLowerCase() === currentUser.username.toLowerCase() && (
              <p className="text-[11px] text-rose-600 bg-rose-50/50 border border-rose-100/30 rounded-lg p-2.5 mt-3 font-medium">
                This will also remove it from the Community Workshop.
              </p>
            )}
            <div className="flex gap-2.5 justify-center mt-5">
              <button onClick={() => { setDeletingLevel(null); synths.playTick(); }}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-150 text-neutral-700 text-xs font-bold rounded-xl transition flex-1 cursor-pointer">
                Go Back
              </button>
              <button onClick={confirmDeleteLevel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition flex-1 cursor-pointer">
                {(!deletingLevel.creator || deletingLevel.creator.toLowerCase() === currentUser.username.toLowerCase()) ? 'Delete Forever' : 'Remove Course'}
              </button>
            </div>
          </div>
        </div>
      )}

      {publishingLevel && (
        <div className="fixed inset-0 z-50 bg-neutral-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-neutral-200/80 animate-in fade-in zoom-in duration-200 text-center">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
              <Globe className="w-5 h-5 animate-pulse" />
            </div>
            <h3 className="text-base font-black tracking-tight">Publish to Community?</h3>
            <p className="text-xs text-neutral-500 mt-2.5 leading-relaxed">
              Share <span className="font-bold">"{publishingLevel.name}"</span> on the community workshop?
            </p>
            <p className="text-[11px] text-indigo-650 bg-indigo-50/50 border border-indigo-100/30 rounded-lg p-3 mt-3 font-medium">
              Everyone can play, bookmark, and like it. Once published, <span className="font-bold text-neutral-800">you cannot edit its layout anymore</span>.
            </p>
            <div className="flex gap-2.5 justify-center mt-5">
              <button onClick={() => { setPublishingLevel(null); synths.playTick(); }} disabled={publishing}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-150 text-neutral-700 text-xs font-bold rounded-xl transition flex-1 cursor-pointer">
                Cancel
              </button>
              <button onClick={confirmPublishLevel} disabled={publishing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold rounded-xl transition flex-1 cursor-pointer">
                {publishing ? 'Publishing...' : 'Publish Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
