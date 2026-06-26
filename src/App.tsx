import React, { useState, useEffect } from 'react';
import { Code, Volume2, LogOut, User, KeyRound, ShieldAlert, Users, Trophy, Settings, HelpCircle } from 'lucide-react';
import Dashboard from './components/Dashboard';
import LevelSelector from './components/LevelSelector';
import LevelEditor from './components/LevelEditor';
import SavedCourses from './components/SavedCourses';
import CommunityCourses from './components/CommunityCourses';
import Races from './components/Races';
import GameCanvas from './components/GameCanvas';
import Leaderboard from './components/Leaderboard';
import AuthScreen from './components/AuthScreen';
import SettingsModal from './components/SettingsModal';
import HelpModal from './components/HelpModal';
import PrivacyModal from './components/PrivacyModal';
import { LevelConfig, GameSettings, UserAccount, RaceParticipant } from './types';
import { synths } from './audio';


// Initial default settings
const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1.5,
  fov: 85,
  musicVolume: 0.5,
  sfxVolume: 0.5,
  showGhost: false,
  invertY: false
};

type AppTab = 'home' | 'levels' | 'saved' | 'community' | 'editor' | 'play' | 'races';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const saved = localStorage.getItem('momentum_current_user');
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

  
  // Game session states
  const [activeLevel, setActiveLevel] = useState<LevelConfig | null>(null);
  const [raceMode, setRaceMode] = useState<boolean>(false);
  const [raceOpponents, setRaceOpponents] = useState<RaceParticipant[]>([]);
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

  // System settings modal state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
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

  const handleSelectRaceLevel = (level: LevelConfig, racesMode: boolean, opponents: RaceParticipant[]) => {
    setActiveLevel(level);
    setRaceMode(racesMode);
    setRaceOpponents(opponents);
    setTab('play');
    synths.playTick();
  };

  const handleSaveRaceResults = (
    finalTime: number,
    rankings: { username: string; time?: number; finished: boolean; isNpc: boolean; color: string }[]
  ) => {
    if (!currentUser) return;

    // Find our finished place
    const ourRankIndex = rankings.findIndex(r => r.username.toLowerCase().trim() === currentUser.username.toLowerCase().trim());
    const ourPlace = ourRankIndex !== -1 ? ourRankIndex + 1 : 6;

    let ratingChange = 0;
    if (ourPlace === 1) ratingChange = 10;
    else if (ourPlace === 2) ratingChange = 5;
    else if (ourPlace === 3) ratingChange = 2;
    else if (ourPlace === 4) ratingChange = -2;
    else if (ourPlace === 5) ratingChange = -5;
    else ratingChange = -10;

    const currentRatingStr = localStorage.getItem(`racer_rating_${currentUser.username}`);
    const currentRating = currentRatingStr ? parseInt(currentRatingStr) : 1000;
    const newRating = Math.max(100, currentRating + ratingChange);

    localStorage.setItem(`racer_rating_${currentUser.username}`, newRating.toString());

    // Prepare history entry
    const historyEntry = {
      id: `race_run_${Date.now()}`,
      levelId: activeLevel?.id || 'tutorial_skyway',
      levelName: activeLevel?.name || 'Tutorial Skyway',
      playerName: currentUser.username,
      playerColor: localStorage.getItem(`racer_color_${currentUser.username}`) || '#3b82f6',
      place: ourPlace,
      time: finalTime,
      opponents: rankings.filter(r => r.username.toLowerCase().trim() !== currentUser.username.toLowerCase().trim()),
      ratingChange: ratingChange,
      newRating: newRating,
      date: Date.now()
    };

    const savedHistoryStr = localStorage.getItem(`race_history_${currentUser.username}`);
    const savedHistory = savedHistoryStr ? JSON.parse(savedHistoryStr) : [];
    const updatedHistory = [historyEntry, ...savedHistory].slice(0, 100);

    localStorage.setItem(`race_history_${currentUser.username}`, JSON.stringify(updatedHistory));
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

  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    localStorage.setItem('momentum_current_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('momentum_current_user');
    setTab('home');
    synths.playTick();
  };

  const handleUpdateCurrentUser = (updatedUser: UserAccount) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('momentum_current_user', JSON.stringify(updatedUser));

    // Also update this user in the users collective list
    try {
      const stored = localStorage.getItem('momentum_users');
      if (stored) {
        let list: UserAccount[] = JSON.parse(stored);
        const idx = list.findIndex(u => u.username.toLowerCase() === updatedUser.username.toLowerCase());
        if (idx >= 0) {
          list[idx] = updatedUser;
          localStorage.setItem('momentum_users', JSON.stringify(list));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-white text-neutral-800 selection:bg-indigo-600 selection:text-white flex flex-col justify-between">
      
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
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition duration-200 cursor-pointer ${
                  tab === 'saved' 
                    ? 'bg-neutral-150 text-neutral-950' 
                    : 'text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                }`}
              >
                Saved Courses
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
                onClick={handleStartBuilder}
                className="px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 rounded-xl text-xs font-bold transition duration-200 cursor-pointer flex items-center gap-1.5"
              >
                <Code className="w-3.5 h-3.5" />
                Course Builder
              </button>
            </nav>

            {/* Settings & Active User Badge */}
            <div className="hidden sm:flex items-center gap-3 text-xs font-mono">
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
              <div className="flex items-center gap-2 pl-3 border-l border-neutral-200">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-sm shadow-sm border border-neutral-100 ${currentUser.avatarBg || 'bg-rose-500'}`}>
                  {currentUser.avatar}
                </div>
                <span className="font-semibold text-neutral-700 hidden md:inline">{currentUser.username}</span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* Screen Routing Outlet */}
      <main className="flex-1 bg-white">
        {tab === 'home' && (
          <Dashboard
            settings={settings}
            onChangeSettings={handleUpdateSettings}
            onNavigate={(target) => setTab(target)}
            currentUser={currentUser}
            onLogout={handleLogout}
            onUpdateCurrentUser={handleUpdateCurrentUser}
          />
        )}

        {tab === 'levels' && (
          <LevelSelector
            onSelectLevel={handleSelectLevel}
            onCreateNewCustom={handleStartBuilder}
            onEditCustom={handleEditCustomLevel}
          />
        )}

        {tab === 'saved' && (
          <SavedCourses
            onSelectLevel={handleSelectLevel}
            onCreateNewCustom={handleStartBuilder}
            onEditCustom={handleEditCustomLevel}
            currentUser={currentUser}
          />
        )}

        {tab === 'community' && (
          <CommunityCourses
            onSelectLevel={handleSelectLevel}
            currentUser={currentUser}
          />
        )}

        {tab === 'races' && currentUser && (
          <Races
            currentUser={currentUser}
            onSelectLevel={(rl, isRacesMode, opponents) => {
              handleSelectRaceLevel(rl, isRacesMode, opponents);
            }}
          />
        )}

        {tab === 'editor' && (
          <LevelEditor
            initialLevel={editingLevel}
            onSave={handleSaveCustomLevel}
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
            currentUser={currentUser}
            raceMode={raceMode}
            raceOpponents={raceOpponents}
            onRaceFinished={(finalTime, rankings) => handleSaveRaceResults(finalTime, rankings)}
            onExit={() => {
              const wasRaces = raceMode;
              setRaceMode(false);
              setRaceOpponents([]);
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
      />

      {/* Privacy Policy Modal Portal */}
      <PrivacyModal
        isOpen={isPrivacyOpen}
        onClose={() => setIsPrivacyOpen(false)}
      />

      {/* Minimalistic Footer */}
      {tab !== 'play' && tab !== 'editor' && (
        <footer className="border-t border-neutral-200 py-6 bg-neutral-50">
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
