import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Code, Users, Trophy, Settings, HelpCircle, Bookmark, Bell, Crown } from 'lucide-react';
import Dashboard from './components/Dashboard';
import LevelSelector from './components/LevelSelector';
import LevelEditor from './components/LevelEditor';
import SavedCourses from './components/SavedCourses';
import CommunityCourses from './components/CommunityCourses';
import Races from './components/Races';
import GameCanvas from './components/GameCanvas';
import Leaderboard from './components/Leaderboard';
import AuthScreen from './components/AuthScreen';
import UserProfile from './components/UserProfile';
import NotificationsTab from './components/NotificationsTab';
import SettingsModal from './components/SettingsModal';
import Upgrade from './components/Upgrade';
import HelpModal from './components/HelpModal';
import SpotlightTutorial from './components/SpotlightTutorial';
import PrivacyModal from './components/PrivacyModal';
import { LevelConfig, GameSettings, UserAccount, RaceParticipant, CourseNotification, GhostFrame } from './types';
import { synths } from './audio';
import { api, flushPendingSubmissions } from './api';
import { DEFAULT_LEVELS } from './defaultLevels';


// Initial default settings
const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1.5,
  fov: 85,
  musicVolume: 0.5,
  sfxVolume: 0.5,
  showGhost: true,
  invertY: false,
  showJoystick: true,
  showJumpButton: true
};

type AppTab = 'home' | 'levels' | 'saved' | 'community' | 'editor' | 'play' | 'races' | 'profile' | 'notifications' | 'upgrade';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('momentum_current_user');
    const token = localStorage.getItem('delta_rush_token');
    if (saved && !token) {
      // A user record exists without a matching auth token (e.g. leftover from
      // an older version of the app, or a token that was cleared separately).
      // Treat this as logged out — otherwise every authenticated request
      // (like saving a completed run) will silently fail with no way to recover.
      console.warn('Found saved user without an auth token — clearing stale session.');
      localStorage.removeItem('momentum_current_user');
      return null;
    }
    if (saved) {
      try {
        return JSON.parse(saved) as UserAccount;
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  });

  const [tab, setTab] = useState<AppTab>('home');
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);

  // Tracks the in-flight race result save so we can await it before returning to the
  // Races tab — otherwise the stats fetched on remount can race ahead of the save.
  const raceSavePromiseRef = useRef<Promise<void> | null>(null);
  // Bumped after a race result save completes so the Races tab always refetches fresh
  // stats even if it happens to already be mounted.
  const [racesRefreshKey, setRacesRefreshKey] = useState(0);

  // Profile page states
  const [viewingProfileUsername, setViewingProfileUsername] = useState<string | null>(null);
  const [previousTab, setPreviousTab] = useState<AppTab>('home');

  // Notifications state
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);

  const checkUnreadNotifications = useCallback(async () => {
    if (!currentUser) return;
    try {
      const notifs = await api.users.getNotifications(currentUser.username);
      setHasUnreadNotifications(notifs.some(n => !n.read));
    } catch (e) {
      setHasUnreadNotifications(false);
    }
  }, [currentUser]);

  useEffect(() => {
    checkUnreadNotifications();
  }, [currentUser, tab, checkUnreadNotifications]);

  
  // Game session states
  const [activeLevel, setActiveLevel] = useState<LevelConfig | null>(null);
  const [raceMode, setRaceMode] = useState<boolean>(false);
  const [raceOpponents, setRaceOpponents] = useState<RaceParticipant[]>([]);
  const raceWsRef = useRef<WebSocket | null>(null);
  const [raceRoomId, setRaceRoomId] = useState<string | null>(null);
  const [raceStartTime, setRaceStartTime] = useState<number | null>(null);
  const [isEditingSaved, setIsEditingSaved] = useState<boolean>(false);
  const [editingLevel, setEditingLevel] = useState<LevelConfig | null>(() => {
    const saved = localStorage.getItem('momentum_builder_draft');
    if (saved) {
      try {
        return JSON.parse(saved) as LevelConfig;
      } catch (e) {
        console.error(e);
      }
    }
    return null;
  });
  
  // Leaderboard modal states
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboardLevel, setLeaderboardLevel] = useState<{ id: string; name: string } | null>(null);

  // Ghost override — set when user clicks "Race Ghost" in the leaderboard
  const [ghostOverrideFrames, setGhostOverrideFrames] = useState<GhostFrame[] | null>(null);
  const [ghostOverrideLabel, setGhostOverrideLabel] = useState<string | null>(null);

  // System settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  // Initialize volume settings from LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem('momentum_player_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(parsed);
        synths.setVolume(parsed.sfxVolume);
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // One-time reset of leaderboards, personal bests, and ghosts for real players only
  useEffect(() => {
    const RESET_KEY = 'leaderboard_reset_v5';
    if (!localStorage.getItem(RESET_KEY)) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('leaderboard_') || key.startsWith('best_time_') || key.startsWith('ghost_replay_'))) {
          localStorage.removeItem(key);
        }
      }
      localStorage.setItem(RESET_KEY, 'true');
    }
  }, []);

  const handleUpdateSettings = (newSettings: GameSettings) => {
    setSettings(newSettings);
    synths.setVolume(newSettings.sfxVolume);
    localStorage.setItem('momentum_player_settings', JSON.stringify(newSettings));
  };

  const handleSelectLevel = (level: LevelConfig) => {
    setActiveLevel(level);
    setTab('play');
    synths.playTick();
  };

  const handleSelectRaceLevel = (
    level: LevelConfig,
    racesMode: boolean,
    opponents: RaceParticipant[],
    ws?: WebSocket | null,
    roomId?: string | null,
    startTime?: number | null,
  ) => {
    raceWsRef.current = ws ?? null;
    setRaceRoomId(roomId ?? null);
    setRaceStartTime(startTime ?? null);
    setActiveLevel(level);
    setRaceMode(racesMode);
    setRaceOpponents(opponents);
    setTab('play');
    synths.playTick();
  };

  const handleSaveRaceResults = async (
    finalTime: number,
    rankings: { username: string; time?: number; finished: boolean; isNpc: boolean; color: string }[]
  ) => {
    if (!currentUser) return;

    const orderedRankings = [...rankings].sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return (a.time ?? Number.POSITIVE_INFINITY) - (b.time ?? Number.POSITIVE_INFINITY);
    });
    const ourEntry = orderedRankings.find(r => r.username.toLowerCase().trim() === currentUser.username.toLowerCase().trim());
    const ourRankIndex = orderedRankings.findIndex(r => r.username.toLowerCase().trim() === currentUser.username.toLowerCase().trim());
    const ourPlace = ourRankIndex !== -1 ? ourRankIndex + 1 : 6;
    const playerColor = ourEntry?.color || '#3b82f6';

    let ratingChange = 0;
    if (ourPlace === 1) ratingChange = 10;
    else if (ourPlace === 2) ratingChange = 5;
    else if (ourPlace === 3) ratingChange = 2;
    else if (ourPlace === 4) ratingChange = -2;
    else if (ourPlace === 5) ratingChange = -5;
    else ratingChange = -10;

    // Fetch current rating so newRating is accurate
    let currentRating = 100;
    try {
      const ratingData = await api.users.getRating(currentUser.username);
      currentRating = ratingData.rating;
    } catch (e) {
      console.warn('Could not fetch current rating, defaulting to 100');
    }
    const newRating = Math.max(100, currentRating + ratingChange);
    const actualRatingChange = newRating - currentRating;

    const historyEntry = {
      id: `race_run_${Date.now()}`,
      levelId: activeLevel?.id || 'tutorial_skyway',
      levelName: activeLevel?.name || 'Delta Skyway',
      playerName: currentUser.username,
      playerColor,
      place: ourPlace,
      time: finalTime,
      opponents: orderedRankings.filter(r => r.username.toLowerCase().trim() !== currentUser.username.toLowerCase().trim()),
      ratingChange: actualRatingChange,
      newRating,
      date: Date.now()
    };

    try {
      await api.users.saveRaceResult(currentUser.username, historyEntry as any);
    } catch (e) {
      console.error('Failed to save race result:', e);
    } finally {
      // Let the Races tab know fresh stats are available even if it's already mounted.
      setRacesRefreshKey(k => k + 1);
    }
  };

  const handleStartBuilder = () => {
    setIsEditingSaved(false);
    const saved = localStorage.getItem('momentum_builder_draft');
    if (saved) {
      try {
        let parsed = JSON.parse(saved) as LevelConfig;

        // Decouple if this draft matches any published level
        const stored = localStorage.getItem('custom_parkour_levels');
        const list: LevelConfig[] = stored ? JSON.parse(stored) : [];
        const isDraftPublished = parsed.isPublished || list.some(lvl => lvl.id === parsed.id && lvl.isPublished);

        if (isDraftPublished) {
          parsed = {
            ...parsed,
            id: `level_${Date.now()}`,
            isPublished: false
          };
          localStorage.setItem('momentum_builder_draft', JSON.stringify(parsed));
        }

        setEditingLevel(parsed);
      } catch (e) {
        console.error(e);
        setEditingLevel(null);
      }
    } else {
      setEditingLevel(null);
    }
    setTab('editor');
    synths.playTick();
  };

  const handleEditCustomLevel = (level: LevelConfig) => {
    if (level.isPublished) {
      alert('This course has already been published to the community and cannot be edited.');
      return;
    }
    setIsEditingSaved(true);
    setEditingLevel(level);
    setTab('editor');
    synths.playTick();
  };

  const handleSaveCustomLevel = (level: LevelConfig) => {
    try {
      const stored = localStorage.getItem('custom_parkour_levels');
      let list: LevelConfig[] = stored ? JSON.parse(stored) : [];
      
      // If we are NOT editing an already saved course, force a brand new unique ID so it saves as a new course!
      let levelToSave = level;
      if (!isEditingSaved) {
        levelToSave = {
          ...level,
          id: `level_${Date.now()}`
        };
      }

      const existsIndex = list.findIndex(lvl => lvl.id === levelToSave.id);
      if (existsIndex >= 0) {
        if (list[existsIndex].isPublished) {
          alert('This course has already been published to the community and cannot be edited.');
          return;
        }
        // Clear personal best times and ghost replays on that custom course as it has been edited
        localStorage.removeItem(`best_time_${levelToSave.id}`);
        localStorage.removeItem(`ghost_replay_${levelToSave.id}`);
        list[existsIndex] = levelToSave;
      } else {
        list.push(levelToSave);
      }
      
      localStorage.setItem('custom_parkour_levels', JSON.stringify(list));
      
      // Update editingLevel state and local draft storage with the saved level config
      setEditingLevel(levelToSave);
      localStorage.setItem('momentum_builder_draft', JSON.stringify(levelToSave));

      setTab('saved');
      synths.playFinish();
    } catch (e) {
      console.error(e);
      alert('Error saving level configuration.');
    }
  };

  const handleLaunchLeaderboard = (levelId: string, levelName: string) => {
    setLeaderboardLevel({ id: levelId, name: levelName });
    setLeaderboardOpen(true);
  };

  const handleRaceGhost = async (entry: import('./types').LeaderboardEntry) => {
    if (!leaderboardLevel) return;
    const entryOwner = entry.playerName?.toLowerCase().trim();
    const selfName = currentUser?.username?.toLowerCase().trim();
    if (entry.id === 'user_pb' || (entryOwner && selfName && entryOwner === selfName)) {
      // Players cannot race their own leaderboard ghost bot — only their regular
      // (personal-best) ghost, which is toggled separately via Settings.
      return;
    }
    const result = await api.leaderboard.getEntryFrames(leaderboardLevel.id, entry.id);
    if (!result || !result.frames || result.frames.length === 0) {
      alert('No ghost replay available for this run.');
      return;
    }
    setGhostOverrideFrames(result.frames);
    setGhostOverrideLabel(entry.playerName);
    setLeaderboardOpen(false);
  };

  const handleViewProfile = (profileUsername: string) => {
    if (tab !== 'profile') {
      setPreviousTab(tab);
    }
    setViewingProfileUsername(profileUsername);
    setTab('profile');
    setLeaderboardOpen(false);
    synths.playTick();
  };

  // Helper: fetch PB to display in stats summary
  const getPBTime = (id: string) => {
    const score = localStorage.getItem(`best_time_${id}`);
    if (!score) return null;
    const val = parseFloat(score);
    if (val <= 0.05) {
      localStorage.removeItem(`best_time_${id}`);
      return null;
    }
    return val;
  };

  const handleLoginSuccess = (user: UserAccount, isNewAccount = false) => {
    setCurrentUser(user);
    localStorage.setItem('momentum_current_user', JSON.stringify(user));
    if (isNewAccount) {
      const tutorialKey = `delta_rush_spotlight_seen_${user.username.toLowerCase().trim()}`;
      if (!localStorage.getItem(tutorialKey)) {
        localStorage.setItem(tutorialKey, 'true');
        window.setTimeout(() => setIsSpotlightOpen(true), 350);
      }
    }
    // Re-read settings — signup may have written device-specific defaults just before this call.
    const saved = localStorage.getItem('momentum_player_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSettings(parsed);
        synths.setVolume(parsed.sfxVolume);
      } catch (e) { /* ignore */ }
    }
    // Retry any runs that failed to save earlier (e.g. due to an expired session)
    flushPendingSubmissions().catch(e => console.warn('Failed to flush pending submissions:', e));
  };

  const handleLogout = () => {
    api.auth.logout();
    setCurrentUser(null);
    localStorage.removeItem('momentum_current_user');
    setTab('home');
    synths.playTick();
  };

  useEffect(() => {
    const handleSessionExpired = () => {
      setCurrentUser(null);
      setTab('home');
    };
    window.addEventListener('delta_rush_session_expired', handleSessionExpired);
    return () => window.removeEventListener('delta_rush_session_expired', handleSessionExpired);
  }, []);

  const [checkoutNotice, setCheckoutNotice] = useState<'success' | 'cancelled' | null>(null);

  // Platinum subscription status — fetched once per session and refreshed on login/checkout.
  const [isPlatinum, setIsPlatinum] = useState(false);
  const [platinumPlan, setPlatinumPlan] = useState<string | null>(null);
  const [platinumPeriodEnd, setPlatinumPeriodEnd] = useState<number | null>(null);
  // Bumped to force a re-fetch of billing status (e.g. after checkout success).
  const [billingRefreshKey, setBillingRefreshKey] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      setIsPlatinum(false);
      setPlatinumPlan(null);
      setPlatinumPeriodEnd(null);
      return;
    }
    api.billing.getStatus()
      .then(({ isPlatinum: p, plan, currentPeriodEnd }) => {
        setIsPlatinum(p);
        setPlatinumPlan(plan);
        setPlatinumPeriodEnd(currentPeriodEnd);
      })
      .catch(() => {
        setIsPlatinum(false);
        setPlatinumPlan(null);
        setPlatinumPeriodEnd(null);
      });
  }, [currentUser?.username, billingRefreshKey]);

  useEffect(() => {
    // Stripe Checkout redirects back with ?checkout=success|cancelled — surface
    // a brief notice, then clean the URL so refreshing doesn't repeat it.
    const params = new URLSearchParams(window.location.search);
    const checkout = params.get('checkout');
    const checkoutSessionId = params.get('session_id');
    if (checkout === 'success' || checkout === 'cancelled') {
      setCheckoutNotice(checkout);
      setTab('upgrade');
      params.delete('checkout');
      params.delete('session_id');
      const newSearch = params.toString();
      window.history.replaceState({}, '', window.location.pathname + (newSearch ? `?${newSearch}` : ''));
      const timer = setTimeout(() => setCheckoutNotice(null), 8000);
      if (checkout === 'success') {
        let cancelled = false;
        const confirmAndRefresh = async () => {
          if (checkoutSessionId) {
            try {
              await api.billing.confirmCheckout(checkoutSessionId);
            } catch {
              // The webhook may still be processing; status polling below
              // remains the fallback and never trusts the redirect by itself.
            }
          }
          if (!cancelled) setBillingRefreshKey(k => k + 1);
        };
        void confirmAndRefresh();

        // Stripe webhooks can take a few seconds. Keep polling status after
        // the server-side session confirmation attempt.
        const t1 = setTimeout(() => setBillingRefreshKey(k => k + 1), 2000);
        const t2 = setTimeout(() => setBillingRefreshKey(k => k + 1), 5000);
        const t3 = setTimeout(() => setBillingRefreshKey(k => k + 1), 10000);
        return () => {
          cancelled = true;
          clearTimeout(timer);
          clearTimeout(t1);
          clearTimeout(t2);
          clearTimeout(t3);
        };
      }
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // On app load, if we already have a logged-in session, retry any runs
    // that previously failed to save (e.g. from an expired session before relogin).
    if (currentUser) {
      flushPendingSubmissions().catch(e => console.warn('Failed to flush pending submissions:', e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep a ref that always holds the latest currentUser so rapid successive
  // calls (e.g. picking emoji then immediately picking a background) merge
  // onto the real latest state rather than a stale prop snapshot.
  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const handleUpdateCurrentUser = async (updates: Partial<UserAccount>) => {
    const merged: UserAccount = { ...currentUserRef.current!, ...updates };
    // Update ref immediately so the next rapid call also sees the new value.
    currentUserRef.current = merged;
    setCurrentUser(merged);
    localStorage.setItem('momentum_current_user', JSON.stringify(merged));
    try {
      await api.auth.updateUser(merged.username, {
        avatar: merged.avatar,
        avatarBg: merged.avatarBg
      });
    } catch (e) {
      console.error('Failed to sync profile update:', e);
    }
  };

  // ── Demo mode state (must come before the !currentUser early-return) ──────
  const [demoMode, setDemoMode] = useState(false);
  const [showDemoLogin, setShowDemoLogin] = useState(false);
  // Stores the last completed run in demo mode for submission on login
  const pendingDemoRunRef = useRef<{ levelId: string; payload: any } | null>(null);

  const DEMO_LEVEL = DEFAULT_LEVELS.find(l => l.id === 'tutorial_skyway') ?? DEFAULT_LEVELS[0];

  const handleDemoLoginSuccess = async (user: UserAccount) => {
    handleLoginSuccess(user);
    // Submit the last demo run (if any) to the leaderboard
    if (pendingDemoRunRef.current) {
      const { levelId, payload } = pendingDemoRunRef.current;
      pendingDemoRunRef.current = null;
      try {
        await api.leaderboard.submit(levelId, { ...payload, isNewPb: true });
      } catch (e) {
        console.warn('[demo] Failed to submit demo run on login:', e);
      }
    }
    setDemoMode(false);
    setShowDemoLogin(false);
  };

  if (!currentUser && demoMode) {
    // When the user wants to sign up from within the demo, show the full
    // AuthScreen (not a cramped modal) so the layout renders correctly.
    if (showDemoLogin) {
      return (
        <div className="relative min-h-full">
          <AuthScreen onLoginSuccess={handleDemoLoginSuccess} initialMode="signup" />
          <button
            onClick={() => setShowDemoLogin(false)}
            className="fixed top-4 left-4 z-[200] text-xs text-neutral-400 hover:text-neutral-200 font-mono bg-neutral-900/90 px-3 py-1.5 rounded-lg border border-neutral-700 transition cursor-pointer"
          >
            ← Back to Demo
          </button>
        </div>
      );
    }

    return (
      <div className="game-fullscreen overflow-hidden text-neutral-800">
        <GameCanvas
          level={DEMO_LEVEL}
          settings={{ ...DEFAULT_SETTINGS, showGhost: false }}
          onExit={() => setDemoMode(false)}
          onShowLeaderboard={() => {}}
          currentUser={null}
          demoMode
          onDemoLoginRequest={() => setShowDemoLogin(true)}
          onDemoRunComplete={(levelId, payload) => {
            pendingDemoRunRef.current = { levelId, payload };
          }}
        />
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} onPlayDemo={() => setDemoMode(true)} />;
  }

  // Navigate to the Upgrade tab cleanly — closes any open modals first and
  // scrolls to the top so the user always lands at the top of the page.
  const handleGoToUpgrade = () => {
    setLeaderboardOpen(false);
    setTab('upgrade');
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const isCoolBlueTab = ['home', 'levels', 'saved', 'community', 'races', 'profile', 'notifications'].includes(tab);

  const isPlaying = tab === 'play';

  return (
    <div className={`${isPlaying ? 'game-fullscreen overflow-hidden' : 'min-h-full'} text-neutral-800 selection:bg-indigo-600 selection:text-white flex flex-col transition-colors duration-300 ${isCoolBlueTab ? 'bg-[#e3ebf2]' : 'bg-white'}`}>
      
      {/* Primary Navigation Shell */}
      {tab !== 'play' && tab !== 'editor' && (
        <header className="border-b border-neutral-200 bg-white sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
            {/* Logo */}
            <div 
              onClick={() => { setTab('home'); synths.playTick(); }}
              className="flex items-center gap-2 cursor-pointer group"
            >
              <div className="w-8 h-8 bg-neutral-900 text-white rounded-lg group-hover:bg-indigo-600 transition duration-200 flex items-center justify-center">
                <span className="text-lg font-black font-sans leading-none select-none">Δ</span>
              </div>
              <span className="font-extrabold tracking-tight text-neutral-950 font-sans text-sm md:text-base uppercase">
                Delta Rush
                <span className="text-xs font-mono font-bold text-indigo-600 lowercase ml-1">.win</span>
              </span>
            </div>

            {/* Nav Tabs */}
            <nav className="flex gap-1 md:gap-2">
              <button
                id="dashboard-tab-trigger"
                onClick={() => { setTab('home'); synths.playTick(); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition duration-200 cursor-pointer ${
                  tab === 'home' 
                    ? 'bg-neutral-150 text-neutral-950' 
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                Dashboard
              </button>
              <button
                id="rush-tab-trigger"
                onClick={() => { setTab('levels'); synths.playTick(); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition duration-200 cursor-pointer ${
                  tab === 'levels' 
                    ? 'bg-red-50 text-red-600 font-bold' 
                    : 'text-red-500 hover:text-red-600 hover:bg-red-50/50'
                }`}
              >
                Rush!
              </button>
              <button
                id="saved-courses-tab-trigger"
                onClick={() => { setTab('saved'); synths.playTick(); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition duration-200 cursor-pointer flex items-center gap-1.5 ${
                  tab === 'saved' 
                    ? 'bg-neutral-150 text-neutral-950' 
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 text-neutral-400" />
                <span>Saved Courses</span>
              </button>
              <button
                id="community-workshop-tab-trigger"
                onClick={() => { setTab('community'); synths.playTick(); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition duration-250 cursor-pointer flex items-center gap-1.5 ${
                  tab === 'community' 
                    ? 'bg-neutral-150 text-neutral-950' 
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-neutral-500" />
                Community
              </button>
              <button
                id="races-tab-trigger"
                onClick={() => { setTab('races'); synths.playTick(); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition duration-250 cursor-pointer flex items-center gap-1.5 ${
                  tab === 'races' 
                    ? 'bg-neutral-150 text-neutral-950' 
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                Races
              </button>
              <button
                id="course-builder-tab-trigger"
                onClick={handleStartBuilder}
                className="px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl text-xs font-bold transition duration-200 cursor-pointer flex items-center gap-1.5"
              >
                <Code className="w-3.5 h-3.5" />
                Course Builder
              </button>
              <button
                id="upgrade-tab-trigger"
                onClick={() => { setTab('upgrade'); synths.playTick(); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition duration-200 cursor-pointer flex items-center gap-1.5 ${
                  tab === 'upgrade'
                    ? 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-300 text-neutral-900'
                    : 'text-amber-600 hover:bg-amber-50'
                }`}
              >
                <Crown className="w-3.5 h-3.5" />
                Upgrade
              </button>
            </nav>

            {/* Settings & Active User Badge */}
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono ml-6">
              <button
                id="notifications-icon-trigger"
                onClick={() => {
                  setTab('notifications');
                  synths.playTick();
                }}
                className={`p-1.5 rounded-xl transition cursor-pointer flex items-center justify-center relative ${
                  tab === 'notifications' 
                    ? 'bg-neutral-150 text-neutral-950' 
                    : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100'
                }`}
                title="Notifications Inbox"
              >
                <span className="relative flex items-center justify-center">
                  <Bell className="w-4 h-4" />
                  {hasUnreadNotifications && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-[8px] font-black text-white ring-1 ring-white animate-pulse">
                      !
                    </span>
                  )}
                </span>
              </button>

              <button
                onClick={() => {
                  setIsHelpOpen(true);
                  synths.playTick();
                }}
                className="p-1.5 rounded-xl hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition cursor-pointer flex items-center justify-center"
                title="Help & Field Guide"
              >
                <HelpCircle className="w-4 h-4" />
              </button>

              <button
                onClick={() => {
                  setIsSettingsOpen(true);
                  synths.playTick();
                }}
                className="p-1.5 rounded-xl hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition cursor-pointer flex items-center justify-center"
                title="System Settings & Runner Customization"
              >
                <Settings className="w-4 h-4" />
              </button>

              {/* Active User Badge */}
              <div 
                onClick={() => handleViewProfile(currentUser.username)}
                className="flex items-center gap-2 pl-3 border-l border-neutral-200 cursor-pointer hover:opacity-85 active:scale-[0.98] transition group select-none"
                title="View your public profile"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-sm border border-neutral-100 ${currentUser.avatarBg || 'bg-rose-500'} group-hover:scale-105 transition-transform duration-200`}>
                  {currentUser.avatar}
                </div>
                <span className="font-semibold text-neutral-700 hidden md:inline group-hover:text-indigo-600 transition-colors duration-200">{currentUser.username}</span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Screen Routing Outlet */}
      <main className={`${isPlaying ? 'flex-1 overflow-hidden' : 'flex-1'} transition-colors duration-300 ${tab === 'levels' ? 'bg-[#0b1020]' : isCoolBlueTab ? 'bg-[#e3ebf2]' : 'bg-white'}`}>
        {tab === 'home' && (
          <Dashboard
            settings={settings}
            onChangeSettings={handleUpdateSettings}
            onNavigate={(target) => setTab(target)}
            currentUser={currentUser}
            onLogout={handleLogout}
            onUpdateCurrentUser={handleUpdateCurrentUser}
            isPlatinum={isPlatinum}
            onUpgrade={handleGoToUpgrade}
          />
        )}

        {tab === 'levels' && (
          <LevelSelector
            onSelectLevel={handleSelectLevel}
            onCreateNewCustom={handleStartBuilder}
            onEditCustom={handleEditCustomLevel}
            currentUser={currentUser}
          />
        )}

        {tab === 'saved' && (
          <SavedCourses
            onSelectLevel={handleSelectLevel}
            onCreateNewCustom={handleStartBuilder}
            onEditCustom={handleEditCustomLevel}
            currentUser={currentUser}
            isPlatinum={isPlatinum}
            onUpgrade={handleGoToUpgrade}
          />
        )}

        {tab === 'community' && (
          <CommunityCourses
            onSelectLevel={handleSelectLevel}
            currentUser={currentUser}
            onViewProfile={handleViewProfile}
          />
        )}

        {tab === 'races' && currentUser && (
          <Races
            currentUser={currentUser}
            refreshKey={racesRefreshKey}
            onSelectLevel={(rl, isRacesMode, opponents, ws, roomId, startTime) => {
              handleSelectRaceLevel(rl, isRacesMode, opponents, ws, roomId, startTime);
            }}
            isPlatinum={isPlatinum}
            onUpgrade={handleGoToUpgrade}
          />
        )}

        {tab === 'upgrade' && (
          <div className="min-h-full">
            {checkoutNotice && (
              <div
                className={`px-4 py-3 text-center text-sm font-semibold ${
                  checkoutNotice === 'success'
                    ? 'bg-emerald-500 text-white'
                    : 'bg-neutral-800 text-white/90'
                }`}
              >
                {checkoutNotice === 'success'
                  ? "Payment successful — you're now on Platinum!"
                  : 'Checkout was cancelled. No charge was made.'}
              </div>
            )}
            <Upgrade
              isLoggedIn={!!currentUser}
              isPlatinum={isPlatinum}
              plan={platinumPlan}
              currentPeriodEnd={platinumPeriodEnd}
            />
          </div>
        )}

        {tab === 'profile' && viewingProfileUsername && currentUser && (
          <UserProfile
            username={viewingProfileUsername}
            currentUser={currentUser}
            onBack={() => setTab(previousTab)}
            onSelectLevel={handleSelectLevel}
            onUpdateCurrentUser={handleUpdateCurrentUser}
            isPlatinum={isPlatinum}
            onUpgrade={handleGoToUpgrade}
          />
        )}

        {tab === 'notifications' && currentUser && (
          <NotificationsTab
            currentUser={currentUser}
            onSelectLevel={handleSelectLevel}
            onViewProfile={handleViewProfile}
            onNotificationsChanged={checkUnreadNotifications}
          />
        )}

        {tab === 'editor' && (
          <LevelEditor
            initialLevel={editingLevel}
            onSave={handleSaveCustomLevel}
            isPlatinum={isPlatinum}
            onUpgrade={handleGoToUpgrade}
            onExit={(latestLevel) => {
              if (latestLevel) {
                setEditingLevel(latestLevel);
                localStorage.setItem('momentum_builder_draft', JSON.stringify(latestLevel));
              }
              setTab('saved');
            }}
            onTest={(testLevel) => {
              // Extract the user's latest updates from the testLevel and save them in the editor state
              const originalId = editingLevel?.id || `level_${Date.now()}`;
              const updatedDraft: LevelConfig = {
                ...testLevel,
                id: originalId
              };
              setEditingLevel(updatedDraft);
              localStorage.setItem('momentum_builder_draft', JSON.stringify(updatedDraft));
              
              // Proceed to launch the testing experience
              handleSelectLevel(testLevel);
            }}
          />
        )}

        {tab === 'play' && activeLevel && (
          <GameCanvas
            level={activeLevel}
            settings={settings}
            onChangeSettings={handleUpdateSettings}
            currentUser={currentUser}
            raceMode={raceMode}
            raceOpponents={raceOpponents}
            raceWs={raceWsRef.current}
            raceRoomId={raceRoomId}
            raceStartTime={raceStartTime}
            onRaceFinished={(finalTime, rankings) => {
              raceSavePromiseRef.current = handleSaveRaceResults(finalTime, rankings);
            }}
            ghostOverride={ghostOverrideFrames}
            ghostOverrideLabel={ghostOverrideLabel}
            onExit={async () => {
              const wasRaces = raceMode;
              // Close the race WebSocket so the server immediately removes this
              // player from their room, freeing the slot for the next race.
              // (Races.tsx already skips its own cleanup when raceActiveRef is
              // true, so nothing else will close this socket.)
              if (raceWsRef.current) {
                raceWsRef.current.close();
                raceWsRef.current = null;
              }
              setRaceRoomId(null);
              setRaceStartTime(null);
              setRaceMode(false);
              setRaceOpponents([]);
              // Clear ghost override when leaving
              setGhostOverrideFrames(null);
              setGhostOverrideLabel(null);

              // Make sure any pending race result save has landed before the Races tab
              // remounts and fetches stats — otherwise it can read stale data.
              if (wasRaces && raceSavePromiseRef.current) {
                try {
                  await raceSavePromiseRef.current;
                } catch {
                  // Save failure is already logged in handleSaveRaceResults
                } finally {
                  raceSavePromiseRef.current = null;
                }
              }

              if (activeLevel.id === 'test_level_active') {
                setTab('editor'); // return back to editor sandbox
              } else if (activeLevel.isCustom) {
                setTab('saved'); // return back to saved custom levels
              } else if (wasRaces) {
                setTab('races'); // return back to races tab
              } else {
                setTab('levels'); // return to levels list
              }
            }}
            onShowLeaderboard={() => handleLaunchLeaderboard(activeLevel.id, activeLevel.name)}
          />
        )}
      </main>

      {/* Leaderboard Modal Portal */}
      {leaderboardOpen && leaderboardLevel && (
        <Leaderboard
          levelId={leaderboardLevel.id}
          levelName={leaderboardLevel.name}
          localBest={getPBTime(leaderboardLevel.id)}
          currentUser={currentUser}
          onClose={() => setLeaderboardOpen(false)}
          onViewProfile={handleViewProfile}
          onRaceGhost={handleRaceGhost}
          isPlatinum={isPlatinum}
          onUpgrade={handleGoToUpgrade}
        />
      )}

      {/* Settings Modal Portal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onChangeSettings={handleUpdateSettings}
        currentUser={currentUser}
        onUpdateCurrentUser={handleUpdateCurrentUser}
      />

      {/* Help Modal Portal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        onOpenSpotlight={() => setIsSpotlightOpen(true)}
      />

      <SpotlightTutorial
        isOpen={isSpotlightOpen}
        onClose={() => setIsSpotlightOpen(false)}
      />

      {/* Privacy Policy Modal Portal */}
      <PrivacyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />

      {/* Minimalistic Footer */}
      {tab !== 'play' && tab !== 'editor' && tab !== 'levels' && tab !== 'races' && (
        <footer className={`border-t border-neutral-200/60 py-6 transition-colors duration-300 ${isCoolBlueTab ? 'bg-[#e3ebf2]' : 'bg-neutral-50'}`}>
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-neutral-400">
            <p>© 2026 Delta Rush Engine. Dedicated to physical movement and speed.</p>
            <div className="flex gap-4">
              <span
                onClick={() => {
                  setIsPrivacyOpen(true);
                  synths.playTick();
                }}
                className="hover:text-neutral-700 transition cursor-pointer underline decoration-dotted underline-offset-2"
              >
                Privacy Policy
              </span>
              <span>•</span>
              <span className="text-indigo-600 font-bold">Responsive 3D WebGL</span>
            </div>
          </div>
        </footer>
      )}

    </div>
  );
}
