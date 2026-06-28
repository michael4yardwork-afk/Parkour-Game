import React, { useState, useEffect } from 'react';
import { Play, Heart, Bookmark, Search, Sparkles, Trophy, User, ArrowUpDown, BookmarkCheck } from 'lucide-react';
import { LevelConfig, SceneTheme, UserAccount } from '../types';
import { synths } from '../audio';

interface CommunityCoursesProps {
  onSelectLevel: (level: LevelConfig) => void;
  currentUser: UserAccount;
}

export default function CommunityCourses({ onSelectLevel, currentUser }: CommunityCoursesProps) {
  const [courses, setCourses] = useState<LevelConfig[]>([]);
  const [savedLevelIds, setSavedLevelIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'likes' | 'newest' | 'most_liked'>('likes');

  // Track liked courses by user locally to render toggle status cleanly
  const [likedIds, setLikedIds] = useState<string[]>([]);

  // Load all custom levels saved locally by this user to check bookmark status
  const loadSavedLevelIds = () => {
    try {
      const list = localStorage.getItem('custom_parkour_levels');
      if (list) {
        const parsed: LevelConfig[] = JSON.parse(list);
        setSavedLevelIds(parsed.map(lvl => lvl.id));
      } else {
        setSavedLevelIds([]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Load all community published courses (using unprefixed Storage namespace)
  const loadCommunityCourses = () => {
    try {
      const communityStored = localStorage.getItem('community_published_courses');
      let communityCourses: LevelConfig[] = communityStored ? JSON.parse(communityStored) : [];

      // We should dynamically count likes for each level based on community_likes_${levelId}_users
      communityCourses = communityCourses.map(course => {
        const likesKey = `community_likes_${course.id}_users`;
        const likesStored = localStorage.getItem(likesKey);
        const likedUsers: string[] = likesStored ? JSON.parse(likesStored) : [];
        return {
          ...course,
          likesCount: likedUsers.length
        };
      });

      setCourses(communityCourses);

      // Check which courses are liked by the current user
      const userLiked: string[] = [];
      communityCourses.forEach(course => {
        const likesKey = `community_likes_${course.id}_users`;
        const likesStored = localStorage.getItem(likesKey);
        const likedUsers: string[] = likesStored ? JSON.parse(likesStored) : [];
        if (likedUsers.includes(currentUser.username)) {
          userLiked.push(course.id);
        }
      });
      setLikedIds(userLiked);
    } catch (e) {
      console.error('Error loading community courses', e);
    }
  };

  useEffect(() => {
    loadCommunityCourses();
    loadSavedLevelIds();
  }, []);

  const handleLike = (level: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const likesKey = `community_likes_${level.id}_users`;
      const likesStored = localStorage.getItem(likesKey);
      let likedUsers: string[] = likesStored ? JSON.parse(likesStored) : [];

      let updatedLikes: string[];
      if (likedUsers.includes(currentUser.username)) {
        // Unlike
        updatedLikes = likedUsers.filter(u => u !== currentUser.username);
        synths.playTick();
      } else {
        // Like
        updatedLikes = [...likedUsers, currentUser.username];
        synths.playFinish();
      }

      localStorage.setItem(likesKey, JSON.stringify(updatedLikes));

      // Update in local state list
      setCourses(prev =>
        prev.map(c => {
          if (c.id === level.id) {
            return { ...c, likesCount: updatedLikes.length };
          }
          return c;
        })
      );

      // Also update is-liked lists
      if (updatedLikes.includes(currentUser.username)) {
        setLikedIds(prev => [...prev, level.id]);
      } else {
        setLikedIds(prev => prev.filter(id => id !== level.id));
      }

      // Sync likesCount back to the general community_published_courses store
      const communityStored = localStorage.getItem('community_published_courses');
      if (communityStored) {
        let list: LevelConfig[] = JSON.parse(communityStored);
        const targetIdx = list.findIndex(c => c.id === level.id);
        if (targetIdx >= 0) {
          list[targetIdx].likesCount = updatedLikes.length;
          localStorage.setItem('community_published_courses', JSON.stringify(list));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveCourse = (level: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const listStored = localStorage.getItem('custom_parkour_levels');
      let customList: LevelConfig[] = listStored ? JSON.parse(listStored) : [];

      if (customList.some(lvl => lvl.id === level.id)) {
        // Guard: make courses that the user themselves publishes unable to be removed from saved unless they are deleted
        if (level.creator && level.creator.toLowerCase().trim() === currentUser.username.toLowerCase().trim()) {
          alert(`"${level.name}" is your own published course. It cannot be removed from your saved list unless it is fully deleted from the Saved Courses tab.`);
          return;
        }
        // Already bookmarked - remove it from bookmarks
        const updated = customList.filter(lvl => lvl.id !== level.id);
        localStorage.setItem('custom_parkour_levels', JSON.stringify(updated));
        setSavedLevelIds(prev => prev.filter(id => id !== level.id));
        synths.playTick();
        alert(`"${level.name}" has been removed from your Saved Courses.`);
      } else {
        // Add to bookmarks (it preserves creator, isCustom: true)
        const toSave: LevelConfig = {
          ...level,
          isCustom: true
        };
        customList.push(toSave);
        localStorage.setItem('custom_parkour_levels', JSON.stringify(customList));
        setSavedLevelIds(prev => [...prev, level.id]);
        synths.playFinish();
        alert(`"${level.name}" bookmarked and added to your Saved Courses! You can run it there anytime.`);
      }
    } catch (e) {
      console.error(e);
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

  const getCompletionsCount = (course: LevelConfig) => {
    try {
      const stored = localStorage.getItem(`leaderboard_${course.id}`);
      const entries = stored ? JSON.parse(stored) : [];
      // Combine base likesCount (representing historical community engagement/completions) with live leaderboard runs
      return (course.likesCount || 0) + entries.length;
    } catch (e) {
      return course.likesCount || 0;
    }
  };

  // Filter and sort
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
      const diff = getCompletionsCount(b) - getCompletionsCount(a);
      if (diff !== 0) return diff;
      return (b.createdAt || 0) - (a.createdAt || 0); // Newest first fallback
    } else {
      return (b.createdAt || 0) - (a.createdAt || 0);
    }
  });

  return (
    <div id="community-courses-view" className="max-w-6xl mx-auto px-4 py-8 space-y-8 font-sans">
      
      {/* Header */}
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

        {/* Sort Trigger */}
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-neutral-400 font-mono flex items-center gap-1">
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort Order:
          </span>
          <div className="bg-neutral-100 p-1 rounded-xl flex">
            <button
              onClick={() => { setSortBy('likes'); synths.playTick(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                sortBy === 'likes' 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Most Completed
            </button>
            <button
              onClick={() => { setSortBy('most_liked'); synths.playTick(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                sortBy === 'most_liked' 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Most Liked
            </button>
            <button
              onClick={() => { setSortBy('newest'); synths.playTick(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                sortBy === 'newest' 
                  ? 'bg-white text-indigo-700 shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Newest
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3 bg-neutral-100 border border-neutral-200/50 p-2.5 rounded-2xl w-full max-w-xl shadow-inner">
        <Search className="w-4 h-4 text-neutral-400 ml-1.5 shrink-0" />
        <input
          type="text"
          placeholder="Filter courses by name, creator, or keywords..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="bg-transparent text-sm text-neutral-800 w-full focus:outline-none placeholder-neutral-400 font-medium"
        />
      </div>

      {/* Main Grid */}
      {sortedCourses.length === 0 ? (
        <div className="bg-neutral-50 border border-dashed border-neutral-200 rounded-3xl py-16 px-6 text-center max-w-xl mx-auto my-6 shadow-sm">
          <div className="w-14 h-14 bg-neutral-100 border border-neutral-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-neutral-400">
            <Sparkles className="w-6 h-6 opacity-60" />
          </div>
          <h3 className="text-base font-bold text-neutral-800">No community levels found</h3>
          <p className="text-xs text-neutral-500 mt-2 max-w-sm mx-auto leading-relaxed">
            {searchTerm 
              ? `No workshop matches found for "${searchTerm}". Try a different name or keyword.`
              : "The community lists are currently quiet. Be the first athlete to build, compile, and publish a course!"}
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
                id={`community-course-card-${course.id}`}
                onClick={() => onSelectLevel(course)}
                className="group relative bg-white border border-neutral-200/90 hover:border-neutral-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[220px]"
              >
                {/* Meta Header */}
                <div className="flex items-center justify-between mb-4.5">
                  <span className="py-0.5 px-2.5 bg-neutral-100 text-neutral-600 font-semibold font-mono text-[9px] rounded-full uppercase tracking-wider">
                    {formatTheme(course.theme)}
                  </span>
                  
                  {/* Action utilities (Like & Bookmark) */}
                  <div className="flex items-center gap-1.5 select-none">
                    {/* Save to bookmarks */}
                    <button
                      onClick={(e) => handleSaveCourse(course, e)}
                      className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                        isBookmarked 
                          ? 'bg-amber-50 text-amber-600 border-amber-200/50' 
                          : 'bg-neutral-50 border-neutral-150 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                      }`}
                      title={isBookmarked ? 'Remove course from saved list' : 'Bookmark to My Saved Courses'}
                    >
                      {isBookmarked ? (
                        <BookmarkCheck className="w-4 h-4 fill-current" />
                      ) : (
                        <Bookmark className="w-4 h-4" />
                      )}
                    </button>

                    {/* Like counter buttons */}
                    <button
                      onClick={(e) => handleLike(course, e)}
                      className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center gap-1 ${
                        isLiked 
                          ? 'bg-rose-50 text-rose-600 border-rose-200/50' 
                          : 'bg-neutral-50 border-neutral-150 text-neutral-400 hover:text-rose-600 hover:bg-rose-50'
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

                {/* Course Name / Desc */}
                <div>
                  <h3 className="text-base font-black text-neutral-850 group-hover:text-indigo-650 transition-colors duration-150 leading-tight">
                    {course.name}
                  </h3>
                  <p className="text-xs text-neutral-550 mt-1.5 lines-clamp-2 leading-relaxed">
                    {course.description || 'Custom crafted speed run.'}
                  </p>
                  
                  {/* Creator and details info */}
                  <div className="flex items-center gap-3 mt-4 text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                    <div className="flex items-center gap-1 text-teal-600" title="Course Creator">
                      <User className="w-3.5 h-3.5 shrink-0" />
                      <span>{isOurOwn ? 'You' : course.creator || 'Runner'}</span>
                    </div>
                    <span>•</span>
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span>{course.blocks.length} elements</span>
                    </div>
                  </div>
                </div>

                {/* Launch section */}
                <div className="flex items-center justify-between border-t border-neutral-150/40 pt-4 mt-5">
                  <span className="text-[10px] font-mono text-neutral-400 font-semibold italic">
                    {getCompletionsCount(course) > 0 
                      ? `${getCompletionsCount(course)} ${getCompletionsCount(course) === 1 ? 'completion' : 'completions'}`
                      : '0 completions'}
                  </span>
                  
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
    </div>
  );
}
