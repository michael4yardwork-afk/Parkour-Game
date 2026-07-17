import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Trophy, Activity, Sparkles, Clock, User, Award, Play, ChevronRight, BookmarkCheck, Heart, Check, Plus, Users, Bookmark, RefreshCw, EyeOff, Flag, Crown, Lock } from 'lucide-react';
import PlatinumGate from './PlatinumGate';
import { LevelConfig, SceneTheme, UserAccount, LeaderboardEntry } from '../types';
import { DEFAULT_LEVELS } from '../defaultLevels';
import { synths } from '../audio';
import { api } from '../api';
import { AVATAR_BGS } from '../avatarThemes';

interface UserProfileProps {
  username: string;
  currentUser: UserAccount;
  onBack: () => void;
  onSelectLevel: (level: LevelConfig) => void;
  onUpdateCurrentUser?: (updatedUser: UserAccount) => void;
  onViewProfile?: (username: string) => void;
  isPlatinum?: boolean;
  onUpgrade?: () => void;
}

// Map level IDs to their beautiful theme backgrounds
const LEVEL_THEMES: Record<string, string> = {
  tutorial_skyway: 'from-sky-500/10 to-indigo-500/10 border-indigo-500/20',
  neon_velocity: 'from-fuchsia-500/10 to-pink-500/10 border-pink-500/20',
  rust_ascent: 'from-orange-500/10 to-red-500/10 border-red-500/20',
  sunset_ridge: 'from-amber-500/10 to-rose-500/10 border-rose-500/20',
  monochrome_void: 'from-neutral-500/10 to-slate-500/10 border-slate-500/20',
  lava_patchwork: 'from-red-500/10 to-amber-600/10 border-red-500/20',
};

const AVATARS = [
  { emoji: '🚀', name: 'Speedrunner' },
  { emoji: '⚡', name: 'Volt Sprint' },
  { emoji: '🛹', name: 'Skater' },
  { emoji: '🐺', name: 'Alpha Wolf' },
  { emoji: '🐉', name: 'Dragon Master' },
  { emoji: '🤖', name: 'Cybernetic' },
  { emoji: '🐱', name: 'Ninja Cat' },
  { emoji: '🦊', name: 'Swift Fox' },
  { emoji: '🎯', name: 'Apex Precision' },
  { emoji: '🔥', name: 'Overdrive' },
  { emoji: '👑', name: 'Championship' },
  { emoji: '🦁', name: 'Primal Spirit' },
  { emoji: '🌊', name: 'Wave Rider' },
  { emoji: '💎', name: 'Diamond Rush' },
  { emoji: '🦅', name: 'Eagle Strike' },
  { emoji: '🌀', name: 'Vortex' },
  { emoji: '🎮', name: 'Player One' },
  { emoji: '🦋', name: 'Phantom' },
  { emoji: '🐲', name: 'Drake Force' },
  { emoji: '⭐', name: 'Star Dash' },
  { emoji: '🌙', name: 'Night Runner' },
  { emoji: '💀', name: 'Skull Crusher' },
  { emoji: '🦄', name: 'Unicorn Speed' },
];

const COUNTRY_FLAGS = [
  { emoji: '🇦🇫', name: 'Afghanistan' },
  { emoji: '🇦🇱', name: 'Albania' },
  { emoji: '🇩🇿', name: 'Algeria' },
  { emoji: '🇦🇩', name: 'Andorra' },
  { emoji: '🇦🇴', name: 'Angola' },
  { emoji: '🇦🇬', name: 'Antigua and Barbuda' },
  { emoji: '🇦🇷', name: 'Argentina' },
  { emoji: '🇦🇲', name: 'Armenia' },
  { emoji: '🇦🇺', name: 'Australia' },
  { emoji: '🇦🇹', name: 'Austria' },
  { emoji: '🇦🇿', name: 'Azerbaijan' },
  { emoji: '🇧🇸', name: 'Bahamas' },
  { emoji: '🇧🇭', name: 'Bahrain' },
  { emoji: '🇧🇩', name: 'Bangladesh' },
  { emoji: '🇧🇧', name: 'Barbados' },
  { emoji: '🇧🇾', name: 'Belarus' },
  { emoji: '🇧🇪', name: 'Belgium' },
  { emoji: '🇧🇿', name: 'Belize' },
  { emoji: '🇧🇯', name: 'Benin' },
  { emoji: '🇧🇹', name: 'Bhutan' },
  { emoji: '🇧🇴', name: 'Bolivia' },
  { emoji: '🇧🇦', name: 'Bosnia and Herzegovina' },
  { emoji: '🇧🇼', name: 'Botswana' },
  { emoji: '🇧🇷', name: 'Brazil' },
  { emoji: '🇧🇳', name: 'Brunei' },
  { emoji: '🇧🇬', name: 'Bulgaria' },
  { emoji: '🇧🇫', name: 'Burkina Faso' },
  { emoji: '🇧🇮', name: 'Burundi' },
  { emoji: '🇨🇻', name: 'Cabo Verde' },
  { emoji: '🇰🇭', name: 'Cambodia' },
  { emoji: '🇨🇲', name: 'Cameroon' },
  { emoji: '🇨🇦', name: 'Canada' },
  { emoji: '🇨🇫', name: 'Central African Republic' },
  { emoji: '🇹🇩', name: 'Chad' },
  { emoji: '🇨🇱', name: 'Chile' },
  { emoji: '🇨🇳', name: 'China' },
  { emoji: '🇨🇴', name: 'Colombia' },
  { emoji: '🇰🇲', name: 'Comoros' },
  { emoji: '🇨🇬', name: 'Congo' },
  { emoji: '🇨🇩', name: 'Congo (DRC)' },
  { emoji: '🇨🇷', name: 'Costa Rica' },
  { emoji: '🇭🇷', name: 'Croatia' },
  { emoji: '🇨🇺', name: 'Cuba' },
  { emoji: '🇨🇾', name: 'Cyprus' },
  { emoji: '🇨🇿', name: 'Czechia' },
  { emoji: '🇩🇰', name: 'Denmark' },
  { emoji: '🇩🇯', name: 'Djibouti' },
  { emoji: '🇩🇲', name: 'Dominica' },
  { emoji: '🇩🇴', name: 'Dominican Republic' },
  { emoji: '🇪🇨', name: 'Ecuador' },
  { emoji: '🇪🇬', name: 'Egypt' },
  { emoji: '🇸🇻', name: 'El Salvador' },
  { emoji: '🇬🇶', name: 'Equatorial Guinea' },
  { emoji: '🇪🇷', name: 'Eritrea' },
  { emoji: '🇪🇪', name: 'Estonia' },
  { emoji: '🇸🇿', name: 'Eswatini' },
  { emoji: '🇪🇹', name: 'Ethiopia' },
  { emoji: '🇫🇯', name: 'Fiji' },
  { emoji: '🇫🇮', name: 'Finland' },
  { emoji: '🇫🇷', name: 'France' },
  { emoji: '🇬🇦', name: 'Gabon' },
  { emoji: '🇬🇲', name: 'Gambia' },
  { emoji: '🇬🇪', name: 'Georgia' },
  { emoji: '🇩🇪', name: 'Germany' },
  { emoji: '🇬🇭', name: 'Ghana' },
  { emoji: '🇬🇷', name: 'Greece' },
  { emoji: '🇬🇩', name: 'Grenada' },
  { emoji: '🇬🇹', name: 'Guatemala' },
  { emoji: '🇬🇳', name: 'Guinea' },
  { emoji: '🇬🇼', name: 'Guinea-Bissau' },
  { emoji: '🇬🇾', name: 'Guyana' },
  { emoji: '🇭🇹', name: 'Haiti' },
  { emoji: '🇭🇳', name: 'Honduras' },
  { emoji: '🇭🇺', name: 'Hungary' },
  { emoji: '🇮🇸', name: 'Iceland' },
  { emoji: '🇮🇳', name: 'India' },
  { emoji: '🇮🇩', name: 'Indonesia' },
  { emoji: '🇮🇷', name: 'Iran' },
  { emoji: '🇮🇶', name: 'Iraq' },
  { emoji: '🇮🇪', name: 'Ireland' },
  { emoji: '🇮🇱', name: 'Israel' },
  { emoji: '🇮🇹', name: 'Italy' },
  { emoji: '🇯🇲', name: 'Jamaica' },
  { emoji: '🇯🇵', name: 'Japan' },
  { emoji: '🇯🇴', name: 'Jordan' },
  { emoji: '🇰🇿', name: 'Kazakhstan' },
  { emoji: '🇰🇪', name: 'Kenya' },
  { emoji: '🇰🇮', name: 'Kiribati' },
  { emoji: '🇰🇵', name: 'North Korea' },
  { emoji: '🇰🇷', name: 'South Korea' },
  { emoji: '🇽🇰', name: 'Kosovo' },
  { emoji: '🇰🇼', name: 'Kuwait' },
  { emoji: '🇰🇬', name: 'Kyrgyzstan' },
  { emoji: '🇱🇦', name: 'Laos' },
  { emoji: '🇱🇻', name: 'Latvia' },
  { emoji: '🇱🇧', name: 'Lebanon' },
  { emoji: '🇱🇸', name: 'Lesotho' },
  { emoji: '🇱🇷', name: 'Liberia' },
  { emoji: '🇱🇾', name: 'Libya' },
  { emoji: '🇱🇮', name: 'Liechtenstein' },
  { emoji: '🇱🇹', name: 'Lithuania' },
  { emoji: '🇱🇺', name: 'Luxembourg' },
  { emoji: '🇲🇬', name: 'Madagascar' },
  { emoji: '🇲🇼', name: 'Malawi' },
  { emoji: '🇲🇾', name: 'Malaysia' },
  { emoji: '🇲🇻', name: 'Maldives' },
  { emoji: '🇲🇱', name: 'Mali' },
  { emoji: '🇲🇹', name: 'Malta' },
  { emoji: '🇲🇭', name: 'Marshall Islands' },
  { emoji: '🇲🇷', name: 'Mauritania' },
  { emoji: '🇲🇺', name: 'Mauritius' },
  { emoji: '🇲🇽', name: 'Mexico' },
  { emoji: '🇫🇲', name: 'Micronesia' },
  { emoji: '🇲🇩', name: 'Moldova' },
  { emoji: '🇲🇨', name: 'Monaco' },
  { emoji: '🇲🇳', name: 'Mongolia' },
  { emoji: '🇲🇪', name: 'Montenegro' },
  { emoji: '🇲🇦', name: 'Morocco' },
  { emoji: '🇲🇿', name: 'Mozambique' },
  { emoji: '🇲🇲', name: 'Myanmar' },
  { emoji: '🇳🇦', name: 'Namibia' },
  { emoji: '🇳🇷', name: 'Nauru' },
  { emoji: '🇳🇵', name: 'Nepal' },
  { emoji: '🇳🇱', name: 'Netherlands' },
  { emoji: '🇳🇿', name: 'New Zealand' },
  { emoji: '🇳🇮', name: 'Nicaragua' },
  { emoji: '🇳🇪', name: 'Niger' },
  { emoji: '🇳🇬', name: 'Nigeria' },
  { emoji: '🇲🇰', name: 'North Macedonia' },
  { emoji: '🇳🇴', name: 'Norway' },
  { emoji: '🇴🇲', name: 'Oman' },
  { emoji: '🇵🇰', name: 'Pakistan' },
  { emoji: '🇵🇼', name: 'Palau' },
  { emoji: '🇵🇸', name: 'Palestine' },
  { emoji: '🇵🇦', name: 'Panama' },
  { emoji: '🇵🇬', name: 'Papua New Guinea' },
  { emoji: '🇵🇾', name: 'Paraguay' },
  { emoji: '🇵🇪', name: 'Peru' },
  { emoji: '🇵🇭', name: 'Philippines' },
  { emoji: '🇵🇱', name: 'Poland' },
  { emoji: '🇵🇹', name: 'Portugal' },
  { emoji: '🇶🇦', name: 'Qatar' },
  { emoji: '🇷🇴', name: 'Romania' },
  { emoji: '🇷🇺', name: 'Russia' },
  { emoji: '🇷🇼', name: 'Rwanda' },
  { emoji: '🇰🇳', name: 'Saint Kitts and Nevis' },
  { emoji: '🇱🇨', name: 'Saint Lucia' },
  { emoji: '🇻🇨', name: 'Saint Vincent and the Grenadines' },
  { emoji: '🇼🇸', name: 'Samoa' },
  { emoji: '🇸🇲', name: 'San Marino' },
  { emoji: '🇸🇹', name: 'São Tomé and Príncipe' },
  { emoji: '🇸🇦', name: 'Saudi Arabia' },
  { emoji: '🇸🇳', name: 'Senegal' },
  { emoji: '🇷🇸', name: 'Serbia' },
  { emoji: '🇸🇨', name: 'Seychelles' },
  { emoji: '🇸🇱', name: 'Sierra Leone' },
  { emoji: '🇸🇬', name: 'Singapore' },
  { emoji: '🇸🇰', name: 'Slovakia' },
  { emoji: '🇸🇮', name: 'Slovenia' },
  { emoji: '🇸🇧', name: 'Solomon Islands' },
  { emoji: '🇸🇴', name: 'Somalia' },
  { emoji: '🇿🇦', name: 'South Africa' },
  { emoji: '🇸🇸', name: 'South Sudan' },
  { emoji: '🇪🇸', name: 'Spain' },
  { emoji: '🇱🇰', name: 'Sri Lanka' },
  { emoji: '🇸🇩', name: 'Sudan' },
  { emoji: '🇸🇷', name: 'Suriname' },
  { emoji: '🇸🇪', name: 'Sweden' },
  { emoji: '🇨🇭', name: 'Switzerland' },
  { emoji: '🇸🇾', name: 'Syria' },
  { emoji: '🇹🇼', name: 'Taiwan' },
  { emoji: '🇹🇯', name: 'Tajikistan' },
  { emoji: '🇹🇿', name: 'Tanzania' },
  { emoji: '🇹🇭', name: 'Thailand' },
  { emoji: '🇹🇱', name: 'Timor-Leste' },
  { emoji: '🇹🇬', name: 'Togo' },
  { emoji: '🇹🇴', name: 'Tonga' },
  { emoji: '🇹🇹', name: 'Trinidad and Tobago' },
  { emoji: '🇹🇳', name: 'Tunisia' },
  { emoji: '🇹🇷', name: 'Turkey' },
  { emoji: '🇹🇲', name: 'Turkmenistan' },
  { emoji: '🇹🇻', name: 'Tuvalu' },
  { emoji: '🇺🇬', name: 'Uganda' },
  { emoji: '🇺🇦', name: 'Ukraine' },
  { emoji: '🇦🇪', name: 'United Arab Emirates' },
  { emoji: '🇬🇧', name: 'United Kingdom' },
  { emoji: '🇺🇸', name: 'United States' },
  { emoji: '🇺🇾', name: 'Uruguay' },
  { emoji: '🇺🇿', name: 'Uzbekistan' },
  { emoji: '🇻🇺', name: 'Vanuatu' },
  { emoji: '🇻🇦', name: 'Vatican City' },
  { emoji: '🇻🇪', name: 'Venezuela' },
  { emoji: '🇻🇳', name: 'Vietnam' },
  { emoji: '🇾🇪', name: 'Yemen' },
  { emoji: '🇿🇲', name: 'Zambia' },
  { emoji: '🇿🇼', name: 'Zimbabwe' },
  { emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', name: 'England' },
  { emoji: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', name: 'Scotland' },
  { emoji: '🏴󠁧󠁢󠁷󠁬󠁳󠁿', name: 'Wales' },
];

const formatWR = (seconds: number): string => {
  const totalMs = Math.round(seconds * 1000);
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${m > 0 ? `${m}:` : ''}${s.toString().padStart(m > 0 ? 2 : 1, '0')}.${ms.toString().padStart(3, '0')}s`;
};

export default function UserProfile({ username, currentUser, onBack, onSelectLevel, onUpdateCurrentUser, onViewProfile, isPlatinum, onUpgrade }: UserProfileProps) {
  const [gate, setGate] = useState<{ feature: string; description?: string } | null>(null);
  const [profileIsPlatinum, setProfileIsPlatinum] = useState(false);
  const [resolvedName, setResolvedName] = useState(username);
  const [avatarInfo, setAvatarInfo] = useState({ avatar: '🚀', avatarBg: 'bg-rose-500' });
  const [racingElo, setRacingElo] = useState(100);
  const [publishedCourses, setPublishedCourses] = useState<LevelConfig[]>([]);
  const [savedLevelIds, setSavedLevelIds] = useState<string[]>([]);
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [wrMap, setWrMap] = useState<Record<string, string | null>>({});
  const [completionsMap, setCompletionsMap] = useState<Record<string, number>>({});
  const [courseStats, setCourseStats] = useState<Record<string, { pbTime: number | null; rank: number | null; totalPlayers: number | null; percentile: number | null }>>({});
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [showFlagPicker, setShowFlagPicker] = useState(false);
  const [flagSearch, setFlagSearch] = useState('');

  const selectAvatar = (emoji: string) => {
    if (onUpdateCurrentUser) {
      synths.playTick();
      onUpdateCurrentUser({
        ...currentUser,
        avatar: emoji,
      });
    }
  };

  const selectBg = (bgValue: string) => {
    if (onUpdateCurrentUser) {
      synths.playTick();
      onUpdateCurrentUser({
        ...currentUser,
        avatarBg: bgValue,
      });
    }
  };

  // Helper to format completion times
  const formatSecs = (secs: number | null) => {
    if (secs === null || secs <= 0.05) return 'No Time';
    const totalMilliseconds = Math.round(secs * 1000);
    const m = Math.floor(totalMilliseconds / 60000);
    const s = Math.floor((totalMilliseconds % 60000) / 1000);
    const ms = totalMilliseconds % 1000;
    return `${m > 0 ? `${m}:` : ''}${s.toString().padStart(m > 0 ? 2 : 1, '0')}.${ms.toString().padStart(3, '0')}s`;
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

  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    const normName = username.toLowerCase().trim();
    const isSelfView = currentUser.username.toLowerCase().trim() === normName;

    try {
      // If viewing self, use local user data directly
      if (isSelfView) {
        setResolvedName(currentUser.username);
        setAvatarInfo({ avatar: currentUser.avatar || '🚀', avatarBg: currentUser.avatarBg || 'bg-rose-500' });
      }

      // Load profile from API (follower counts, following status, published courses, rating)
      const profileData = await api.users.getProfile(username);
      if (profileData) {
        if (!isSelfView) {
          setResolvedName(profileData.user.username);
          setAvatarInfo({ avatar: profileData.user.avatar || '🚀', avatarBg: profileData.user.avatarBg || 'bg-rose-500' });
        }
        setRacingElo(profileData.rating || 100);
        setPublishedCourses(profileData.courses || []);
        setFollowerCount(profileData.followersCount || 0);
        setIsFollowing(profileData.isFollowing || false);
        setProfileIsPlatinum((profileData as any).isPlatinum ?? false);
      } else {
        // Fallback for users not found via API
        setResolvedName(username);
        const emojis = ['🚀', '⚡', '🛹', '🐺', '🐉', '🤖', '🐱', '🦊', '🎯', '🔥', '👑', '🦁', '🌊', '💎', '🦅', '🌀', '🎮', '🦋', '🐲', '⭐', '🌙', '💀', '🦄'];
        const bgs = ['bg-rose-500', 'bg-green-500', 'bg-purple-500', 'bg-blue-500', 'bg-amber-500', 'bg-indigo-505'];
        let hash = 0;
        for (let i = 0; i < normName.length; i++) hash = normName.charCodeAt(i) + ((hash << 5) - hash);
        hash = Math.abs(hash);
        setAvatarInfo({ avatar: emojis[hash % emojis.length], avatarBg: bgs[hash % bgs.length] });
      }

      // Load bookmarked course IDs from API
      const { bookmarkedIds } = await api.community.getCourses();
      setSavedLevelIds(bookmarkedIds);

      // Load which published courses are liked by current user
      const { likedIds: fetchedLikes } = await api.community.getCourses();
      setLikedIds(fetchedLikes);

      // Load leaderboard stats for default levels
      const statsMap: Record<string, any> = {};
      const leaderboardPromises = DEFAULT_LEVELS.slice(0, 6).map(async (level) => {
        try {
          const entries = await api.leaderboard.get(level.id);
          const validEntries = entries.filter(e => e.time > 0.05);
          const playerRuns = validEntries.filter(e => e.playerName.toLowerCase().trim() === normName);
          let pbTime = playerRuns.length > 0 ? Math.min(...playerRuns.map(r => r.time)) : null;

          if (isSelfView) {
            const pbStored = localStorage.getItem(`best_time_${level.id}`);
            if (pbStored) {
              const pbVal = parseFloat(pbStored);
              if (pbVal > 0.05 && (pbTime === null || pbVal < pbTime)) pbTime = pbVal;
            }
          }

          if (pbTime === null) {
            statsMap[level.id] = { pbTime: null, rank: null, totalPlayers: null, percentile: null };
            return;
          }

          const playerBests: Record<string, number> = {};
          validEntries.forEach(r => {
            const name = r.playerName.toLowerCase().trim();
            if (!playerBests[name] || r.time < playerBests[name]) playerBests[name] = r.time;
          });
          if (!playerBests[normName] || pbTime < playerBests[normName]) playerBests[normName] = pbTime;

          const sortedTimes = Object.values(playerBests).sort((a, b) => a - b);
          const rank = sortedTimes.indexOf(pbTime) + 1;
          const totalPlayers = sortedTimes.length;
          const percentile = totalPlayers > 1 ? Math.round((sortedTimes.indexOf(pbTime) / (totalPlayers - 1)) * 100) : 0;
          statsMap[level.id] = { pbTime, rank, totalPlayers, percentile };
        } catch {
          statsMap[level.id] = { pbTime: null, rank: null, totalPlayers: null, percentile: null };
        }
      });
      await Promise.all(leaderboardPromises);
      setCourseStats(statsMap);
    } catch (e) {
      console.error('Failed to load profile:', e);
    } finally {
      setProfileLoading(false);
    }
  }, [username, currentUser]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // Load WR times and completion counts for published courses
  useEffect(() => {
    if (publishedCourses.length === 0) return;
    Promise.all(
      publishedCourses.map(async (c) => {
        try {
          const entries = await api.leaderboard.get(c.id);
          const wr = entries.length > 0 ? formatWR(entries[0].time) : null;
          return [c.id, wr, entries.length] as const;
        } catch {
          return [c.id, null, 0] as const;
        }
      })
    ).then(results => {
      const newWrMap: Record<string, string | null> = {};
      const newCompletions: Record<string, number> = {};
      results.forEach(([id, wr, count]) => {
        newWrMap[id] = wr;
        newCompletions[id] = count;
      });
      setWrMap(newWrMap);
      setCompletionsMap(newCompletions);
    });
  }, [publishedCourses]);

  const handleUnpublish = async (course: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Unpublish "${course.name}"? It will be removed from the community workshop but kept in your saved courses.`)) return;
    try {
      await api.community.unpublishCourse(course.id);
      setPublishedCourses(prev => prev.filter(c => c.id !== course.id));
      synths.playTick();
    } catch (err: any) {
      console.error('Failed to unpublish course:', err);
      alert(err.message || 'Failed to unpublish course.');
    }
  };

  const handleToggleFollow = async () => {
    // Gate: free-plan users cannot receive followers. Show the gate before calling the API.
    if (!isFollowing && !profileIsPlatinum) {
      setGate({ feature: 'Following Players', description: 'Only Platinum members can be followed. This player needs to upgrade before others can follow them.' });
      return;
    }
    try {
      const { following } = await api.users.toggleFollow(resolvedName);
      setIsFollowing(following);
      setFollowerCount(prev => following ? prev + 1 : Math.max(0, prev - 1));
      if (following) synths.playFinish(); else synths.playTick();
    } catch (e: any) {
      if (e.message === 'platinum_required') {
        setGate({ feature: 'Following Players', description: 'Only Platinum members can be followed by others.' });
      } else {
        console.error('Failed to toggle follow:', e);
      }
    }
  };

  const handleRunPublishedCourse = (level: LevelConfig) => {
    synths.playTick();
    onSelectLevel(level);
  };

  const handleLike = async (level: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const { liked, likesCount } = await api.community.toggleLike(level.id);
      setPublishedCourses(prev => prev.map(c => c.id === level.id ? { ...c, likesCount } : c));
      if (liked) {
        setLikedIds(prev => [...prev, level.id]);
        synths.playFinish();
      } else {
        setLikedIds(prev => prev.filter(id => id !== level.id));
        synths.playTick();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const isSelf = resolvedName.toLowerCase().trim() === currentUser.username.toLowerCase().trim();

  const handleSaveCourse = async (level: LevelConfig, e: React.MouseEvent) => {
    e.stopPropagation();
    const isOwner = level.creator?.toLowerCase().trim() === currentUser.username.toLowerCase().trim();
    const isBookmarked = savedLevelIds.includes(level.id);
    if (isBookmarked && isOwner) {
      alert(`"${level.name}" is your own published course. Delete it from Saved Courses to remove it.`);
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
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 font-sans">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            synths.playTick();
            onBack();
          }}
          className="flex items-center gap-2 px-3.5 py-2 text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-200/80 rounded-xl text-xs font-bold shadow-sm transition hover:scale-[1.02] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-neutral-500" />
          <span>Back</span>
        </button>

        <span className="text-xs font-mono font-bold text-neutral-400 uppercase tracking-widest">
          Athlete Dossier
        </span>
      </div>

      {/* Hero Card */}
      <div className="bg-white border border-neutral-200/80 rounded-3xl p-5 md:p-6 shadow-sm flex flex-col md:flex-row items-center gap-5 md:gap-6 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* Profile Avatar */}
        <div
          onClick={() => {
            if (isSelf) {
              synths.playTick();
              setShowCustomizer(prev => !prev);
            }
          }}
          className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center text-3xl md:text-4xl border border-neutral-150 shadow-sm ${avatarInfo.avatarBg} select-none shrink-0 transition-all duration-300 hover:rotate-3 relative ${isSelf ? 'cursor-pointer hover:scale-105 active:scale-95 hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/15 group/avatar' : ''}`}
          title={isSelf ? 'Click to customize profile icon' : undefined}
        >
          {avatarInfo.avatar}
          {isSelf && (
            <div className="absolute -bottom-1.5 -right-1.5 bg-neutral-900 text-white p-1 rounded-lg border border-neutral-700 shadow-md transition-transform duration-200 group-hover/avatar:scale-110 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-pencil"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </div>
          )}
        </div>

        {/* Info Column */}
        <div className="text-center md:text-left space-y-3 flex-1 w-full">
          <div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-neutral-900 tracking-tight leading-none">
                {resolvedName}
              </h1>
              {isSelf ? (
                <span className="self-center md:self-auto py-0.5 px-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold font-mono text-[9px] rounded-full uppercase tracking-wider w-fit mx-auto md:mx-0">
                  You / Active Athlete
                </span>
              ) : (
                <span className="self-center md:self-auto py-0.5 px-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 font-bold font-mono text-[9px] rounded-full uppercase tracking-wider w-fit mx-auto md:mx-0">
                  Registered Competitor
                </span>
              )}
            </div>
          </div>

          {/* Elo Badge */}
          <div className="flex flex-wrap justify-center md:justify-start gap-3">
            <div className="flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 rounded-xl shadow-sm">
              <Trophy className="w-4 h-4 text-amber-400 animate-pulse" />
              <div className="text-left font-mono">
                <div className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider leading-none">Racing ELO</div>
                <div className="text-base font-black text-white leading-none mt-0.5">{racingElo}</div>
              </div>
            </div>

            {/* Followers Badge */}
            <div className="flex items-center gap-2 bg-neutral-100 border border-neutral-200 text-neutral-800 px-4 py-2 rounded-xl shadow-sm">
              <Users className="w-4 h-4 text-indigo-600" />
              <div className="text-left font-mono">
                <div className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider leading-none">Followers</div>
                <div className="text-base font-black text-neutral-800 leading-none mt-0.5">{followerCount}</div>
              </div>
            </div>

            {!isSelf && (
              <button
                onClick={handleToggleFollow}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition duration-200 cursor-pointer shadow-sm border ${
                  isFollowing 
                    ? 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border-neutral-300' 
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 hover:scale-[1.02]'
                }`}
              >
                {isFollowing ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span>Following</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 text-white" />
                    <span>Follow</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Icon Customization Drawer */}
      <AnimatePresence>
        {showCustomizer && isSelf && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="bg-neutral-50 border border-neutral-200/80 rounded-3xl p-5 md:p-6 shadow-sm space-y-5 overflow-hidden"
          >
            <div className="flex items-center justify-between border-b border-neutral-200/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-500/10 text-indigo-600 rounded-lg">
                  <svg xmlns="http://www.w3.org/2500/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-smile"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>
                </span>
                <h3 className="text-sm font-black text-neutral-800 uppercase tracking-wide">
                  CUSTOMIZE ICON
                </h3>
              </div>
              <button
                onClick={() => {
                  synths.playTick();
                  setShowCustomizer(false);
                }}
                className="text-xs font-bold text-neutral-400 hover:text-neutral-600 px-3 py-1.5 hover:bg-neutral-200/60 rounded-lg transition"
              >
                Done
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Emojis selection */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block text-left">
                  Signature Emoji Glyph
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {AVATARS.map((avatar, idx) => {
                    const isLocked = idx >= 6 && !isPlatinum;
                    const isSelected = currentUser.avatar === avatar.emoji;
                    return (
                      <button
                        key={avatar.emoji}
                        onClick={() => {
                          if (isLocked) {
                            setGate({ feature: 'Extra Icon Emojis', description: 'Unlock 17 additional emoji icons and country flags for your profile icon.' });
                            return;
                          }
                          selectAvatar(avatar.emoji);
                        }}
                        className={`py-2 rounded-xl text-lg flex items-center justify-center border transition relative ${
                          isSelected
                            ? 'bg-indigo-600/10 border-indigo-600 scale-105 shadow-sm cursor-pointer'
                            : isLocked
                            ? 'bg-neutral-50 border-neutral-150 cursor-default'
                            : 'bg-white border-neutral-250 hover:border-neutral-400 cursor-pointer'
                        }`}
                        title={isLocked ? `${avatar.name} — Platinum only` : avatar.name}
                      >
                        <span className={isLocked ? 'opacity-40 grayscale' : ''}>{avatar.emoji}</span>
                        {idx >= 6 && !isPlatinum && (
                          <Lock className="w-2.5 h-2.5 absolute bottom-0.5 right-0.5 text-neutral-400" />
                        )}
                      </button>
                    );
                  })}
                  {/* Flag picker trigger — Platinum only */}
                  {(() => {
                    const flagLocked = !isPlatinum;
                    const hasFlag = COUNTRY_FLAGS.some(f => f.emoji === currentUser.avatar);
                    return (
                      <button
                        onClick={() => {
                          if (flagLocked) {
                            setGate({ feature: 'Country Flag Icons', description: 'Unlock all country flag emojis for your profile icon.' });
                            return;
                          }
                          synths.playTick();
                          setShowFlagPicker(prev => !prev);
                          setFlagSearch('');
                        }}
                        className={`py-2 rounded-xl text-lg flex items-center justify-center border transition relative ${
                          hasFlag
                            ? 'bg-indigo-600/10 border-indigo-600 scale-105 shadow-sm cursor-pointer'
                            : showFlagPicker
                            ? 'bg-neutral-100 border-neutral-400 cursor-pointer'
                            : flagLocked
                            ? 'bg-neutral-50 border-neutral-150 cursor-default'
                            : 'bg-white border-neutral-250 hover:border-neutral-400 cursor-pointer'
                        }`}
                        title={flagLocked ? 'Country Flag — Platinum only' : 'Country Flag'}
                      >
                        <span className={flagLocked ? 'opacity-40 grayscale' : ''}>
                          {hasFlag ? currentUser.avatar : '🌍'}
                        </span>
                        {flagLocked ? (
                          <Lock className="w-2.5 h-2.5 absolute bottom-0.5 right-0.5 text-neutral-400" />
                        ) : (
                          <span className="absolute bottom-0.5 right-1 text-[7px] font-black text-neutral-400 leading-none select-none">▾</span>
                        )}
                      </button>
                    );
                  })()}
                </div>

                {/* Flag picker dropdown */}
                {showFlagPicker && (
                  <div className="mt-1 bg-white border border-neutral-200 rounded-xl p-3 shadow-lg">
                    <div className="flex items-center gap-2 mb-2.5">
                      <input
                        type="text"
                        placeholder="Search flag…"
                        value={flagSearch}
                        onChange={(e) => setFlagSearch(e.target.value)}
                        className="flex-1 text-xs border border-neutral-200 rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:border-indigo-400 bg-neutral-50"
                        autoFocus
                      />
                      {flagSearch && (
                        <button
                          onClick={() => setFlagSearch('')}
                          className="text-[10px] font-bold text-neutral-400 hover:text-neutral-600 px-2 py-1.5 hover:bg-neutral-100 rounded-lg transition cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1 max-h-44 overflow-y-auto pr-0.5">
                      {COUNTRY_FLAGS.filter(f =>
                        f.name.toLowerCase().includes(flagSearch.toLowerCase())
                      ).map((flag) => (
                        <button
                          key={flag.emoji}
                          onClick={() => {
                            selectAvatar(flag.emoji);
                            setShowFlagPicker(false);
                            setFlagSearch('');
                          }}
                          className={`py-1.5 rounded-lg text-xl flex items-center justify-center border transition cursor-pointer ${
                            currentUser.avatar === flag.emoji
                              ? 'bg-indigo-600/10 border-indigo-500 scale-105 shadow-sm'
                              : 'bg-neutral-50 border-transparent hover:border-neutral-300 hover:bg-neutral-100'
                          }`}
                          title={flag.name}
                        >
                          {flag.emoji}
                        </button>
                      ))}
                      {COUNTRY_FLAGS.filter(f =>
                        f.name.toLowerCase().includes(flagSearch.toLowerCase())
                      ).length === 0 && (
                        <div className="col-span-full text-center text-[10px] font-mono text-neutral-400 py-4 italic">
                          No countries match "{flagSearch}"
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Theme selection */}
              <div className="space-y-2.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-400 block text-left">
                  Icon Theme Background
                </span>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_BGS.map((bg) => {
                    const bgLocked = bg.special && !isPlatinum;
                    return (
                      <div key={bg.value} className="relative">
                        <button
                          title={bgLocked ? `${bg.label} — Platinum only` : bg.label}
                          onClick={() => {
                            if (bg.special && !isPlatinum) {
                              setGate({ feature: 'Special Icon Backgrounds', description: 'Unlock exclusive gradient, metallic, and pattern backgrounds for your profile icon.' });
                              return;
                            }
                            selectBg(bg.value);
                          }}
                          className={`w-8 h-8 rounded-full border-2 overflow-hidden relative flex items-center justify-center transition ${bgLocked ? 'cursor-default' : 'cursor-pointer'} ${bg.value} ${
                            bg.value === (currentUser.avatarBg || 'bg-rose-500')
                              ? 'border-white scale-110 shadow-md'
                              : 'border-transparent hover:scale-105 hover:border-white/50'
                          }`}
                        >
                          {bg.special && (
                            <span
                              className={`absolute inset-0 ${bg.class} ${bgLocked ? 'opacity-40 grayscale' : ''}`}
                              aria-hidden="true"
                            />
                          )}
                          {bg.value === (currentUser.avatarBg || 'bg-rose-500') && (
                            <svg className={`w-3.5 h-3.5 drop-shadow relative z-10 ${bg.value === 'bg-white' ? 'text-neutral-700' : 'text-white'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                        </button>
                        {bg.special && (
                          bgLocked
                            ? <Lock className="w-2.5 h-2.5 absolute -top-1 -right-1 text-neutral-400 drop-shadow pointer-events-none" />
                            : <Sparkles className="w-2.5 h-2.5 absolute -top-1 -right-1 text-yellow-300 drop-shadow pointer-events-none" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 6 default rush! courses section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
          <Award className="w-5 h-5 text-indigo-600 shrink-0" />
          <h2 className="text-lg font-black text-neutral-900 tracking-tight uppercase">
            Rush! Course Records
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {DEFAULT_LEVELS.slice(0, 6).map((lvl) => {
            const stats = courseStats[lvl.id] || { pbTime: null, rank: null, totalPlayers: null, percentile: null };
            const themeClass = LEVEL_THEMES[lvl.id] || 'from-neutral-500/10 to-slate-500/10 border-neutral-200/60';

            return (
              <div
                key={lvl.id}
                className={`bg-gradient-to-br ${themeClass} border p-5 rounded-2xl flex flex-col justify-between shadow-sm relative overflow-hidden`}
              >
                {/* Course Name */}
                <div className="space-y-1 relative z-10">
                  <span className="text-[9px] font-mono font-bold text-neutral-400 uppercase tracking-widest block">
                    STAGE COURSE
                  </span>
                  <h3 className="text-sm font-black text-neutral-800 tracking-tight leading-tight uppercase">
                    {lvl.name}
                  </h3>
                </div>

                {/* Performance Metrics */}
                <div className="mt-5 space-y-4 relative z-10">
                  {stats.pbTime !== null ? (
                    <>
                      <div>
                        <div className="text-[9px] font-mono text-neutral-400 font-bold uppercase tracking-wider">
                          Personal Best Time
                        </div>
                        <div className="text-xl font-black font-mono text-neutral-850 mt-0.5">
                          {formatSecs(stats.pbTime)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-neutral-200/30 pt-3 text-[10px] font-mono">
                        <div className="flex items-center gap-1 text-amber-600 font-bold">
                          <Trophy className="w-3.5 h-3.5" />
                          <span>World Rank: #{stats.rank}</span>
                        </div>
                        <div className="bg-indigo-500/10 text-indigo-700 px-1.5 py-0.5 rounded font-black">
                          Top {stats.percentile}%
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-2.5">
                      <div className="text-xs font-semibold text-neutral-400 font-mono italic flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>No run completed yet</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Published Courses Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
          <Activity className="w-5 h-5 text-indigo-600 shrink-0" />
          <h2 className="text-lg font-black text-neutral-900 tracking-tight uppercase">
            Published Community Courses
          </h2>
        </div>

        {publishedCourses.length === 0 ? (
          <div className="bg-white border border-neutral-200/60 rounded-3xl p-8 text-center text-neutral-500 shadow-sm">
            <div className="w-12 h-12 bg-neutral-100 rounded-xl flex items-center justify-center mx-auto mb-3 text-neutral-400">
              <Sparkles className="w-5 h-5 opacity-60" />
            </div>
            <h3 className="text-sm font-bold text-neutral-800">No custom courses published</h3>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              This athlete hasn't published any courses to the community workshop yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {publishedCourses.map((course) => {
              const isLiked = likedIds.includes(course.id);
              const isBookmarked = savedLevelIds.includes(course.id);
              const isOurOwn = course.creator?.toLowerCase().trim() === currentUser.username.toLowerCase().trim();
              const completionsCount = completionsMap[course.id] ?? 0;

              return (
                <div
                  key={course.id}
                  onClick={() => handleRunPublishedCourse(course)}
                  className="group relative bg-white border border-neutral-200/90 hover:border-neutral-300 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between min-h-[220px]"
                >
                  {/* Header: WR badge + action buttons — identical to CommunityCourses */}
                  <div className="flex items-center justify-between mb-4.5">
                    <span className="py-0.5 px-2.5 bg-neutral-100 text-neutral-600 font-semibold font-mono text-[9px] rounded-full tracking-wider">
                      {course.id in wrMap
                        ? (wrMap[course.id] ? `WR ${wrMap[course.id]}` : 'No WR')
                        : '…'}
                    </span>

                    <div className="flex items-center gap-1.5 select-none">
                      <button
                        onClick={(e) => handleSaveCourse(course, e)}
                        className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                          isBookmarked ? 'bg-amber-50 text-amber-600 border-amber-200/50' : 'bg-neutral-50 border-neutral-150 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                        }`}
                        title={isBookmarked ? 'Remove course from saved list' : 'Bookmark to My Saved Courses'}
                      >
                        {isBookmarked ? <BookmarkCheck className="w-4 h-4 fill-current" /> : <Bookmark className="w-4 h-4" />}
                      </button>

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

                  {/* Body — identical to CommunityCourses */}
                  <div>
                    <h3 className="text-base font-black text-neutral-850 group-hover:text-indigo-650 transition-colors duration-150 leading-tight">
                      {course.name}
                    </h3>

                    <div className="flex items-center gap-3 mt-4 text-[10px] font-mono font-bold text-neutral-400 uppercase tracking-wider">
                      <div
                        onClick={(e) => { e.stopPropagation(); synths.playTick(); onViewProfile?.(isOurOwn ? currentUser.username : (course.creator || 'Runner')); }}
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
                      <span>•</span>
                      <div className="flex items-center gap-1.5">
                        <Flag className="w-3 h-3 text-emerald-500" />
                        <span>{completionsCount} {completionsCount === 1 ? 'run' : 'runs'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footer — identical to CommunityCourses */}
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
      </div>
      {gate && (
        <PlatinumGate
          isVisible
          feature={gate.feature}
          description={gate.description}
          onClose={() => setGate(null)}
          onUpgrade={onUpgrade ?? (() => {})}
        />
      )}
    </div>
  );
}
