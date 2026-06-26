import React, { useState, useEffect } from 'react';
import { Play, Plus, Trash2, Code, Upload, Award, Sparkles, FolderHeart, Check, Copy, Globe, User } from 'lucide-react';
import { LevelConfig, SceneTheme, UserAccount } from '../types';
import { synths } from '../audio';

interface SavedCoursesProps {
  onSelectLevel: (level: LevelConfig) => void;
  onCreateNewCustom: () => void;
  onEditCustom: (level: LevelConfig) => void;
  currentUser: UserAccount;
}

export default function SavedCourses({ onSelectLevel, onCreateNewCustom, onEditCustom, currentUser }: SavedCoursesProps) {
  const [customLevels, setCustomLevels] = useState<LevelConfig[]>([]);
  const [copiedLevelId, setCopiedLevelId] = useState<string | null>(null);
  const [deletingLevel, setDeletingLevel] = useState<LevelConfig | null>(null);
  const [publishingLevel, setPublishingLevel] = useState<LevelConfig | null>(null);

  // Load custom levels from storage
  const loadCustomLevels = () => {
    const list = localStorage.getItem('custom_parkour_levels');
    if (list) {
      try {
        setCustomLevels(JSON.parse(list));
      } catch (e) {
        console.error('Error loading custom levels', e);
      }
    } else {
      setCustomLevels([]);
    }
  };

  useEffect(() => {
    loadCustomLevels();
  }, []);

  const deleteCustomLevel = (level: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingLevel(level);
    synths.playTick();
  };

  const confirmDeleteLevel = () => {
    if (!deletingLevel) return;
    const { id } = deletingLevel;
    
    // Physical deletion from list
    const updated = customLevels.filter(lvl => lvl.id !== id);
    setCustomLevels(updated);
    localStorage.setItem('custom_parkour_levels', JSON.stringify(updated));
    
    // Clear related personal times and recorder replays
    localStorage.removeItem(`best_time_${id}`);
    localStorage.removeItem(`ghost_replay_${id}`);

    // Delete from community_published_courses if published by this user
    try {
      const communityStored = localStorage.getItem('community_published_courses');
      if (communityStored) {
        let communityCourses: LevelConfig[] = JSON.parse(communityStored);
        const exists = communityCourses.find(lvl => lvl.id === id);
        // If it exists in community and was published by this user, delete it
        if (exists && exists.creator?.toLowerCase().trim() === currentUser.username.toLowerCase().trim()) {
          communityCourses = communityCourses.filter(lvl => lvl.id !== id);
          localStorage.setItem('community_published_courses', JSON.stringify(communityCourses));
        }
      }
    } catch (e) {
      console.error('Error removing course from community courses store:', e);
    }
    
    setDeletingLevel(null);
    synths.playFinish();
  };

  const confirmPublishLevel = () => {
    if (!publishingLevel) return;
    try {
      const now = Date.now();
      const published: LevelConfig = {
        ...publishingLevel,
        creator: currentUser.username,
        createdAt: now,
        isPublished: true,
        likesCount: 0
      };

      // Save to community_published_courses (which is global/unprefixed)
      const communityStored = localStorage.getItem('community_published_courses');
      let communityCourses: LevelConfig[] = communityStored ? JSON.parse(communityStored) : [];
      communityCourses = communityCourses.filter(lvl => lvl.id !== published.id);
      communityCourses.push(published);
      localStorage.setItem('community_published_courses', JSON.stringify(communityCourses));

      // Mark as published locally to lock edits
      const updatedList = customLevels.map(lvl => {
        if (lvl.id === publishingLevel.id) {
          return { ...lvl, isPublished: true, creator: currentUser.username };
        }
        return lvl;
      });
      setCustomLevels(updatedList);
      localStorage.setItem('custom_parkour_levels', JSON.stringify(updatedList));

      // Decouple the builder draft if it matches the level being published
      const savedDraft = localStorage.getItem('momentum_builder_draft');
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft) as LevelConfig;
          if (parsed.id === publishingLevel.id) {
            const decoupledDraft: LevelConfig = {
              ...parsed,
              id: `level_${Date.now()}`,
              isPublished: false
            };
            localStorage.setItem('momentum_builder_draft', JSON.stringify(decoupledDraft));
          }
        } catch (e) {
          console.error('Error decoupling draft on publish:', e);
        }
      }

      setPublishingLevel(null);
      synths.playFinish();
      alert(`"${published.name}" has been successfully published to the community! Custom edits are now locked.`);
    } catch (e) {
      console.error(e);
      alert('Failed to publish course.');
    }
  };



  const exportLevelJSON = (lvl: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    const jsonStr = JSON.stringify(lvl, null, 2);
    navigator.clipboard.writeText(jsonStr);
    
    setCopiedLevelId(lvl.id);
    synths.playTick();
    
    setTimeout(() => {
      setCopiedLevelId(null);
    }, 2000);
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
    <div id="saved-courses-view" className="max-w-6xl mx-auto px-4 py-8 space-y-8 font-sans">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 border-b border-neutral-100 pb-6">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
            <FolderHeart className="w-8 h-8 text-rose-500" />
            Saved Courses
          </h1>
          <p className="text-sm text-neutral-500 mt-2">
            Organize, configure, edit, and play your own physical momentum arenas built with the builder.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="create-course-btn"
            onClick={() => { onCreateNewCustom(); synths.playTick(); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition shadow-md hover:shadow-indigo-500/10 duration-200 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Launch Builder
          </button>
        </div>
      </div>

      {/* Grid List */}
      {customLevels.length === 0 ? (
        <div className="bg-neutral-50 border border-dashed border-neutral-200 rounded-3xl py-16 px-6 text-center max-w-xl mx-auto my-6 shadow-sm">
          <div className="w-14 h-14 bg-neutral-100 border border-neutral-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-neutral-400">
            <Code className="w-6 h-6 opacity-60" />
          </div>
          <h3 className="text-base font-bold text-neutral-850">Your course roster is empty</h3>
          <p className="text-xs text-neutral-500 mt-2 max-w-sm mx-auto leading-relaxed">
            Jump into the Course Builder sandbox! Create paths, layout hazardous lava traps, scale speed conveyors, and compile them here.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => { onCreateNewCustom(); synths.playTick(); }}
              className="px-5 py-2.5 bg-neutral-900 hover:bg-neutral-850 text-white rounded-xl font-bold text-xs transition duration-200 cursor-pointer"
            >
              Start Building Let's Go
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {customLevels.map(level => {
            const pb = getPB(level.id);
            const isCreator = !level.creator || level.creator.toLowerCase().trim() === currentUser.username.toLowerCase().trim();
            const canEdit = isCreator && !level.isPublished;

            return (
              <div
                key={level.id}
                id={`saved-course-card-${level.id}`}
                onClick={() => onSelectLevel(level)}
                className="group relative bg-white border border-neutral-200/90 hover:border-neutral-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[200px]"
              >
                {/* Theme Tag */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="py-0.5 px-2.5 bg-neutral-100 text-neutral-600 font-semibold font-mono text-[9px] rounded-full uppercase tracking-wider">
                      {formatTheme(level.theme)}
                    </span>
                    {level.isPublished && (
                      <span className="py-0.5 px-2 bg-indigo-55 border border-indigo-150 text-indigo-700 font-semibold font-sans text-[9px] rounded-full uppercase tracking-wider flex items-center gap-0.5" title="Published of Community">
                        <Globe className="w-2.5 h-2.5" />
                        Published
                      </span>
                    )}
                    {level.creator && level.creator.toLowerCase().trim() !== currentUser.username.toLowerCase().trim() && (
                      <span className="py-0.5 px-2 bg-teal-50 border border-teal-200 text-teal-700 font-semibold font-sans text-[9px] rounded-full uppercase tracking-wider flex items-center gap-0.5">
                        <User className="w-2.5 h-2.5" />
                        By {level.creator}
                      </span>
                    )}
                  </div>
                  
                  {/* Small Utils Tools overlay */}
                  <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition duration-200 select-none">
                    <button
                      onClick={(e) => exportLevelJSON(level, e)}
                      className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition opacity-100"
                      title="Copy sharing key JSON code"
                    >
                      {copiedLevelId === level.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    {canEdit && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditCustom(level);
                        }}
                        className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="Edit layout inside Builder"
                      >
                        <Code className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => deleteCustomLevel(level, e)}
                      className="p-1.5 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete saved course"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-black text-neutral-850 group-hover:text-indigo-600 transition-colors duration-150 leading-tight">
                    {level.name}
                  </h3>
                  <p className="text-xs text-neutral-500 mt-1 lines-clamp-2 leading-relaxed">
                    {level.description || 'No description provided.'}
                  </p>
                  
                  <div className="font-mono text-[10px] text-neutral-400 uppercase tracking-wider mt-3.5 flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-emerald-500" />
                    <span>{level.blocks.length} elements</span>
                  </div>
                </div>

                {/* Bottom row Play action */}
                <div className="flex items-center justify-between border-t border-neutral-100/80 pt-3.5 mt-5">
                  <div>
                    {pb ? (
                      <span className="flex items-center gap-1 bg-amber-50 border border-amber-200/50 text-amber-700 px-2 py-0.5 rounded-lg font-bold font-mono text-[10px]">
                        <Award className="w-3 h-3" />
                        PB: {pb}
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-neutral-400 italic">No record time</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isCreator && !level.isPublished && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPublishingLevel(level);
                          synths.playTick();
                        }}
                        className="flex items-center gap-1 px-3 py-1 text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-xs font-bold transition duration-200 cursor-pointer"
                        title="Publish course for everyone to play in the community"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span>Publish</span>
                      </button>
                    )}
                    <button className="flex items-center gap-1 px-3.5 py-1 text-white bg-neutral-900 group-hover:bg-indigo-600 rounded-lg text-xs font-bold transition duration-200">
                      <Play className="w-3 h-3 fill-current" />
                      <span>Run</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}



      {/* Custom Confirmation Screen Dialog for Deletion */}
      {deletingLevel && (
        <div className="fixed inset-0 z-50 bg-neutral-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-neutral-200/80 animate-in fade-in zoom-in duration-200 text-center">
            <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500">
              <Trash2 className="w-5 h-5 animate-bounce" />
            </div>
            <h3 className="text-base font-black tracking-tight text-neutral-850">Delete saved course?</h3>
            <p className="text-xs text-neutral-500 mt-2.5 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-neutral-850">"{deletingLevel.name}"</span>?
            </p>
            <p className="text-[11px] text-rose-600 bg-rose-50/50 border border-rose-100/30 rounded-lg p-2.5 mt-3 leading-normal font-medium">
              This action is permanent and will clear all registered personal best times, records, and ghost runs for this course.
            </p>
            <div className="flex gap-2.5 justify-center mt-5">
              <button
                onClick={() => {
                  setDeletingLevel(null);
                  synths.playTick();
                }}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-150 text-neutral-700 text-xs font-bold rounded-xl transition flex-1 cursor-pointer"
              >
                Go Back
              </button>
              <button
                onClick={confirmDeleteLevel}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow shadow-rose-500/10 flex-1 cursor-pointer"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Screen Dialog for Publishing */}
      {publishingLevel && (
        <div className="fixed inset-0 z-50 bg-neutral-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl border border-neutral-200/80 animate-in fade-in zoom-in duration-200 text-center">
            <div className="w-12 h-12 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
              <Globe className="w-5 h-5 animate-pulse" />
            </div>
            <h3 className="text-base font-black tracking-tight text-neutral-850">Publish to Community?</h3>
            <p className="text-xs text-neutral-500 mt-2.5 leading-relaxed">
              Are you sure you want to share <span className="font-bold text-neutral-850">"{publishingLevel.name}"</span> on the community workshop?
            </p>
            <p className="text-[11px] text-indigo-650 bg-indigo-50/50 border border-indigo-100/30 rounded-lg p-3 mt-3 leading-normal font-medium">
              Everyone will be able to play this course, bookmark it, and like it. Once published, <span className="font-bold text-neutral-800">you cannot edit its layout anymore</span>.
            </p>
            <div className="flex gap-2.5 justify-center mt-5">
              <button
                onClick={() => {
                  setPublishingLevel(null);
                  synths.playTick();
                }}
                className="px-4 py-2 bg-neutral-100 hover:bg-neutral-150 text-neutral-700 text-xs font-bold rounded-xl transition flex-1 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={confirmPublishLevel}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow shadow-indigo-500/10 flex-1 cursor-pointer"
              >
                Publish Now
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
