import React, { useState, useEffect } from 'react';
import { Play, Heart, Bookmark, Search, Sparkles, Trophy, User, ArrowUpDown, BookmarkCheck, RefreshCw, EyeOff } from 'lucide-react';
import { LevelConfig, SceneTheme, UserAccount } from '../types';
import { synths } from '../audio';
import { api } from '../api';
import PlatinumGate from './PlatinumGate';

interface CommunityCoursesProps {
  onSelectLevel: (level: LevelConfig) => void;
  currentUser: UserAccount;
  onViewProfile: (username: string) => void;
  isPlatinum: boolean;
  onUpgrade?: () => void;
}

const formatWR = (seconds: number): string => {
  const totalMs = Math.round(seconds * 1000);
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${m > 0 ? `${m}:` : ''}${s.toString().padStart(m > 0 ? 2 : 1, '0')}.${ms.toString().padStart(3, '0')}s`;
};

export default function CommunityCourses({ onSelectLevel, currentUser, onViewProfile, isPlatinum, onUpgrade }: CommunityCoursesProps) {
  const [courses, setCourses] = useState<LevelConfig[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [savedLevelIds, setSavedLevelIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'likes' | 'newest' | 'most_liked'>('likes');
  const [loading, setLoading] = useState(true);
  const [wrMap, setWrMap] = useState<Record<string, string | null>>({});
  const [gate, setGate] = useState<{ feature: string; description?: string } | null>(null);

  const loadCourses = async () => {
    setLoading(true);
    try {
      const { courses: fetchedCourses, likedIds: fetchedLikes, bookmarkedIds } = await api.community.getCourses();
      setCourses(fetchedCourses);
      setLikedIds(fetchedLikes);
      setSavedLevelIds(bookmarkedIds);
    } catch (e) {
      console.error('Failed to load community courses:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (courses.length === 0) return;
    let aborted = false;
    Promise.all(
      courses.map(async (c) => {
        try {
          const entries = await api.leaderboard.get(c.id);
          return [c.id, entries.length > 0 ? formatWR(entries[0].time) : null] as const;
        } catch {
          return [c.id, null] as const;
        }
      })
    ).then(pairs => {
      if (aborted) return;
      const map: Record<string, string | null> = {};
      pairs.forEach(([id, wr]) => { map[id] = wr; });
      setWrMap(map);
    });
    return () => { aborted = true; };
  }, [courses]);

  const handleLike = async (level: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { liked, likesCount } = await api.community.toggleLike(level.id);
      setCourses(prev => prev.map(c => c.id === level.id ? { ...c, likesCount } : c));
      if (liked) {
        setLikedIds(prev => [...prev, level.id]);
        synths.playFinish();
      } else {
        setLikedIds(prev => prev.filter(id => id !== level.id));
        synths.playTick();
      }
    } catch (e: any) {
      console.error('Failed to toggle like:', e);
    }
  };

  const handleUnpublish = async (course: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Unpublish "${course.name}"? It will be removed from the community workshop but kept in your saved courses.`)) return;
    try {
      await api.community.unpublishCourse(course.id);
      setCourses(prev => prev.filter(c => c.id !== course.id));
      synths.playTick();
    } catch (err: any) {
      console.error('Failed to unpublish course:', err);
      alert(err.message || 'Failed to unpublish course.');
    }
  };

  const handleSaveCourse = async (level: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    const isOwner = level.creator?.toLowerCase().trim() === currentUser.username.toLowerCase().trim();
    const isBookmarked = savedLevelIds.includes(level.id);

    if (isBookmarked && isOwner) {
      alert(`"${level.name}" is your own published course. Delete it from Saved Courses to remove it.`);
      return;
    }

    // Free plan users cannot save others' courses.
    if (!isOwner && !isPlatinum) {
      setGate({ feature: 'Course Bookmarks', description: 'Save any workshop course to your personal library and replay it anytime.' });
      return;
    }

    try {
      const { bookmarked } = await api.community.toggleBookmark(level.id);
      if (bookmarked) {
        setSavedLevelIds(prev => [...prev, level.id]);
        synths.playFinish();
        alert(`"${level.name}" bookmarked and added to your Saved Courses!`);
      } else {
        setSavedLevelIds(prev => prev.filter(id => id !== level.id));
        synths.playTick();
        alert(`"${level.name}" has been removed from your Saved Courses.`);
      }
    } catch (e: any) {
      console.error('Failed to toggle bookmark:', e);
      if (e.message === 'platinum_required') {
        setGate({ feature: 'Course Bookmarks', description: 'Save any workshop course to your personal library and replay it anytime.' });
      } else {
        alert(e.message || 'Failed to update bookmark.');
      }
    }
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

  const filteredCourses = courses.filter(course => {
    const searchLow = searchTerm.toLowerCase();
    return (
      course.name.toLowerCase().includes(searchLow) ||
      (course.description || '').toLowerCase().includes(searchLow) ||
      (course.creator || '').toLowerCase().includes(searchLow)
    );
  });

  const sortedCourses = [...filteredCourses].sort((a, b) => {
    if (sortBy === 'most_liked') {
      const diff = (b.likesCount || 0) - (a.likesCount || 0);
      if (diff !== 0) return diff;
      return (b.createdAt || 0) - (a.createdAt || 0);
    } else if (sortBy === 'likes') {
      const diff = (b.likesCount || 0) - (a.likesCount || 0);
      if (diff !== 0) return diff;
      return (b.createdAt || 0) - (a.createdAt || 0);
    } else {
      return (b.createdAt || 0) - (a.createdAt || 0);
    }
  });

  return (
    <div id="community-courses-view" className="max-w-6xl mx-auto px-4 py-8 space-y-8 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-neutral-100 pb-6">
        <div>
          <h1 className="text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
            <Trophy className="w-8 h-8 text-indigo-600" />
            Community Workshop
          </h1>
          <p className="text-sm text-neutral-500 mt-2">
            Explore paths, parkour lines, and speed-runner environments customized and shared by athletes worldwide.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadCourses}
            className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:text-indigo-600 hover:border-indigo-300 transition cursor-pointer"
            title="Refresh courses"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <span className="text-xs font-semibold text-neutral-400 font-mono flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort Order:
          </span>
          <div className="bg-neutral-100 p-1 rounded-xl flex">
            <button onClick={() => { setSortBy('likes'); synths.playTick(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${sortBy === 'likes' ? 'bg-white text-indigo-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>
              Most Liked
            </button>
            <button onClick={() => { setSortBy('newest'); synths.playTick(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${sortBy === 'newest' ? 'bg-white text-indigo-700 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}>
              Newest
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 bg-neutral-100 border border-neutral-200/50 p-2.5 rounded-2xl w-full max-w-xl shadow-inner">
        <Search className="w-4 h-4 text-neutral-400 ml-1.5 shrink-0" />
        <input
          type="text" placeholder="Filter courses by name, creator, or keywords..."
          value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent text-sm text-neutral-800 w-full focus:outline-none placeholder-neutral-400 font-medium"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-neutral-400">
          <RefreshCw className="w-6 h-6 animate-spin" />
          <span className="text-sm font-mono">Loading workshop courses...</span>
        </div>
      ) : sortedCourses.length === 0 ? (
        <div className="bg-neutral-50 border border-dashed border-neutral-200 rounded-3xl py-16 px-6 text-center max-w-xl mx-auto my-6 shadow-sm">
          <div className="w-14 h-14 bg-neutral-100 border border-neutral-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-neutral-400">
            <Sparkles className="w-6 h-6 opacity-60" />
          </div>
          <h3 className="text-base font-bold text-neutral-800">No community levels found</h3>
          <p className="text-xs text-neutral-500 mt-2 max-w-sm mx-auto leading-relaxed">
            {searchTerm
              ? `No workshop matches found for "${searchTerm}". Try a different name or keyword.`
              : "The community lists are currently quiet. Be the first athlete to build and publish a course!"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedCourses.map(course => {
            const isLiked = likedIds.includes(course.id);
            const isBookmarked = savedLevelIds.includes(course.id);
            const isOurOwn = course.creator?.toLowerCase().trim() === currentUser.username.toLowerCase().trim();

            return (
              <div
                key={course.id}
                onClick={() => onSelectLevel(course)}
                className="group relative bg-white border border-neutral-200/90 hover:border-neutral-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[220px]"
              >
                <div className="flex items-center justify-between mb-4.5">
                  <span className="py-0.5 px-2.5 bg-neutral-100 text-neutral-600 font-semibold font-mono text-[9px] rounded-full tracking-wider">
                    {course.id in wrMap
                      ? (wrMap[course.id] ? `WR ${wrMap[course.id]}` : 'No WR')
                      : '…'}
                  </span>
                  
                  <div className="flex items-center gap-1.5 select-none">
                    {(isOurOwn || isPlatinum) ? (
                      <button
                        onClick={(e) => handleSaveCourse(course, e)}
                        className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                          isBookmarked ? 'bg-amber-50 text-amber-600 border-amber-200/50' : 'bg-neutral-50 border-neutral-150 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                        }`}
                        title={isBookmarked ? 'Remove course from saved list' : 'Bookmark to My Saved Courses'}
                      >
                        {isBookmarked ? <BookmarkCheck className="w-4 h-4 fill-current" /> : <Bookmark className="w-4 h-4" />}
                      </button>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setGate({ feature: 'Course Bookmarks', description: 'Save any workshop course to your personal library and replay it anytime.' }); }}
                        className="p-2 rounded-xl border border-neutral-150 bg-neutral-50 text-neutral-300 cursor-pointer flex items-center justify-center"
                        title="Platinum feature — upgrade to save courses"
                      >
                        <Bookmark className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleLike(course, e)}
                      className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center gap-1 ${
                        isLiked ? 'bg-rose-50 text-rose-600 border-rose-200/50' : 'bg-neutral-50 border-neutral-150 text-neutral-400 hover:text-rose-600 hover:bg-rose-50'
                      }`}
                      title={isLiked ? 'Unlike course' : 'Like course'}
                    >
                      <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                      {course.likesCount && course.likesCount > 0 ? (
                        <span className="text-xs font-bold font-mono">{course.likesCount}</span>
                      ) : null}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-black text-neutral-850 group-hover:text-indigo-650 transition-colors duration-150 leading-tight">
                    {course.name}
                  </h3>
                  
                  <div className="flex items-center gap-3 mt-4 text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                    <div 
                      onClick={(e) => { e.stopPropagation(); synths.playTick(); onViewProfile(isOurOwn ? currentUser.username : (course.creator || 'Runner')); }}
                      className="flex items-center gap-1 text-teal-600 hover:text-indigo-600 hover:scale-[1.02] transition cursor-pointer underline decoration-dotted underline-offset-2"
                      title="View Athlete Profile"
                    >
                      <User className="w-3.5 h-3.5 shrink-0" />
                      <span>{isOurOwn ? 'You' : course.creator || 'Runner'}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span>{course.blocks?.length || 0} elements</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-neutral-150/40 pt-4 mt-5">
                  {isOurOwn ? (
                    <button
                      onClick={(e) => handleUnpublish(course, e)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider border border-rose-200 bg-rose-50 text-rose-500 hover:bg-rose-100 hover:border-rose-300 hover:text-rose-600 transition duration-200 cursor-pointer"
                      title="Remove this course from the community workshop"
                    >
                      <EyeOff className="w-3 h-3" />
                      <span>Unpublish</span>
                    </button>
                  ) : (
                    <span />
                  )}
                  <button className="flex items-center gap-1.5 px-4 py-1.5 text-white bg-neutral-900 group-hover:bg-indigo-600 rounded-lg text-xs font-bold transition duration-200 cursor-pointer">
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Course</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {gate && (
        <PlatinumGate
          isVisible={!!gate}
          feature={gate.feature}
          description={gate.description}
          onClose={() => setGate(null)}
          onUpgrade={onUpgrade ?? (() => {})}
        />
      )}
    </div>
  );
}
