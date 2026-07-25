import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RotateCcw, Award, CheckCircle, Flame, Clock, LogOut } from 'lucide-react';

const formatPercentile = (p: number): string => {
  if (p < 1) return p.toFixed(2);
  if (p < 5) return p.toFixed(1);
  return Math.round(p).toString();
};

/** Deterministic per-bot PRNG (mulberry32). Seeded from RaceParticipant.seed so
 *  all clients simulate the same stumble/boost sequence for every bot. */
function makeBotRng(seed: number): () => number {
  let s = ((Math.abs(seed) * 1e8 + 1) >>> 0) | 1;
  return () => {
    s |= 0;
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
import { LevelConfig, GhostFrame, RunReplay, GameSettings, UserAccount, RaceParticipant } from '../types';
import { synths } from '../audio';
import { motion, AnimatePresence } from 'motion/react';
import { resampleSpeedsToUniformTime } from '../utils/resampleSpeeds';
import { getPlayerRanking } from '../utils/rankings';

interface GameCanvasProps {
  level: LevelConfig;
  settings: GameSettings;
  onChangeSettings?: (s: GameSettings) => void;
  onExit: () => void;
  onShowLeaderboard: () => void;
  currentUser?: UserAccount | null;
  raceMode?: boolean;
  raceOpponents?: RaceParticipant[];
  onRaceFinished?: (
    finalTime: number,
    rankings: { username: string; time?: number; finished: boolean; isNpc: boolean; color: string }[]
  ) => void;
  /** Live WebSocket connection shared from the matchmaking lobby */
  raceWs?: WebSocket | null;
  /** Server-assigned room ID for routing in-race messages */
  raceRoomId?: string | null;
  /** Server epoch-ms timestamp anchoring the countdown/race clock across all clients */
  raceStartTime?: number | null;
  /** Ghost frames from a specific leaderboard entry to race against */
  ghostOverride?: GhostFrame[] | null;
  /** Display name for the ghost override (e.g. "PlayerName") */
  ghostOverrideLabel?: string | null;
  /** When true, the game runs in demo mode: no server submission, no ghost, no leaderboard */
  demoMode?: boolean;
  /** Called when the user clicks a "Log in" CTA from within the demo */
  onDemoLoginRequest?: () => void;
  /** Called each time the user completes a run in demo mode; overwrites the previous pending run */
  onDemoRunComplete?: (levelId: string, payload: any) => void;
}



export default function GameCanvas({ 
  level, 
  settings, 
  onChangeSettings,
  onExit, 
  onShowLeaderboard, 
  currentUser,
  raceMode = false,
  raceOpponents = [],
  onRaceFinished,
  raceWs,
  raceRoomId,
  raceStartTime = null,
  ghostOverride = null,
  ghostOverrideLabel = null,
  demoMode = false,
  onDemoLoginRequest,
  onDemoRunComplete,
}: GameCanvasProps) {
  // Game states
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0.00);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [speed, setSpeed] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [activeModifiers, setActiveModifiers] = useState<string[]>([]);

  // Refs to prevent physics and telemetry loops from triggering effect resets
  const isPlayingRef = useRef(false);
  const isCompletedRef = useRef(false);
  const countdownRef = useRef<number | null>(null);
  const isLeaderboardLoggedRef = useRef<boolean>(false);
  const liveUpdateFrameCountRef = useRef<number>(0);

  // Completion statuses
  const [isCompleted, setIsCompleted] = useState(false);
  const [completionTime, setCompletionTime] = useState(0.00);
  const [timeDiff, setTimeDiff] = useState<number | null>(null); // vs personalBest
  const [isPb, setIsPb] = useState(false);
  const [completionPercentile, setCompletionPercentile] = useState<number | null>(null);
  const [completionWorldRank, setCompletionWorldRank] = useState<{ rank: number; total: number } | null>(null);

  // Canvas ref
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Keyboard state
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const lastJumpBlockCollisionTimeRef = useRef<number>(0);
  const lastWallTouchRef = useRef<{ normal: THREE.Vector3; time: number; blockId: string } | null>(null);
  const elapsedTimeRef = useRef<number>(0.0);
  const currentMaxSpeedRef = useRef<number>(12.0);
  const movementStartedRef = useRef<boolean>(false);
  // Wall-clock timestamp (Date.now()) marking the instant the race clock started
  // ticking. Using Date.now() instead of accumulated per-frame deltas means the
  // timer keeps counting correctly even if requestAnimationFrame is throttled
  // or paused while the tab is in the background — and, in race mode, this
  // timestamp is anchored to a server-broadcast value so every racer's clock
  // reads the same elapsed time regardless of individual network latency.
  const raceStartWallTimeRef = useRef<number | null>(null);

  // Race Countdown details
  const [raceCountdown, setRaceCountdown] = useState<number | null>(null);
  const [restartCount, setRestartCount] = useState<number>(0);
  const hasCountdownStartedRef = useRef<boolean>(false);
  const raceStartedRef = useRef<boolean>(false);

  // Ghost information
  const currentRunFramesRef = useRef<GhostFrame[]>([]);
  const currentRunSpeedsRef = useRef<number[]>([]);
  const currentRunActionsRef = useRef<string[]>([]);
  const ghostFramesRef = useRef<GhostFrame[]>([]);
  const ghostMeshRef = useRef<THREE.Mesh | null>(null);
  const ghostActiveRef = useRef<boolean>(false);
  // Mirrors settings.showGhost so the animation loop can read it without a stale closure.
  // Updated by a dedicated useEffect — keeps the Three.js setup effect out of the dep array.
  const showGhostRef = useRef<boolean>(true);

  // Override ghost — races a specific leaderboard entry's recording
  const overrideGhostFramesRef = useRef<GhostFrame[]>([]);
  const overrideGhostMeshRef = useRef<THREE.Mesh | null>(null);
  const overrideGhostActiveRef = useRef<boolean>(false);

  // Multi-player races refs & states
  const opponentMeshesRef = useRef<{
    username: string;
    color: string;
    isNpc: boolean;
    mesh: THREE.Mesh;
    finished: boolean;
    finalTime?: number;
    progressDistance: number;
    speedBoostTimer: number;
    lastUpdateMs: number;
    targetPosition: THREE.Vector3;
    targetYaw: number;
    baseSpeed: number;
    velocity: THREE.Vector3;
    grounded: boolean;
    stumbleTimer: number;
    boostTimer: number;
    jumpCooldown: number;
    lastCheckpointDistance: number;
    lastCheckpointPos: THREE.Vector3;
    seededRng: () => number;
    // Ghost-replay fields (NPCs only)
    frames: GhostFrame[];
    framesLoaded: boolean;
  }[]>([]);

  // Waiting-for-others state (player finished but not all opponents yet)
  const [isWaitingForOthers, setIsWaitingForOthers] = useState(false);
  // Mirrors isWaitingForOthers for use inside stable closures (WS/BC message
  // handlers, the per-frame NPC update loop) that don't re-run when state changes.
  const isWaitingForOthersRef = useRef(false);
  const playerFinishTimeRef = useRef<number>(0);
  const waitForOpponentsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const splinePointsRef = useRef<THREE.Vector3[]>([]);
  const cumulativeSplineDistancesRef = useRef<number[]>([]);
  const totalSplineLengthRef = useRef<number>(0);
  const splineCheckpointsRef = useRef<{ distance: number; position: THREE.Vector3 }[]>([]);
  const bcRef = useRef<BroadcastChannel | null>(null);
  const commitRaceResultsRef = useRef<() => void>(() => {});
  // High-water-mark for the local player's spline progress: only ever increases
  // during a race so the live standings distance never jumps backwards.
  const playerProgressHWMRef = useRef<number>(0);

  const [liveRankings, setLiveRankings] = useState<{
    username: string;
    color: string;
    isNpc: boolean;
    finished: boolean;
    progressDistance: number;
    finalTime?: number;
  }[]>([]);

  const [finalStandings, setFinalStandings] = useState<{
    username: string;
    time?: number;
    finished: boolean;
    isNpc: boolean;
    color: string;
  }[]>([]);
  // username → { eloChange, newRating } for real players after a race
  const [raceEloData, setRaceEloData] = useState<Record<string, { eloChange: number; newRating: number }> | null>(null);

  // Fetch ELO for all real players whenever final standings are committed
  useEffect(() => {
    if (finalStandings.length === 0) return;
    const realPlayers = finalStandings.filter(s => !s.isNpc);
    if (realPlayers.length === 0) return;

    (async () => {
      const { api: apiModule } = await import('../api');
      const results: Record<string, { eloChange: number; newRating: number }> = {};
      await Promise.all(
        realPlayers.map(async (std, _) => {
          // placement index inside finalStandings (already sorted)
          const idx = finalStandings.indexOf(std);
          const eloChange = idx === 0 ? 10 : idx === 1 ? 5 : idx === 2 ? 2 : idx === 3 ? -2 : idx === 4 ? -5 : -10;
          try {
            const { rating } = await apiModule.users.getRating(std.username);
            results[std.username] = { eloChange, newRating: Math.max(100, rating + eloChange) };
          } catch {
            // If fetch fails just show the delta without a new-total
            results[std.username] = { eloChange, newRating: 0 };
          }
        })
      );
      setRaceEloData(results);
    })();
  }, [finalStandings]);

  // Touch Screen virtual joystick states (Mobile variables)
  const isMobileRef = useRef<boolean>(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchMoveRef = useRef<{ x: number; y: number } | null>(null);
  const [touchJoystickActive, setTouchJoystickActive] = useState(false);
  const [touchJoystickOffset, setTouchJoystickOffset] = useState({ x: 0, y: 0 });
  const touchJoystickActiveRef = useRef<boolean>(false);
  const touchJoystickOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const joystickTouchIdRef = useRef<number | null>(null);
  const lookTouchIdRef = useRef<number | null>(null);
  const touchLookStartRef = useRef<{ x: number; y: number } | null>(null);

  // Three.js instances for movement and rendering
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const clockRef = useRef<THREE.Clock | null>(null);
  // Flips true once the Three.js scene effect has actually set sceneRef.current.
  // The ghost-loading effect depends on this so it reliably (re-)attempts mesh
  // creation once a live scene exists, instead of relying solely on initGame's
  // fallback — refs changing (.current =) don't retrigger effects on their own.
  const [sceneReady, setSceneReady] = useState(false);

  // Physics & Kinematic details
  const playerPos = useRef<THREE.Vector3>(new THREE.Vector3(0, 2, 0));
  const playerVel = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const playerYaw = useRef<number>(Math.PI); // Camera look left-right
  const playerPitch = useRef<number>(0);     // Camera look up-down
  const groundedRef = useRef<boolean>(false);
  const lastTimeGroundedRef = useRef<number>(0);
  const slideTimerRef = useRef<number>(0);
  const slidingRef = useRef<boolean>(false);
  const climbingRef = useRef<boolean>(false);
  const speedBoostRef = useRef<number>(1.0);
  const activeCheckpointRef = useRef<THREE.Vector3 | null>(null);
  const wallRunDirectionRef = useRef<'left' | 'right' | null>(null);
  const wallRunCooldownRef = useRef<number>(0);

  // Track if current level had custom checkpoint triggers
  const checkpointSoundCoolRef = useRef<{ [id: string]: number }>({});
  const jumpCoolRef = useRef<{ [id: string]: number }>({});
  const speedCoolRef = useRef<{ [id: string]: number }>({});

  // Load Personal Best
  useEffect(() => {
    hasCountdownStartedRef.current = false;
    setRaceCountdown(null);

    const score = localStorage.getItem(`best_time_${level.id}`);
    if (score) {
      setPersonalBest(parseFloat(score));
    } else {
      setPersonalBest(null);
    }

    // Keep the showGhostRef in sync whenever showGhost or level changes
    // Demo mode always forces ghost off — player must log in to use it.
    showGhostRef.current = demoMode ? false : settings.showGhost;

    // Attempt to load Ghost — PR ghost is disabled entirely during races and in demo mode
    const ghostData = (raceMode || demoMode) ? null : localStorage.getItem(`ghost_replay_${level.id}`);
    if (ghostData && settings.showGhost && !demoMode) {
      try {
        const parsed: RunReplay = JSON.parse(ghostData);
        ghostFramesRef.current = parsed.frames;
        ghostActiveRef.current = true;

        // If the mesh doesn't exist yet (ghost was off when the level loaded), create it now
        if (!ghostMeshRef.current && sceneRef.current && ghostFramesRef.current.length > 0) {
          const ghostGeom = new THREE.CapsuleGeometry(0.5, 1.0, 4, 8);
          const ghostMat = new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.45,
            wireframe: true
          });
          const gMesh = new THREE.Mesh(ghostGeom, ghostMat);
          sceneRef.current.add(gMesh);
          ghostMeshRef.current = gMesh;
        }
      } catch (e) {
        console.error('Failed to parse ghost records', e);
        ghostActiveRef.current = false;
        ghostFramesRef.current = [];
      }
    } else {
      // showGhost is off or no data — deactivate and hide existing mesh if scene is live
      ghostActiveRef.current = false;
      ghostFramesRef.current = [];
    }
    if (ghostMeshRef.current) {
      ghostMeshRef.current.visible = ghostActiveRef.current;
    }

    // Detect mobile device
    const checkMobile = () => {
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      isMobileRef.current = isTouch;
    };
    checkMobile();

  }, [level.id, settings.showGhost, raceMode, demoMode, sceneReady]);

  const handleExitAttempt = () => {
    if (raceMode && !isCompleted) {
      if (document.pointerLockElement) {
        document.exitPointerLock();
      }
      setShowExitConfirmation(true);
    } else {
      onExit();
    }
  };

  const handleConfirmEarlyExit = () => {
    setShowExitConfirmation(false);

    // Call onRaceFinished with a 6th place penalty
    if (raceMode && onRaceFinished) {
      const selfEntry = {
        username: currentUser?.username || 'You',
        time: 999999, // high time to put them at the end
        finished: false, // DNF
        isNpc: false,
        color: localStorage.getItem(`racer_color_${currentUser?.username}`) || '#3b82f6'
      };

      // Ensure all bots have a predicted final time if they haven't finished yet
      if (opponentMeshesRef.current && opponentMeshesRef.current.length > 0) {
        opponentMeshesRef.current.forEach(opp => {
          if (!opp.finished) {
            const remainingDist = Math.max(0, totalSplineLengthRef.current - opp.progressDistance);
            let predictedTime = elapsedTimeRef.current + (remainingDist / Math.max(1, opp.baseSpeed));
            if (level.id === 'monochrome_void' && predictedTime < 24.0) {
              predictedTime = 24.0 + Math.random() * 0.5;
            }
            opp.finished = true;
            opp.finalTime = parseFloat(predictedTime.toFixed(3));
          }
        });
      }

      const finalRanks = [
        selfEntry,
        ...(opponentMeshesRef.current || []).map(opp => ({
          username: opp.username,
          time: opp.finalTime,
          finished: opp.finished,
          isNpc: opp.isNpc,
          color: opp.color
        }))
      ];

      // Sort: finished players first (sorted by time), then DNF players (us)
      finalRanks.sort((a, b) => {
        if (a.finished && !b.finished) return -1;
        if (!a.finished && b.finished) return 1;
        return (a.time || 999999) - (b.time || 999999);
      });

      // Trigger the ELO and history saving in App.tsx
      onRaceFinished(0, finalRanks);
    }

    onExit();
  };

  // Restart / Setup Game Loop
  const initGame = (isManualRestart = false, isDeathReset = false) => {
    isLeaderboardLoggedRef.current = false;

    if (isManualRestart) {
      if (!isDeathReset) {
        setAttempts(prev => prev + 1);
      }
    } else {
      setAttempts(0);
    }

    // Load Personal Best ghost dynamically for the current course
    const score = localStorage.getItem(`best_time_${level.id}`);
    if (score) {
      setPersonalBest(parseFloat(score));
    } else {
      setPersonalBest(null);
    }

    // PR ghost is disabled entirely during races (bots and/or players)
    const ghostData = raceMode ? null : localStorage.getItem(`ghost_replay_${level.id}`);
    
    // Remove old ghost mesh from the scene if it exists
    if (ghostMeshRef.current && sceneRef.current) {
      sceneRef.current.remove(ghostMeshRef.current);
      ghostMeshRef.current = null;
    }

    if (ghostData && showGhostRef.current) {
      try {
        const parsed: RunReplay = JSON.parse(ghostData);
        ghostFramesRef.current = parsed.frames;
        ghostActiveRef.current = true;

        // Re-spawn the ghost mesh in the scene if we have a valid scene
        if (sceneRef.current && ghostFramesRef.current.length > 0) {
          const ghostGeom = new THREE.CapsuleGeometry(0.5, 1.0, 4, 8);
          const ghostMat = new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            transparent: true,
            opacity: 0.45,
            wireframe: true
          });
          const gMesh = new THREE.Mesh(ghostGeom, ghostMat);
          sceneRef.current.add(gMesh);
          ghostMeshRef.current = gMesh;
        }
      } catch (e) {
        console.error('Failed to parse ghost records', e);
        ghostActiveRef.current = false;
        ghostFramesRef.current = [];
      }
    } else {
      ghostActiveRef.current = false;
      ghostFramesRef.current = [];
    }

    // Remove old override ghost mesh from the scene if it exists
    if (overrideGhostMeshRef.current && sceneRef.current) {
      sceneRef.current.remove(overrideGhostMeshRef.current);
      overrideGhostMeshRef.current.geometry.dispose();
      (overrideGhostMeshRef.current.material as THREE.Material).dispose();
      overrideGhostMeshRef.current = null;
    }

    // Set up override ghost mesh.
    // Prefer fresh frames from the prop (first load / new ghost selected). If the
    // prop is null because initGame was called from a stale animation-loop closure
    // (death / manual restart), fall back to whatever frames are already stored so
    // the ghost survives across deaths and restarts. Frames are only truly cleared
    // when the player exits (App.tsx nulls the prop and the component unmounts).
    const framesToUse = (ghostOverride && ghostOverride.length > 0)
      ? ghostOverride
      : overrideGhostFramesRef.current;

    if (framesToUse.length > 0) {
      overrideGhostFramesRef.current = framesToUse;
      overrideGhostActiveRef.current = true;

      if (sceneRef.current) {
        const overrideGeom = new THREE.CapsuleGeometry(0.5, 1.0, 4, 8);
        const overrideMat = new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.65,
          wireframe: false
        });
        const overrideMesh = new THREE.Mesh(overrideGeom, overrideMat);
        sceneRef.current.add(overrideMesh);
        overrideGhostMeshRef.current = overrideMesh;
      }
    } else {
      overrideGhostActiveRef.current = false;
      overrideGhostFramesRef.current = [];
    }

    // Locate the spawn coordinate block
    const spawnBlock = level.blocks.find(b => b.type === 'start') || level.blocks[0];
    // In race mode, spawn directly on the block surface so players start grounded.
    // In regular courses, keep the 1.2-unit drop so the initial fall feels natural.
    const spawnY = spawnBlock ? spawnBlock.y + spawnBlock.h + (raceMode ? 0 : 1.2) : 4;
    const spawnX = spawnBlock ? spawnBlock.x : 0;
    const spawnZ = spawnBlock ? spawnBlock.z : 0;

    // Build sequential spline route for racing bots
    if (level.blocks && level.blocks.length > 0) {
      const seqBlocks: any[] = [];
      const startBlock = level.blocks.find(b => b.type === 'start') || level.blocks[0];

      if (level.id === 'lava_patchwork') {
        const endBlock = level.blocks.find(b => b.type === 'end');
        seqBlocks.push(startBlock);

        // Group the remaining blocks (excluding start and end) by Z coordinate
        const midBlocks = level.blocks.filter(b => b.id !== startBlock.id && (!endBlock || b.id !== endBlock.id));
        
        // Find unique Z values sorted descending (closer to 0 down to most negative)
        const uniqueZs = Array.from(new Set(midBlocks.map(b => Math.round(b.z)))).sort((a, b) => b - a);
        
        let currentBlock = startBlock;
        for (const zVal of uniqueZs) {
          const rowBlocks = midBlocks.filter(b => Math.round(b.z) === zVal);
          if (rowBlocks.length === 0) continue;

          // Prefer non-hazard blocks
          const safeBlocks = rowBlocks.filter(b => b.type !== 'hazard');
          const candidates = safeBlocks.length > 0 ? safeBlocks : rowBlocks;

          // Find the candidate block closest horizontally (X) to currentBlock
          let bestBlock = candidates[0];
          let minDx = Math.abs(bestBlock.x - currentBlock.x);
          for (let i = 1; i < candidates.length; i++) {
            const dx = Math.abs(candidates[i].x - currentBlock.x);
            if (dx < minDx) {
              minDx = dx;
              bestBlock = candidates[i];
            }
          }

          seqBlocks.push(bestBlock);
          currentBlock = bestBlock;
        }

        if (endBlock) {
          seqBlocks.push(endBlock);
        }
      } else {
        // Exclude hazard blocks from the pathfinding pool entirely so NPCs never follow a path on the floor/hazard of the map
        const blocksCopy = level.blocks.filter(b => b.type !== 'hazard');
        let currentBlock = startBlock;
        let pool = blocksCopy.filter(b => b.id !== currentBlock.id);
        seqBlocks.push(currentBlock);

        while (pool.length > 0) {
          let closestIdx = 0;
          let minDistance = Infinity;
          for (let i = 0; i < pool.length; i++) {
            const dx = pool[i].x - currentBlock.x;
            const dy = pool[i].y - currentBlock.y;
            const dz = pool[i].z - currentBlock.z;
            const dist = dx*dx + dy*dy + dz*dz;
            if (dist < minDistance) {
              minDistance = dist;
              closestIdx = i;
            }
          }
          currentBlock = pool[closestIdx];
          pool.splice(closestIdx, 1);
          seqBlocks.push(currentBlock);
        }
      }

      const points: THREE.Vector3[] = [];
      seqBlocks.forEach((b) => {
        points.push(new THREE.Vector3(b.x, b.y + b.h + 0.6, b.z));
      });
      splinePointsRef.current = points;

      const dists: number[] = [0];
      let totalDist = 0;
      for (let i = 1; i < points.length; i++) {
        const segLen = points[i].distanceTo(points[i - 1]);
        totalDist += segLen;
        dists.push(totalDist);
      }
      cumulativeSplineDistancesRef.current = dists;
      totalSplineLengthRef.current = totalDist;

      // Extract and save spline checkpoints
      const splineCheckpoints: { distance: number; position: THREE.Vector3 }[] = [];
      seqBlocks.forEach((b, i) => {
        if (b.type === 'checkpoint' || b.type === 'start') {
          splineCheckpoints.push({
            distance: dists[i],
            position: new THREE.Vector3(b.x, b.y + b.h + 1.2, b.z)
          });
        }
      });
      splineCheckpointsRef.current = splineCheckpoints;
    }

    // Reset opponent meshes unless this is a manual individual reset
    if (!isManualRestart && opponentMeshesRef.current && opponentMeshesRef.current.length > 0) {
      opponentMeshesRef.current.forEach((opp) => {
        opp.mesh.position.set(spawnX, spawnY, spawnZ);
        opp.finished = false;
        opp.finalTime = undefined;
        opp.progressDistance = 0;
        opp.speedBoostTimer = 0;
        opp.targetPosition.set(spawnX, spawnY, spawnZ);
        opp.targetYaw = 0;
        opp.velocity.set(0, 0, 0);
        opp.grounded = true;
        opp.stumbleTimer = 0;
        opp.boostTimer = 0;
        opp.jumpCooldown = 0;
        opp.lastCheckpointDistance = 0;
        opp.lastCheckpointPos = new THREE.Vector3(spawnX, spawnY, spawnZ);
      });
    }

    playerPos.current.set(spawnX, spawnY, spawnZ);
    playerVel.current.set(0, 0, 0);
    playerYaw.current = Math.PI; // point forward (down negative Z)
    playerPitch.current = 0;
    // In race mode the player spawns on the block surface, so start grounded.
    groundedRef.current = raceMode;
    lastTimeGroundedRef.current = 0;
    slideTimerRef.current = 0;
    slidingRef.current = false;
    climbingRef.current = false;
    speedBoostRef.current = 1.0;
    activeCheckpointRef.current = null;
    wallRunDirectionRef.current = null;
    wallRunCooldownRef.current = 0;
    lastWallTouchRef.current = null;
    lastJumpBlockCollisionTimeRef.current = 0;

    currentRunFramesRef.current = [];
    currentRunSpeedsRef.current = [];
    currentRunActionsRef.current = [];
    elapsedTimeRef.current = 0.00;
    currentMaxSpeedRef.current = 12.0;
    movementStartedRef.current = false;
    raceStartWallTimeRef.current = null;
    playerProgressHWMRef.current = 0;
    setElapsedTime(0.00);
    setIsCompleted(false);
    isCompletedRef.current = false;
    setIsWaitingForOthers(false);
    isWaitingForOthersRef.current = false;
    setRaceEloData(null);
    playerFinishTimeRef.current = 0;
    if (waitForOpponentsTimeoutRef.current) {
      clearTimeout(waitForOpponentsTimeoutRef.current);
      waitForOpponentsTimeoutRef.current = null;
    }
    setTimeDiff(null);
    setIsPb(false);
    setCompletionPercentile(null);
    setCompletionWorldRank(null);
    isPlayingRef.current = true;
    setRestartCount(prev => prev + 1);
    if (raceMode) {
      raceStartedRef.current = false;
      hasCountdownStartedRef.current = false;
      setRaceCountdown(null);
      countdownRef.current = 3;
    } else {
      raceStartedRef.current = true;
      countdownRef.current = null;
    }
    checkpointSoundCoolRef.current = {};
    jumpCoolRef.current = {};
    speedCoolRef.current = {};

    synths.playTick();
    updateGhostReplay();
    updateOverrideGhostReplay();
  };

  const getPointAtLength = (len: number) => {
    const pts = splinePointsRef.current;
    const dists = cumulativeSplineDistancesRef.current;
    if (pts.length === 0) return new THREE.Vector3(0, 1.2, 0);

    const clampedLen = Math.min(Math.max(0, len), totalSplineLengthRef.current);
    
    let i = 1;
    while (i < dists.length && dists[i] < clampedLen) {
      i++;
    }
    if (i >= dists.length) return pts[pts.length - 1].clone();

    const segStartLen = dists[i - 1];
    const segEndLen = dists[i];
    const segDiff = segEndLen - segStartLen;
    const ratio = segDiff > 0 ? (clampedLen - segStartLen) / segDiff : 0;

    return new THREE.Vector3().lerpVectors(pts[i - 1], pts[i], ratio);
  };

  const warpFinishedBotToEndBlock = (opp: any) => {
    if (!opp.isNpc || !opp.mesh) return;
    const endBlock = level.blocks.find((b: any) => b.type === 'end');
    let targetX = opp.mesh.position.x;
    let targetZ = opp.mesh.position.z;
    let targetY = opp.mesh.position.y;

    if (endBlock) {
      // Determine a slight spread/offset per bot so they stand neatly on the end block (usually w: 6, d: 6)
      const botIdx = opponentMeshesRef.current.indexOf(opp);
      const totalBots = opponentMeshesRef.current.length;
      const offsetAngle = (botIdx * (Math.PI * 2)) / Math.max(1, totalBots);
      const offsetRadius = 1.2; // Stay well within the bounds of the end block

      targetX = endBlock.x + Math.sin(offsetAngle) * offsetRadius;
      targetZ = endBlock.z + Math.cos(offsetAngle) * offsetRadius;
      targetY = endBlock.y + endBlock.h + 0.6;
    } else {
      // Fallback to the final point of the spline
      const targetPos = getPointAtLength(totalSplineLengthRef.current);
      targetX = targetPos.x;
      targetZ = targetPos.z;
      targetY = targetPos.y;
    }

    opp.mesh.position.set(targetX, targetY, targetZ);
    opp.velocity.set(0, 0, 0);
    opp.grounded = true;
    opp.mesh.rotation.set(0, Math.PI, 0); // Face forward/player-facing on completion
    opp.mesh.scale.set(1, 1, 1);
  };

  // Accurate spline progress for any 3D world position.
  // Finds the closest spline segment and projects onto it for sub-segment
  // precision, then returns the cumulative arc-length distance along the spline.
  const getSplineProgressForPos = (pos: THREE.Vector3): number => {
    const pts = splinePointsRef.current;
    const dists = cumulativeSplineDistancesRef.current;
    if (pts.length < 2) return 0;

    let bestDist = Infinity;
    let bestProgress = 0;

    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const ab = b.clone().sub(a);
      const lenSq = ab.lengthSq();
      const t = lenSq > 0 ? Math.max(0, Math.min(1, pos.clone().sub(a).dot(ab) / lenSq)) : 0;
      const projected = a.clone().addScaledVector(ab, t);
      const sqDist = pos.distanceToSquared(projected);
      if (sqDist < bestDist) {
        bestDist = sqDist;
        bestProgress = dists[i - 1] + t * (dists[i] - dists[i - 1]);
      }
    }

    return bestProgress;
  };

  const getPlayerSplineProgress = () => getSplineProgressForPos(playerPos.current);

  // Timer for countdown — anchored to a shared server timestamp (raceStartTime)
  // rather than each client running its own independent 3-second setTimeout
  // chain. This keeps every racer's "GO!" moment (and therefore their race
  // clock) aligned to the same instant, and self-corrects even if this tab
  // was backgrounded for part of the countdown — because we always compare
  // against the absolute goAt timestamp, not accumulated timer ticks.
  useEffect(() => {
    if (!raceMode) {
      setRaceCountdown(null);
      countdownRef.current = null;
      raceStartedRef.current = true;
      raceStartWallTimeRef.current = null;
      return;
    }

    hasCountdownStartedRef.current = true;
    raceStartedRef.current = false;
    raceStartWallTimeRef.current = null;

    const goAtMs = (raceStartTime ?? Date.now()) + 3000;
    let lastAnnounced: number | null = null;
    let interval: ReturnType<typeof setInterval>;

    const tick = () => {
      const remainingMs = goAtMs - Date.now();
      if (remainingMs <= 0) {
        setRaceCountdown(0);
        countdownRef.current = null;
        raceStartedRef.current = true;
        raceStartWallTimeRef.current = goAtMs;
        if (lastAnnounced !== 0) {
          synths.playCountdownGo();
          lastAnnounced = 0;
        }
        clearInterval(interval);
        setTimeout(() => setRaceCountdown(null), 1000);
        return;
      }
      const secondsLeft = Math.min(3, Math.ceil(remainingMs / 1000));
      setRaceCountdown(secondsLeft);
      countdownRef.current = secondsLeft;
      if (secondsLeft !== lastAnnounced) {
        synths.playCountdownTick();
        lastAnnounced = secondsLeft;
      }
    };

    tick();
    interval = setInterval(tick, 150);
    return () => clearInterval(interval);
  }, [raceMode, level.id, restartCount, raceStartTime]);

  useEffect(() => {
    if (!raceMode) return;

    // ── WebSocket handler (cross-machine real players) ─────────────────────
    const handleWsMessage = (event: MessageEvent) => {
      let msg: any;
      try { msg = JSON.parse(event.data); } catch { return; }
      const { type, username, x, y, z, ry, time } = msg;

      if (type === 'GAME_TICK') {
        const opp = opponentMeshesRef.current.find(
          o => o.username.toLowerCase().trim() === (username || '').toLowerCase().trim()
        );
        if (opp && !opp.isNpc) {
          opp.targetPosition.set(x, y + 0.8, z);
          opp.targetYaw = ry;
          opp.lastUpdateMs = Date.now();
          // Project position onto spline for accurate distance; only allow forward progress
          const splineProgress = getSplineProgressForPos(new THREE.Vector3(x, y, z));
          opp.progressDistance = Math.max(opp.progressDistance, splineProgress);
        }
      } else if (type === 'GAME_FINISHED') {
        const opp = opponentMeshesRef.current.find(
          o => o.username.toLowerCase().trim() === (username || '').toLowerCase().trim()
        );
        if (opp && !opp.isNpc && !opp.finished) {
          opp.finished = true;
          opp.finalTime = time;
          // Jump straight to standings the instant the last racer crosses the
          // line, instead of waiting for the next 300ms poll tick.
          if (isWaitingForOthersRef.current && opponentMeshesRef.current.every(o => o.finished)) {
            commitRaceResultsRef.current();
          }
        }
      }
    };

    if (raceWs) {
      if (raceWs.readyState === WebSocket.OPEN) {
        raceWs.addEventListener('message', handleWsMessage);
      } else {
        // Still connecting — attach once open, then register message listener
        const onOpen = () => {
          raceWs.addEventListener('message', handleWsMessage);
          raceWs.removeEventListener('open', onOpen);
        };
        raceWs.addEventListener('open', onOpen);
      }
    }

    // ── BroadcastChannel handler (same-origin tab fallback) ───────────────
    bcRef.current = new BroadcastChannel('momentum_races_channel');
    bcRef.current.onmessage = (event) => {
      const { type, levelId, username, x, y, z, ry, time } = event.data;
      if (levelId !== level.id) return;

      if (type === 'GAME_TICK') {
        const opp = opponentMeshesRef.current.find(o => o.username.toLowerCase().trim() === username.toLowerCase().trim());
        if (opp && !opp.isNpc) {
          opp.targetPosition.set(x, y + 0.8, z);
          opp.targetYaw = ry;
          opp.lastUpdateMs = Date.now();
          // Project position onto spline for accurate distance; only allow forward progress
          const splineProgress = getSplineProgressForPos(new THREE.Vector3(x, y, z));
          opp.progressDistance = Math.max(opp.progressDistance, splineProgress);
        }
      } else if (type === 'GAME_FINISHED') {
        const opp = opponentMeshesRef.current.find(o => o.username.toLowerCase().trim() === username.toLowerCase().trim());
        if (opp && !opp.isNpc && !opp.finished) {
          opp.finished = true;
          opp.finalTime = time;
          if (isWaitingForOthersRef.current && opponentMeshesRef.current.every(o => o.finished)) {
            commitRaceResultsRef.current();
          }
        }
      }
    };

    return () => {
      if (raceWs) raceWs.removeEventListener('message', handleWsMessage);
      bcRef.current?.close();
    };
  }, [raceMode, level.id, raceWs]);

  // Keep commitRaceResultsRef pointing to the freshest closure (captures latest state setters & refs)
  useEffect(() => {
    commitRaceResultsRef.current = () => {
      // Multiple triggers (the poll, an immediate GAME_FINISHED/NPC-finish check,
      // and the 60s straggler timeout) can all race to call this — guard so
      // standings are only committed once per race.
      if (!isWaitingForOthersRef.current) return;
      const ft = playerFinishTimeRef.current;
      const selfEntry = {
        username: currentUser?.username || 'You',
        time: ft,
        finished: true,
        isNpc: false,
        color: localStorage.getItem(`racer_color_${currentUser?.username}`) || '#3b82f6',
      };
      const finalRanks = [
        selfEntry,
        ...opponentMeshesRef.current.map(opp => ({
          username: opp.username,
          time: opp.finalTime,
          finished: opp.finished,
          isNpc: opp.isNpc,
          color: opp.color,
        })),
      ];
      finalRanks.sort((a, b) => (a.time || 999) - (b.time || 999));
      setFinalStandings(finalRanks);
      setIsWaitingForOthers(false);
      isWaitingForOthersRef.current = false;
      if (waitForOpponentsTimeoutRef.current) {
        clearTimeout(waitForOpponentsTimeoutRef.current);
        waitForOpponentsTimeoutRef.current = null;
      }
      if (onRaceFinished) onRaceFinished(ft, finalRanks);
    };
  });

  // Poll every 300 ms while waiting for all opponents to finish
  useEffect(() => {
    if (!isWaitingForOthers || !raceMode) return;
    const poll = setInterval(() => {
      if (opponentMeshesRef.current.every(o => o.finished)) {
        clearInterval(poll);
        commitRaceResultsRef.current();
      }
    }, 300);
    return () => clearInterval(poll);
  }, [isWaitingForOthers, raceMode]);

  // Three.js Viewport Construction
  useEffect(() => {
    if (!canvasRef.current || !canvasContainerRef.current) return;

    const width = canvasContainerRef.current.clientWidth;
    const height = canvasContainerRef.current.clientHeight;

    const scene = new THREE.Scene();
    
    // Theme Customisations
    let skyColor = 0xcffafe; // light cyan default
    let fogColor = 0xcffafe;

    switch (level.theme) {
      case 'sky_islands':
        skyColor = 0xcffafe;
        fogColor = 0xcffafe;
        scene.background = new THREE.Color(0xdbeafe);
        scene.fog = new THREE.FogExp2(0xdbeafe, 0.009);
        break;
      case 'neon_grid':
        skyColor = 0x090514;
        fogColor = 0x090514;
        scene.background = new THREE.Color(skyColor);
        scene.fog = new THREE.FogExp2(0x090514, 0.015);
        break;
      case 'industrial_rust':
        skyColor = 0x22130c;
        fogColor = 0x211007;
        scene.background = new THREE.Color(skyColor);
        scene.fog = new THREE.FogExp2(fogColor, 0.018);
        break;
      case 'mountain_sunset':
        skyColor = 0xfeda9f; // orange gold
        fogColor = 0xfcbc7e;
        scene.background = new THREE.Color(0xfcbd71);
        scene.fog = new THREE.FogExp2(0xfcbd71, 0.012);
        break;
      case 'abstract_white':
        skyColor = 0xf5f5f5;
        fogColor = 0xf5f5f5;
        scene.background = new THREE.Color(0xf5f5f5);
        scene.fog = new THREE.FogExp2(0xf5f5f5, 0.01);
        break;
    }

    // Set up camera & renderer
    const camera = new THREE.PerspectiveCamera(settings.fov, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true });
    renderer.setSize(width, height, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    // Ambient Lighting
    const aLight = new THREE.AmbientLight(0xffffff, level.theme === 'neon_grid' ? 0.3 : 0.7);
    scene.add(aLight);

    // Dynamic Directional Light with Shadows
    const dLight = new THREE.DirectionalLight(0xffffff, level.theme === 'neon_grid' ? 0.6 : 0.95);
    dLight.position.set(20, 60, -20);
    dLight.castShadow = true;
    dLight.shadow.mapSize.width = 1024;
    dLight.shadow.mapSize.height = 1024;
    scene.add(dLight);

    // Build course block geometry
    buildLevelGeometry(scene);

    // Spawn Opponent Meshes if in race/multiplayer mode
    const opponentMeshes: {
      username: string;
      color: string;
      isNpc: boolean;
      mesh: THREE.Mesh;
      finished: boolean;
      finalTime?: number;
      progressDistance: number;
      speedBoostTimer: number;
      lastUpdateMs: number;
      targetPosition: THREE.Vector3;
      targetYaw: number;
      baseSpeed: number;
      velocity: THREE.Vector3;
      grounded: boolean;
      stumbleTimer: number;
      boostTimer: number;
      jumpCooldown: number;
      lastCheckpointDistance: number;
      lastCheckpointPos: THREE.Vector3;
      seededRng: () => number;
      frames: GhostFrame[];
      framesLoaded: boolean;
    }[] = [];

    if (raceMode && raceOpponents) {
      raceOpponents.forEach((opponent) => {
        const oppGeom = new THREE.CapsuleGeometry(0.5, 1.0, 4, 8);
        const oppMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(opponent.color),
          transparent: true,
          opacity: 0.8,
          roughness: 0.3,
          metalness: 0.1,
        });
        const oppMesh = new THREE.Mesh(oppGeom, oppMat);
        oppMesh.castShadow = true;
        oppMesh.receiveShadow = true;

        oppMesh.position.set(0, 1.2, 0);

        const visorGeom = new THREE.BoxGeometry(0.6, 0.2, 0.4);
        const visorMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        const visorMesh = new THREE.Mesh(visorGeom, visorMat);
        visorMesh.position.set(0, 0.4, -0.3);
        oppMesh.add(visorMesh);

        // Name tag floating label representation
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'rgba(0,0,0,0)';
          ctx.fillRect(0, 0, 256, 64);
          ctx.fillStyle = 'rgba(12, 12, 12, 0.80)';
          ctx.strokeStyle = opponent.color;
          ctx.lineWidth = 4;
          
          if (typeof ctx.roundRect === 'function') {
            ctx.beginPath();
            ctx.roundRect(8, 8, 240, 48, 12);
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.fillRect(8, 8, 240, 48);
          }
          ctx.font = 'bold 20px system-ui, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(opponent.username, 128, 32);

          const nameTex = new THREE.CanvasTexture(canvas);
          const sprMat = new THREE.SpriteMaterial({ map: nameTex, transparent: true });
          const spr = new THREE.Sprite(sprMat);
          spr.scale.set(1.5, 0.38, 1);
          spr.position.set(0, 1.25, 0);
          oppMesh.add(spr);
        }

        scene.add(oppMesh);

        // NPC meshes start hidden until ghost frames are fetched
        if (opponent.isNpc) oppMesh.visible = false;

        opponentMeshes.push({
          username: opponent.username,
          color: opponent.color,
          isNpc: opponent.isNpc,
          mesh: oppMesh,
          finished: false,
          progressDistance: 0,
          speedBoostTimer: 0,
          lastUpdateMs: Date.now(),
          targetPosition: new THREE.Vector3(0, 1.2, 0),
          targetYaw: 0,
          baseSpeed: opponent.baseSpeed || 10,
          velocity: new THREE.Vector3(0, 0, 0),
          grounded: true,
          stumbleTimer: 0,
          boostTimer: 0,
          jumpCooldown: 0,
          seededRng: makeBotRng(opponent.seed ?? Math.random()),
          lastCheckpointDistance: 0,
          lastCheckpointPos: new THREE.Vector3(0, 1.2, 0),
          frames: [],
          framesLoaded: false,
        });
      });
    }
    opponentMeshesRef.current = opponentMeshes;

    // Async: load leaderboard ghost frames for each NPC opponent
    if (raceMode && raceOpponents && opponentMeshes.some(o => o.isNpc)) {
      (async () => {
        try {
          const { api: apiModule } = await import('../api');
          const entries = await apiModule.leaderboard.get(level.id);
          const frameableEntries = entries.filter((e: any) => e.hasFrames);

          // Nothing to work with — NPCs remain hidden (no ghost data yet for this level)
          if (frameableEntries.length === 0) return;

          await Promise.all(
            opponentMeshes.filter(o => o.isNpc).map(async (opp) => {
              // Pick a random entry; each NPC gets an independent pick
              const pick = frameableEntries[Math.floor(Math.random() * frameableEntries.length)];
              const result = await apiModule.leaderboard.getEntryFrames(level.id, pick.id);
              if (result && result.frames && result.frames.length > 0) {
                opp.frames = result.frames;
                opp.framesLoaded = true;
                opp.mesh.visible = true;
              }
            })
          );
        } catch (err) {
          console.warn('[NPC] Failed to load ghost frames for NPC opponents:', err);
        }
      })();
    }

    // Save Three.js references
    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    
    const clock = new THREE.Clock();
    clockRef.current = clock;

    // Direct game startup mechanics
    initGame();
    setSceneReady(true);
    isPlayingRef.current = true;
    isCompletedRef.current = false;

    // Main running execution thread loop
    let activeLoop = true;
    const gameLoop = () => {
      if (!activeLoop) return;
      requestAnimationFrame(gameLoop);

      if (isPlayingRef.current && countdownRef.current === null) {
        const dt = Math.min(clock.getDelta(), 0.1); // clamp delta ticks
        
        // Force countdown start immediately when race mode is active so NPCs of the race move correctly
        if (raceMode && !movementStartedRef.current) {
          movementStartedRef.current = true;
        }

        // Anchor the race clock to a wall-clock timestamp the first time movement
        // starts (covers the solo-mode case, where raceStartWallTimeRef isn't
        // already set by the countdown effect).
        if (movementStartedRef.current && raceStartWallTimeRef.current === null) {
          raceStartWallTimeRef.current = Date.now();
        }

        if (!isCompletedRef.current) {
          // Physics sub-stepping with max step size of 0.005 seconds (5ms) to prevent player tunneling or falling through surfaces
          const maxSubStep = 0.005;
          const subStepsCount = Math.ceil(dt / maxSubStep);
          const subStepDt = dt / subStepsCount;
          for (let i = 0; i < subStepsCount; i++) {
            updatePhysics(subStepDt);
          }

          // Record path coordinates for ghost system telemetry logs once per frame (approx. 60 FPS)
          if (movementStartedRef.current) {
            currentRunFramesRef.current.push({
              time: elapsedTimeRef.current * 1000,
              x: playerPos.current.x,
              y: playerPos.current.y,
              z: playerPos.current.z,
              rx: playerPitch.current,
              ry: playerYaw.current,
            });

            currentRunSpeedsRef.current.push(playerVel.current.length());

            // Wall-clock based elapsed time: keeps racers' clocks synchronized
            // and continues counting correctly even if rAF was throttled/paused
            // while this tab was backgrounded, instead of stalling like a
            // dt-accumulation approach would.
            if (raceStartWallTimeRef.current !== null) {
              elapsedTimeRef.current = (Date.now() - raceStartWallTimeRef.current) / 1000;
            } else {
              elapsedTimeRef.current += dt;
            }
            updateGhostReplay();
            updateOverrideGhostReplay();
            setElapsedTime(elapsedTimeRef.current);
          } else {
            currentRunFramesRef.current = [{
              time: 0,
              x: playerPos.current.x,
              y: playerPos.current.y,
              z: playerPos.current.z,
              rx: playerPitch.current,
              ry: playerYaw.current,
              state: 'run'
            }];
            currentRunSpeedsRef.current = [0];
            currentRunActionsRef.current = ['Sprinting'];
            setElapsedTime(0.00);
            updateGhostReplay();
            updateOverrideGhostReplay();
          }
        }

        // Wall-clock race time — computed independently of the player's own
        // elapsedTimeRef (which freezes once the player finishes) so bots and
        // remote opponents keep progressing toward the finish line, and the
        // "waiting for others" screen reflects their status live instead of
        // freezing until the 60s straggler timeout.
        const raceNowMs = raceStartWallTimeRef.current !== null
          ? (Date.now() - raceStartWallTimeRef.current)
          : elapsedTimeRef.current * 1000;

        // Multiplayer / Racing updates — kept running even after the local
        // player has finished, so opponents continue progressing while we
        // wait for them to cross the line.
        opponentMeshesRef.current.forEach((opp) => {
          // Define helpers to query blocks
          const getBlockSurfaceHeight = (x: number, z: number) => {
            let highestY = -Infinity;
            const r = 0.25; // Tolerance radius to handle edge alignment gracefully
            for (const block of level.blocks) {
              if (block.type === 'hazard') {
                continue;
              }
              const minX = block.x - block.w / 2 - r;
              const maxX = block.x + block.w / 2 + r;
              const minZ = block.z - block.d / 2 - r;
              const maxZ = block.z + block.d / 2 + r;
              if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
                const topY = block.y + block.h;
                if (topY > highestY) {
                  highestY = topY;
                }
              }
            }
            return highestY;
          };

          const getBlockAtCoords = (x: number, z: number) => {
            let highestY = -Infinity;
            let highestBlock = null;
            const r = 0.25; // Tolerance radius to handle edge alignment gracefully
            for (const block of level.blocks) {
              if (block.type === 'hazard') {
                continue;
              }
              const minX = block.x - block.w / 2 - r;
              const maxX = block.x + block.w / 2 + r;
              const minZ = block.z - block.d / 2 - r;
              const maxZ = block.z + block.d / 2 + r;
              if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
                const topY = block.y + block.h;
                if (topY > highestY) {
                  highestY = topY;
                  highestBlock = block;
                }
              }
            }
            return highestBlock;
          };

          if (opp.finished) {
            // Place finished NPCs at the end block once they complete the course so they do not fall to the ground or go backwards
            if (opp.isNpc) {
              const endBlock = level.blocks.find((b: any) => b.type === 'end');
              let targetX = opp.mesh.position.x;
              let targetZ = opp.mesh.position.z;
              let targetY = opp.mesh.position.y;

              if (endBlock) {
                // Determine a slight spread/offset per bot so they stand neatly on the end block (usually w: 6, d: 6)
                const botIdx = opponentMeshesRef.current.indexOf(opp);
                const totalBots = opponentMeshesRef.current.length;
                const offsetAngle = (botIdx * (Math.PI * 2)) / Math.max(1, totalBots);
                const offsetRadius = 1.2; // Stay well within the bounds of the end block

                targetX = endBlock.x + Math.sin(offsetAngle) * offsetRadius;
                targetZ = endBlock.z + Math.cos(offsetAngle) * offsetRadius;
                targetY = endBlock.y + endBlock.h + 0.6;
              } else {
                // Fallback to the final point of the spline
                const targetPos = getPointAtLength(totalSplineLengthRef.current);
                targetX = targetPos.x;
                targetZ = targetPos.z;
                targetY = targetPos.y;
              }

              // Lock them instantly to their final positions on the end block with no drifting or gliding
              opp.mesh.position.x = targetX;
              opp.mesh.position.z = targetZ;
              
              opp.velocity.set(0, 0, 0);
              opp.grounded = true;

              // Stand-still idle bobbing/breathing animation
              const idleBob = Math.sin(Date.now() * 0.003) * 0.02;
              opp.mesh.position.y = targetY + idleBob;

              // Rotate them to face forward/player-facing on completion
              opp.mesh.rotation.x = 0;
              opp.mesh.rotation.z = 0;
              opp.mesh.rotation.y = Math.PI;

              opp.mesh.scale.set(1, 1, 1);
              return;
            }
            // Finished real (WS) players fall through to the lerp below so
            // their mesh keeps tracking the live targetPosition updates that
            // continue arriving from the remote client after they finish.
          }

          if (opp.isNpc) {
            // Ghost-replay NPCs: position directly from recorded leaderboard frames.
            // Frames are loaded asynchronously after scene init; NPC stays hidden until ready.
            if (!opp.framesLoaded || opp.frames.length === 0) return;

            const targetMs = raceNowMs;
            const frames = opp.frames;
            const lastFrame = frames[frames.length - 1];

            // NPC finished — hand off to idle end-block animation
            if (targetMs >= lastFrame.time) {
              if (!opp.finished) {
                opp.finished = true;
                opp.finalTime = parseFloat((lastFrame.time / 1000).toFixed(3));
                opp.progressDistance = totalSplineLengthRef.current;
                warpFinishedBotToEndBlock(opp);
                // Jump straight to standings the instant the last racer finishes,
                // instead of waiting for the next 300ms poll tick.
                if (isWaitingForOthersRef.current && opponentMeshesRef.current.every(o => o.finished)) {
                  commitRaceResultsRef.current();
                }
              }
              return;
            }

            // Binary-search for the surrounding frame pair
            let lo = 0;
            let hi = frames.length - 1;
            while (lo < hi - 1) {
              const mid = (lo + hi) >> 1;
              if (frames[mid].time <= targetMs) lo = mid; else hi = mid;
            }
            const fA = frames[lo];
            const fB = frames[hi];
            const span = fB.time - fA.time;
            const tFrac = span > 0 ? Math.min(1, (targetMs - fA.time) / span) : 0;

            opp.mesh.position.set(
              THREE.MathUtils.lerp(fA.x, fB.x, tFrac),
              THREE.MathUtils.lerp(fA.y, fB.y, tFrac) + 0.8,
              THREE.MathUtils.lerp(fA.z, fB.z, tFrac)
            );
            opp.mesh.rotation.x = THREE.MathUtils.lerp(fA.rx, fB.rx, tFrac);
            opp.mesh.rotation.y = THREE.MathUtils.lerp(fA.ry, fB.ry, tFrac);
            opp.mesh.rotation.z = 0;
            opp.mesh.scale.set(1, 1, 1);

            // Keep progressDistance meaningful for live-rankings sort
            opp.progressDistance = (targetMs / lastFrame.time) * totalSplineLengthRef.current;
          } else {
            // Linearly interpolate received websocket positions
            opp.mesh.position.lerp(opp.targetPosition, 0.15);
            opp.mesh.rotation.y = THREE.MathUtils.lerp(opp.mesh.rotation.y, opp.targetYaw, 0.15);
          }
        });

        // Broadcast current position to opponents continuously so that
        // every other client can see the local player's position even after
        // they have crossed the finish line.
        if (raceMode) {
          const tickPayload = {
            type: 'GAME_TICK',
            roomId: raceRoomId,
            levelId: level.id,
            username: currentUser?.username || 'Guest',
            x: playerPos.current.x,
            y: playerPos.current.y,
            z: playerPos.current.z,
            ry: playerYaw.current,
            time: elapsedTimeRef.current,
          };
          // Prefer WebSocket (cross-machine); fall back to BroadcastChannel
          if (raceWs && raceWs.readyState === WebSocket.OPEN) {
            raceWs.send(JSON.stringify(tickPayload));
          } else if (bcRef.current) {
            try { bcRef.current.postMessage(tickPayload); } catch { /* channel closed during unmount */ }
          }
        }

        // Live HUD position standings update
        if (raceMode) {
          liveUpdateFrameCountRef.current++;
          if (liveUpdateFrameCountRef.current % 12 === 0) {
            // Only allow progress to advance — prevents snapping backwards on
            // curved sections where two spline points are close together.
            const rawProgress = getPlayerSplineProgress();
            if (!isCompletedRef.current) {
              playerProgressHWMRef.current = Math.max(playerProgressHWMRef.current, rawProgress);
            }
            const ourProgress = isCompletedRef.current
              ? totalSplineLengthRef.current
              : playerProgressHWMRef.current;
            const selfEntry = {
              username: currentUser?.username || 'You',
              color: localStorage.getItem(`racer_color_${currentUser?.username}`) || '#3b82f6',
              isNpc: false,
              finished: isCompletedRef.current,
              progressDistance: ourProgress,
              finalTime: isCompletedRef.current ? completionTime : undefined
            };

            const list = [
              selfEntry,
              ...opponentMeshesRef.current.map(o => ({
                username: o.username,
                color: o.color,
                isNpc: o.isNpc,
                finished: o.finished,
                progressDistance: o.progressDistance,
                finalTime: o.finalTime
              }))
            ];

            list.sort((a, b) => {
              if (a.finished && b.finished) {
                return (a.finalTime || 9999) - (b.finalTime || 9999);
              }
              if (a.finished) return -1;
              if (b.finished) return 1;
              return b.progressDistance - a.progressDistance;
            });

            setLiveRankings(list);
          }
        }
      }

      if (renderer && scene && camera) {
        // Perspective is always locked to the default forward orientation
        playerYaw.current = Math.PI;
        playerPitch.current = 0;

        // Render Camera following Player offsets
        const playerHeightOffset = 1.7;
        
        // Wall-run camera visual tilt
        let tiltFactor = 0;
        if (wallRunDirectionRef.current === 'left') tiltFactor = -0.12;
        if (wallRunDirectionRef.current === 'right') tiltFactor = 0.12;

        camera.position.set(playerPos.current.x, playerPos.current.y + playerHeightOffset, playerPos.current.z);
        
        // Apply camera yaw / pitch rotation transformations
        const target = new THREE.Vector3();
        target.x = camera.position.x + Math.sin(playerYaw.current) * Math.cos(playerPitch.current);
        target.y = camera.position.y + Math.sin(playerPitch.current);
        target.z = camera.position.z + Math.cos(playerYaw.current) * Math.cos(playerPitch.current);
        
        camera.lookAt(target);
        
        // Custom vertical up-vector rot to simulate camera rolling slides
        const rollAxis = new THREE.Vector3(Math.cos(playerYaw.current), 0, -Math.sin(playerYaw.current)).normalize();
        camera.up.set(0, 1, 0).applyAxisAngle(rollAxis, tiltFactor);

        renderer.render(scene, camera);
      }
    };
    gameLoop();

    // Resize container bindings
    const handleResize = () => {
      if (!canvasContainerRef.current || !cameraRef.current || !rendererRef.current) return;
      const w = canvasContainerRef.current.clientWidth;
      const h = canvasContainerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h, false);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      activeLoop = false;
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
      // Scene is being torn down (level change/unmount) — any mesh referencing it
      // (including the PB ghost) is no longer attached to a live scene. Clear refs
      // so the ghost-loading effect doesn't skip recreation thinking a mesh already
      // exists, and don't leave stale Three.js instances behind.
      sceneRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      ghostMeshRef.current = null;
      setSceneReady(false);
    };

  }, [level.id, level.theme, level.blocks.length]);

  // Construct standard level blocks meshes
  const buildLevelGeometry = (scene: THREE.Scene) => {
    level.blocks.forEach(block => {
      if (block.type === 'climb') {
        const ladderGroup = new THREE.Group();
        ladderGroup.position.set(block.x, block.y + block.h / 2, block.z);

        // Vertical rails on the sides
        const railGeometry = new THREE.BoxGeometry(0.12, block.h, 0.12);
        const railMaterial = new THREE.MeshStandardMaterial({
          color: 0x4b5563, // Dark iron metal
          roughness: 0.5,
          metalness: 0.8
        });

        const leftRail = new THREE.Mesh(railGeometry, railMaterial);
        leftRail.position.set(-block.w / 2 + 0.15, 0, 0);
        leftRail.castShadow = true;
        leftRail.receiveShadow = true;
        ladderGroup.add(leftRail);

        const rightRail = new THREE.Mesh(railGeometry, railMaterial);
        rightRail.position.set(block.w / 2 - 0.15, 0, 0);
        rightRail.castShadow = true;
        rightRail.receiveShadow = true;
        ladderGroup.add(rightRail);

        // Horizontal rungs spanning the width
        const rungStep = 0.5; // Dense realistic rung spacing
        const rungThickness = 0.06;
        const rungGeometry = new THREE.BoxGeometry(block.w - 0.3, rungThickness, rungThickness);
        const rungMaterial = new THREE.MeshStandardMaterial({
          color: 0xd97706, // Amber golden steel rungs
          roughness: 0.4,
          metalness: 0.9,
          emissive: 0x92400e,
          emissiveIntensity: 0.2
        });

        const halfH = block.h / 2;
        for (let ry = -halfH + 0.25; ry <= halfH - 0.25; ry += rungStep) {
          const rung = new THREE.Mesh(rungGeometry, rungMaterial);
          rung.position.set(0, ry, 0);
          rung.castShadow = true;
          rung.receiveShadow = true;
          ladderGroup.add(rung);
        }

        scene.add(ladderGroup);
        return;
      }

      const geometry = new THREE.BoxGeometry(block.w, block.h, block.d);
      
      // Select appropriate theme materials
      let baseColor = 0xffffff;
      let roughness = 0.8;
      let metalness = 0.0;
      let emissive = 0x000000;
      let wire = false;
      const themeColors: { [id: string]: number } = {
        sky_islands: 0xf3f4f6,
        neon_grid: 0x111827,
        industrial_rust: 0x57534e,
        mountain_sunset: 0x78716c,
        abstract_white: 0xe5e5e5
      };

      baseColor = themeColors[level.theme] || 0xffffff;

      // Color customization based on Block characteristics
      switch (block.type) {
        case 'start':
          baseColor = 0x10b981; // Emerald
          emissive = 0x059669;
          break;
        case 'end':
          baseColor = 0x2563eb; // Royal blue
          emissive = 0x1d4ed8;
          break;
        case 'wallrun':
          baseColor = level.theme === 'neon_grid' ? 0xa855f7 : 0x7c3aed; // vibrant purple
          emissive = level.theme === 'neon_grid' ? 0x6b21a8 : 0x4c1d95;
          break;
        case 'jump':
          baseColor = 0xf59e0b; // Amber launchpad
          emissive = 0xd97706;
          break;
        case 'hazard':
          baseColor = 0xef4444; // laser scarlet
          emissive = 0xb91c1c;
          break;
        case 'speed':
          baseColor = 0xec4899; // Speed Conveyor pink
          emissive = 0xdb2777;
          break;
        case 'checkpoint':
          baseColor = 0x84cc16; // Lime green glowing
          emissive = 0x4d7c0f;
          break;
        case 'glass':
          baseColor = 0x93c5fd; // Clear ice block
          roughness = 0.05;
          metalness = 0.9;
          break;
      }

      const material = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: roughness,
        metalness: metalness,
        emissive: emissive,
        emissiveIntensity: emissive !== 0x000000 ? 0.4 : 0.0,
        wireframe: wire,
        transparent: block.type === 'checkpoint' || block.type === 'glass',
        opacity: block.type === 'checkpoint' ? 0.35 : block.type === 'glass' ? 0.5 : 1.0
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(block.x, block.y + block.h / 2, block.z); // Center pivot correctly
      mesh.receiveShadow = true;
      mesh.castShadow = block.type !== 'checkpoint';

      scene.add(mesh);
    });
  };

  // Touch listener hooks setup (Mobile look & touch coordinates lookup)
  const handleTouchStart = (e: React.TouchEvent) => {
    const halfWidth = window.innerWidth / 2;
    const changedTouches = e.changedTouches;

    for (let i = 0; i < changedTouches.length; i++) {
      const touch = changedTouches[i];
      if (touch.clientX < halfWidth) {
        // If joystick not active, start tracking (if enabled)
        if (settings.showJoystick !== false && joystickTouchIdRef.current === null) {
          joystickTouchIdRef.current = touch.identifier;
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
          touchMoveRef.current = { x: touch.clientX, y: touch.clientY };
          
          setTouchJoystickActive(true);
          touchJoystickActiveRef.current = true;
          setTouchJoystickOffset({ x: 0, y: 0 });
          touchJoystickOffsetRef.current = { x: 0, y: 0 };
        }
      } else {
        // Perspective is locked; touch look control is disabled
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touches = e.touches;
    
    for (let i = 0; i < touches.length; i++) {
      const touch = touches[i];
      if (touch.identifier === joystickTouchIdRef.current) {
        if (touchStartRef.current) {
          touchMoveRef.current = { x: touch.clientX, y: touch.clientY };
          const dx = touch.clientX - touchStartRef.current.x;
          const dy = touch.clientY - touchStartRef.current.y;
          const maxDist = 45; // max joystick bounds
          const dist = Math.hypot(dx, dy);
          
          let ox = dx;
          let oy = dy;
          if (dist > maxDist) {
            ox = (dx / dist) * maxDist;
            oy = (dy / dist) * maxDist;
          }
          setTouchJoystickOffset({ x: ox, y: oy });
          touchJoystickOffsetRef.current = { x: ox, y: oy };
        }
      } else if (touch.identifier === lookTouchIdRef.current) {
        // Perspective is locked; touch look control is disabled
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touches = e.touches;
    
    // Check if our tracked touches are still present in the active touches list
    let joystickStillActive = false;
    let lookStillActive = false;
    
    for (let i = 0; i < touches.length; i++) {
      if (touches[i].identifier === joystickTouchIdRef.current) {
        joystickStillActive = true;
      }
      if (touches[i].identifier === lookTouchIdRef.current) {
        lookStillActive = true;
      }
    }
    
    if (!joystickStillActive) {
      joystickTouchIdRef.current = null;
      touchStartRef.current = null;
      touchMoveRef.current = null;
      setTouchJoystickActive(false);
      touchJoystickActiveRef.current = false;
      setTouchJoystickOffset({ x: 0, y: 0 });
      touchJoystickOffsetRef.current = { x: 0, y: 0 };
    }
    if (!lookStillActive) {
      lookTouchIdRef.current = null;
      touchLookStartRef.current = null;
    }
  };

  // Keyboard Event bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((k === ' ' || k === 'space') && e.repeat) {
        return;
      }
      keysRef.current[k] = true;

      // Fast immediate R button to retry
      if (k === 'r') {
        if (raceMode) return; // block restarting in races!
        e.preventDefault();
        initGame(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [level.id, raceMode]);

  // Pointer lock callback trigger for desktops
  const handleCanvasClick = () => {
    if (!isMobileRef.current && canvasRef.current) {
      canvasRef.current.requestPointerLock();
    }
  };

  // When a new ghost override is injected (user clicked "Race Ghost" from leaderboard),
  // restart the run from the top so they race the ghost from the start.
  const ghostOverrideRef = useRef(ghostOverride);
  useEffect(() => {
    if (ghostOverrideRef.current === ghostOverride) return; // no actual change
    ghostOverrideRef.current = ghostOverride;
    if (ghostOverride && ghostOverride.length > 0) {
      initGame(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ghostOverride]);

  // Handle Mouse movement looking rotations
  useEffect(() => {
    // Perspective is always locked; mouse-look is disabled.
  }, []);

  // ─── Physics: split-axis AABB collision ──────────────────────────────────────
  // Movement is split into three independent axis passes (X → Z → Y).  Each pass
  // moves the player on that axis and resolves overlaps for that axis only.  This
  // eliminates the "shallowest-overlap" heuristic that caused edge-sucking,
  // ridge-stops, and the leavingTopEdge / centerInsideXZ hacks.
  const updatePhysics = (dt: number) => {
    const PLAYER_RADIUS = 0.65;
    const PLAYER_HEIGHT = slidingRef.current ? 0.9 : 1.8;

    // ── Input ──────────────────────────────────────────────────────────────────
    const yaw = playerYaw.current;
    const forwardVec = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const rightVec   = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw));

    let moveForward = 0;
    let moveRight   = 0;
    if (isMobileRef.current && touchJoystickActiveRef.current) {
      moveForward = -touchJoystickOffsetRef.current.y / 45;
      moveRight   =  touchJoystickOffsetRef.current.x / 45;
    } else {
      if (keysRef.current['w'] || keysRef.current['arrowup']    || keysRef.current['up'])    moveForward += 1;
      if (keysRef.current['s'] || keysRef.current['arrowdown']  || keysRef.current['down'])  moveForward -= 1;
      if (keysRef.current['a'] || keysRef.current['arrowleft']  || keysRef.current['left'])  moveRight   -= 1;
      if (keysRef.current['d'] || keysRef.current['arrowright'] || keysRef.current['right']) moveRight   += 1;
    }

    const inputVec = new THREE.Vector3();
    inputVec.addScaledVector(forwardVec, moveForward);
    inputVec.addScaledVector(rightVec,   moveRight);
    if (inputVec.length() > 1) inputVec.normalize();

    const hasDirectionalInput = inputVec.length() > 0.01;
    const keysPressed = hasDirectionalInput;

    // Track the moment any movement input is first detected (starts the timer / ghost)
    if (!movementStartedRef.current) {
      const hasAnyInput = hasDirectionalInput || keysRef.current[' '] || keysRef.current['space'];
      if (hasAnyInput) movementStartedRef.current = true;
    }

    // ── Gravity ────────────────────────────────────────────────────────────────
    let gravity = 23.5;
    if (climbingRef.current)           gravity = 0;   // suspended on ladder
    else if (wallRunDirectionRef.current) gravity = 6.0; // slow wall-slide
    playerVel.current.y -= gravity * dt;

    // ── Horizontal drag ────────────────────────────────────────────────────────
    const drag = groundedRef.current ? (keysPressed ? 2.5 : 8.5) : 1.5;
    playerVel.current.x -= playerVel.current.x * drag * dt;
    playerVel.current.z -= playerVel.current.z * drag * dt;

    // ── Ground speed ramp (12 → 18 m/s while running) ──────────────────────────
    if (groundedRef.current) {
      if (hasDirectionalInput) {
        currentMaxSpeedRef.current = Math.min(18.0, currentMaxSpeedRef.current + 2.0 * dt);
      } else {
        currentMaxSpeedRef.current = Math.max(12.0, currentMaxSpeedRef.current - 12.0 * dt);
      }
    }

    // ── Acceleration ───────────────────────────────────────────────────────────
    const accelRate = groundedRef.current ? 50.0 : 18.0;
    playerVel.current.addScaledVector(inputVec, accelRate * speedBoostRef.current * dt);

    // ── Speed cap ──────────────────────────────────────────────────────────────
    const horizSpeedNow = Math.hypot(playerVel.current.x, playerVel.current.z);
    const maxSpeed = currentMaxSpeedRef.current * speedBoostRef.current;
    if (horizSpeedNow > maxSpeed) {
      if (speedBoostRef.current === 1.0) {
        // Soft decay — feels natural rather than a hard wall
        const decayRate = groundedRef.current ? 4.5 : 1.2;
        const capped = Math.max(maxSpeed, horizSpeedNow - (horizSpeedNow - maxSpeed) * decayRate * dt);
        playerVel.current.x = (playerVel.current.x / horizSpeedNow) * capped;
        playerVel.current.z = (playerVel.current.z / horizSpeedNow) * capped;
      } else {
        // Hard cap during boosts so speed never escapes control
        playerVel.current.x = (playerVel.current.x / horizSpeedNow) * maxSpeed;
        playerVel.current.z = (playerVel.current.z / horizSpeedNow) * maxSpeed;
      }
    }

    // ── Climbing input ─────────────────────────────────────────────────────────
    if (climbingRef.current) {
      playerVel.current.y = 0;
      const climbUp   = keysRef.current['w'] || keysRef.current['arrowup']
                        || (isMobileRef.current && touchJoystickActiveRef.current && touchJoystickOffsetRef.current.y < -15);
      const climbDown = keysRef.current['s'] || keysRef.current['arrowdown']
                        || (isMobileRef.current && touchJoystickActiveRef.current && touchJoystickOffsetRef.current.y > 15);
      if (climbUp)   playerVel.current.y =  6.0;
      if (climbDown) playerVel.current.y = -6.0;
    }

    // ── Jump ───────────────────────────────────────────────────────────────────
    const wantsJump = keysRef.current[' '] || keysRef.current['space'];
    if (wantsJump) {
      keysRef.current[' ']     = false;
      keysRef.current['space'] = false;

      const now = Date.now();
      const recentJumpPad  = (now - lastJumpBlockCollisionTimeRef.current) < 250;
      const recentWallTouch = lastWallTouchRef.current !== null
                              && (now - lastWallTouchRef.current.time < 350)
                              && !groundedRef.current;
      const coyoteOk = groundedRef.current || (now - lastTimeGroundedRef.current < 160);

      if (recentJumpPad) {
        // Manual boost on a jump pad — huge launch
        playerVel.current.y = 26.0;
        playerVel.current.addScaledVector(forwardVec, 5.5);
        groundedRef.current = false;
        lastJumpBlockCollisionTimeRef.current = 0;
        synths.playBoost();
      } else if (coyoteOk) {
        // Normal jump with coyote-time grace window
        playerVel.current.y = 14.5;
        groundedRef.current = false;
        lastTimeGroundedRef.current = 0;
        synths.playJump();
      } else if (recentWallTouch && lastWallTouchRef.current) {
        // Wall jump using stored contact normal
        const wallNormal = lastWallTouchRef.current.normal.clone();
        playerVel.current.y = 14.5;
        playerVel.current.x = wallNormal.x * 8.5 + forwardVec.x * 5.5;
        playerVel.current.z = wallNormal.z * 8.5 + forwardVec.z * 5.5;
        wallRunDirectionRef.current  = null;
        wallRunCooldownRef.current   = 0.35;
        lastWallTouchRef.current     = null;
        synths.playJump();
      } else if (wallRunDirectionRef.current) {
        // Wall-run jump — kick away from the wall
        const wallNormal = new THREE.Vector3(-Math.cos(yaw), 0, Math.sin(yaw)).normalize();
        if (wallRunDirectionRef.current === 'right') wallNormal.negate();
        playerVel.current.y = 14.5;
        playerVel.current.x = wallNormal.x * 8.5 + forwardVec.x * 5.5;
        playerVel.current.z = wallNormal.z * 8.5 + forwardVec.z * 5.5;
        wallRunDirectionRef.current = null;
        wallRunCooldownRef.current  = 0.35;
        synths.playJump();
      } else if (climbingRef.current) {
        // Dismount from ladder
        playerVel.current.y = 10.5;
        playerVel.current.addScaledVector(forwardVec, -4.0);
        climbingRef.current = false;
        synths.playJump();
      }
    }

    if (wallRunCooldownRef.current > 0) wallRunCooldownRef.current -= dt;

    // ── Helper: is a block solid (participates in physical collision)? ──────────
    // Hazard, end, and climb blocks are "pass-through" trigger zones;
    // checkpoint / jump / speed are solid AND trigger events.
    const isSolid = (type: string) =>
      type !== 'hazard' && type !== 'end' && type !== 'climb';

    // Shared wall-contact state accumulated across both X and Z passes.
    // adjacentWallContact is set whenever the player is pushed off a wall-run
    // or normal block in either axis while airborne, so X-facing and Z-facing
    // walls both activate wall-run consistently.
    let adjacentWallContact: 'left' | 'right' | null = null;

    // ── Pass 1: Move X, resolve X collisions ───────────────────────────────────
    playerPos.current.x += playerVel.current.x * dt;
    {
      const r = PLAYER_RADIUS, h = PLAYER_HEIGHT;
      for (const block of level.blocks) {
        if (!isSolid(block.type)) continue;
        const minX = block.x - block.w / 2, maxX = block.x + block.w / 2;
        const minY = block.y,                maxY = block.y + block.h;
        const minZ = block.z - block.d / 2,  maxZ = block.z + block.d / 2;
        const px = playerPos.current.x, py = playerPos.current.y, pz = playerPos.current.z;

        if (!(px + r > minX && px - r < maxX &&
              py + h > minY && py   < maxY   &&
              pz + r > minZ && pz - r < maxZ)) continue;

        // Determine push side before modifying position
        const pushLeft = px < (minX + maxX) * 0.5;

        // Push out on X
        if (pushLeft) {
          playerPos.current.x = minX - r;
        } else {
          playerPos.current.x = maxX + r;
        }
        playerVel.current.x = 0;

        // Side contact with a jump block — fire the launch just like a top contact
        if (block.type === 'jump') {
          const now = Date.now();
          lastJumpBlockCollisionTimeRef.current = now;
          if (now - (jumpCoolRef.current[block.id] || 0) > 500) {
            playerVel.current.y = 22.5;
            playerVel.current.x = forwardVec.x * 8.5;
            playerVel.current.z = forwardVec.z * 8.5;
            synths.playBoost();
            jumpCoolRef.current[block.id] = now;
          }
        }

        // Record wall contact for wall-jump and (for wallrun/normal) wall-run
        if (!groundedRef.current && wallRunCooldownRef.current <= 0) {
          const normX = pushLeft ? -1 : 1;
          lastWallTouchRef.current = {
            normal:  new THREE.Vector3(normX, 0, 0),
            time:    Date.now(),
            blockId: block.id,
          };
          // X-axis wall contact: treat as "right" if wall is to our right, "left" if to our left
          if (block.type === 'wallrun' || block.type === 'normal') {
            adjacentWallContact = pushLeft ? 'right' : 'left';
          }
        }
      }
    }

    // ── Pass 2: Move Z, resolve Z collisions ───────────────────────────────────
    playerPos.current.z += playerVel.current.z * dt;
    {
      const r = PLAYER_RADIUS, h = PLAYER_HEIGHT;

      for (const block of level.blocks) {
        if (!isSolid(block.type)) continue;
        const minX = block.x - block.w / 2, maxX = block.x + block.w / 2;
        const minY = block.y,                maxY = block.y + block.h;
        const minZ = block.z - block.d / 2,  maxZ = block.z + block.d / 2;
        const px = playerPos.current.x, py = playerPos.current.y, pz = playerPos.current.z;

        if (!(px + r > minX && px - r < maxX &&
              py + h > minY && py   < maxY   &&
              pz + r > minZ && pz - r < maxZ)) continue;

        const pushNeg = pz < (minZ + maxZ) * 0.5;

        // Push out on Z
        if (pushNeg) {
          playerPos.current.z = minZ - r;
        } else {
          playerPos.current.z = maxZ + r;
        }
        playerVel.current.z = 0;

        // Side contact with a jump block — fire the launch just like a top contact
        if (block.type === 'jump') {
          const now = Date.now();
          lastJumpBlockCollisionTimeRef.current = now;
          if (now - (jumpCoolRef.current[block.id] || 0) > 500) {
            playerVel.current.y = 22.5;
            playerVel.current.x = forwardVec.x * 8.5;
            playerVel.current.z = forwardVec.z * 8.5;
            synths.playBoost();
            jumpCoolRef.current[block.id] = now;
          }
        }

        // Record wall contact for wall-jump and wall-run
        if (!groundedRef.current && wallRunCooldownRef.current <= 0) {
          const normZ = pushNeg ? -1 : 1;
          lastWallTouchRef.current = {
            normal:  new THREE.Vector3(0, 0, normZ),
            time:    Date.now(),
            blockId: block.id,
          };
          if (block.type === 'wallrun' || block.type === 'normal') {
            adjacentWallContact = pushNeg ? 'right' : 'left';
          }
        }
      }
    }

    // ── Wall-run activation (unified from X and Z contacts) ────────────────────
    {
      const movingForward = keysRef.current['w']
        || (isMobileRef.current && touchJoystickActiveRef.current && touchJoystickOffsetRef.current.y < -15);
      if (adjacentWallContact && movingForward) {
        if (!wallRunDirectionRef.current) synths.playWallrun();
        wallRunDirectionRef.current = adjacentWallContact;
      } else {
        wallRunDirectionRef.current = null;
      }
    }

    // ── Pass 3: Move Y, resolve Y collisions, fire block triggers ─────────────
    // Snapshot vertical velocity BEFORE any block triggers fire.  Jump-pad
    // and speed triggers modify playerVel.y; we need the arrival velocity to
    // correctly decide floor (coming down) vs ceiling (going up) contact.
    const arrivalVelY = playerVel.current.y;
    playerPos.current.y += arrivalVelY * dt;
    {
      const r = PLAYER_RADIUS, h = PLAYER_HEIGHT;
      let nextGrounded = false;
      let nextClimbing = false;
      let died = false;
      let finished = false;

      for (const block of level.blocks) {
        const minX = block.x - block.w / 2, maxX = block.x + block.w / 2;
        const minY = block.y,                maxY = block.y + block.h;
        const minZ = block.z - block.d / 2,  maxZ = block.z + block.d / 2;
        const px = playerPos.current.x, py = playerPos.current.y, pz = playerPos.current.z;

        if (!(px + r > minX && px - r < maxX &&
              py + h > minY && py   < maxY   &&
              pz + r > minZ && pz - r < maxZ)) continue;

        // ── Trigger-only blocks ────────────────────────────────────────────────
        if (block.type === 'hazard') { died = true; break; }
        if (block.type === 'end')    { finished = true; break; }

        if (block.type === 'climb') {
          nextClimbing = true;
          continue; // no physical resolution — player can overlap ladders
        }

        if (block.type === 'checkpoint') {
          const chId = `ch_${block.id}`;
          const cpPos = new THREE.Vector3(block.x, block.y + 1.2, block.z);
          if (!activeCheckpointRef.current || !activeCheckpointRef.current.equals(cpPos)) {
            activeCheckpointRef.current = cpPos;
            const now = Date.now();
            if (now - (checkpointSoundCoolRef.current[chId] || 0) > 4000) {
              synths.playCheckpoint();
              checkpointSoundCoolRef.current[chId] = now;
            }
          }
          // Checkpoint blocks are physical — fall through to Y resolution below
        }

        if (block.type === 'jump') {
          const now = Date.now();
          lastJumpBlockCollisionTimeRef.current = now;
          if (now - (jumpCoolRef.current[block.id] || 0) > 500) {
            // Automatic launch — fires after Y resolution so it takes effect next frame
            playerVel.current.y = 22.5;
            playerVel.current.x = forwardVec.x * 8.5;
            playerVel.current.z = forwardVec.z * 8.5;
            synths.playBoost();
            jumpCoolRef.current[block.id] = now;
          }
          // Jump blocks are physical — fall through to Y resolution, but don't
          // ground the player (they should be launched, not stick to the pad)
        }

        if (block.type === 'speed') {
          const now = Date.now();
          if (now - (speedCoolRef.current[block.id] || 0) > 800) {
            speedBoostRef.current = 1.6;
            playerVel.current.add(forwardVec.clone().multiplyScalar(6.5));
            synths.playBoost();
            speedCoolRef.current[block.id] = now;
            setTimeout(() => { speedBoostRef.current = 1.0; }, 800);
          }
          // Speed pads are physical — fall through to Y resolution below
        }

        // ── Y-axis resolution ──────────────────────────────────────────────────
        // Use arrivalVelY (pre-trigger) to determine contact direction so that
        // a jump-pad's post-trigger upward velocity doesn't flip floor→ceiling.
        if (arrivalVelY <= 0) {
          // Player was falling — landed on top of block
          playerPos.current.y = maxY;
          if (block.type !== 'jump') {
            // Jump blocks launch; don't zero vel or mark grounded
            playerVel.current.y = 0;
            nextGrounded = true;
            if (!groundedRef.current) synths.playLand();
          }
        } else {
          // Player was rising — bumped head on ceiling
          playerPos.current.y = minY - h;
          playerVel.current.y = 0;
        }
      }

      // Commit grounded / climbing state
      groundedRef.current = nextGrounded;
      if (nextGrounded) lastTimeGroundedRef.current = Date.now();
      climbingRef.current = nextClimbing;

      // Process death / finish after full resolution so position is final
      if (died)     { handlePlayerDeath();    return; }
      if (finished) { handleLevelCompleted(); return; }
    }

    // ── Fall out of bounds ─────────────────────────────────────────────────────
    if (playerPos.current.y < -35) {
      handlePlayerDeath();
      return;
    }

    // ── HUD updates ────────────────────────────────────────────────────────────
    setSpeed(Math.round(playerVel.current.length()));
    const mods: string[] = [];
    if (wallRunDirectionRef.current) mods.push('WALL-RUN');
    if (climbingRef.current)         mods.push('CLIMBING');
    if (speedBoostRef.current > 1.0) mods.push('BOOST');
    setActiveModifiers(mods);
  };

  // Binary-search + linear interpolation between two surrounding keyframes.
  // Returns a smooth in-between position/rotation at any timestamp, so the
  // ghost moves at full render frame rate even with ~10 fps stored keyframes.
  const interpolateGhostFrame = (
    frames: GhostFrame[],
    targetMs: number
  ): { x: number; y: number; z: number; rx: number; ry: number } | null => {
    if (frames.length === 0) return null;
    if (targetMs <= frames[0].time) return frames[0];
    const last = frames[frames.length - 1];
    if (targetMs >= last.time) return last;

    let lo = 0, hi = frames.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >>> 1;
      if (frames[mid].time <= targetMs) lo = mid; else hi = mid;
    }
    const fA = frames[lo];
    const fB = frames[hi];
    const span = fB.time - fA.time;
    if (span <= 0) return fA;
    const t = (targetMs - fA.time) / span;

    const x  = fA.x  + (fB.x  - fA.x)  * t;
    const y  = fA.y  + (fB.y  - fA.y)  * t;
    const z  = fA.z  + (fB.z  - fA.z)  * t;
    const rx = fA.rx + (fB.rx - fA.rx) * t;

    // Shortest-path lerp for yaw so the ghost doesn't spin the long way round
    let dyaw = fB.ry - fA.ry;
    if (dyaw >  Math.PI) dyaw -= 2 * Math.PI;
    if (dyaw < -Math.PI) dyaw += 2 * Math.PI;
    const ry = fA.ry + dyaw * t;

    return { x, y, z, rx, ry };
  };

  // Replay ghost coordinates side-by-side
  const updateGhostReplay = () => {
    if (!ghostMeshRef.current) return;
    // Hide immediately when toggled off or no frames available
    if (!ghostActiveRef.current || !showGhostRef.current || ghostFramesRef.current.length === 0) {
      ghostMeshRef.current.visible = false;
      return;
    }
    ghostMeshRef.current.visible = true;
    const frame = interpolateGhostFrame(ghostFramesRef.current, elapsedTimeRef.current * 1000);
    if (frame) {
      ghostMeshRef.current.position.set(frame.x, frame.y + 0.8, frame.z);
      ghostMeshRef.current.rotation.set(frame.rx, frame.ry, 0);
    }
  };

  // Replay the selected leaderboard ghost (amber / orange, distinct from PR ghost)
  const updateOverrideGhostReplay = () => {
    if (!overrideGhostMeshRef.current) return;
    if (!overrideGhostActiveRef.current || overrideGhostFramesRef.current.length === 0) {
      overrideGhostMeshRef.current.visible = false;
      return;
    }
    overrideGhostMeshRef.current.visible = true;
    const frame = interpolateGhostFrame(overrideGhostFramesRef.current, elapsedTimeRef.current * 1000);
    if (frame) {
      overrideGhostMeshRef.current.position.set(frame.x, frame.y + 0.8, frame.z);
      overrideGhostMeshRef.current.rotation.set(frame.rx, frame.ry, 0);
    }
  };

  const handlePlayerDeath = () => {
    setAttempts(prev => prev + 1);
    synths.playDeath();

    // Reset player back to last active Checkpoint coordinates or start pad
    if (activeCheckpointRef.current) {
      playerPos.current.copy(activeCheckpointRef.current);
      playerVel.current.set(0, 0, 0);
      slidingRef.current = false;
      currentMaxSpeedRef.current = 12.0;
      climbingRef.current = false;
      wallRunDirectionRef.current = null;
      lastWallTouchRef.current = null;
    } else {
      if (raceMode) {
        // Since we are in a race, we do not want to reset the timer or race opponents.
        // We just reset the player back to the start block coordinates.
        const spawnBlock = level.blocks.find(b => b.type === 'start') || level.blocks[0];
        const spawnY = spawnBlock ? spawnBlock.y + spawnBlock.h + 1.2 : 4;
        const spawnX = spawnBlock ? spawnBlock.x : 0;
        const spawnZ = spawnBlock ? spawnBlock.z : 0;

        playerPos.current.set(spawnX, spawnY, spawnZ);
        playerVel.current.set(0, 0, 0);
        slidingRef.current = false;
        currentMaxSpeedRef.current = 12.0;
        climbingRef.current = false;
        wallRunDirectionRef.current = null;
        lastWallTouchRef.current = null;
      } else {
        // Since player has no active checkpoints, they respawn on the start block.
        // Reset the timer and run states as if they had clicked the reset button.
        initGame(true, true);
      }
    }
  };

  const handleLevelCompleted = () => {
    if (isCompletedRef.current) return;
    // Increment persistent total completions counter
    const prevCount = parseInt(localStorage.getItem('delta_rush_total_completions') ?? '0', 10);
    localStorage.setItem('delta_rush_total_completions', (prevCount + 1).toString());
    // Freeze to nearest millisecond so completion screen and leaderboard always show the same value
    const finalTime = Math.round(elapsedTimeRef.current * 1000) / 1000;
    elapsedTimeRef.current = finalTime;
    setIsCompleted(true);
    isCompletedRef.current = true;
    setCompletionTime(finalTime);
    synths.playFinish();

    if (raceMode) {
      // Record our finish time and broadcast to other real players immediately
      playerFinishTimeRef.current = finalTime;

      const finishedPayload = {
        type: 'GAME_FINISHED',
        roomId: raceRoomId,
        levelId: level.id,
        username: currentUser?.username || 'Guest',
        time: finalTime,
      };
      if (raceWs && raceWs.readyState === WebSocket.OPEN) {
        raceWs.send(JSON.stringify(finishedPayload));
      } else if (bcRef.current) {
        try { bcRef.current.postMessage(finishedPayload); } catch { /* channel closed during unmount */ }
      }

      // Check if all opponents are already done (e.g. we finished last)
      const allDone = opponentMeshesRef.current.every(o => o.finished);
      if (allDone) {
        // Build standings right away — no waiting needed
        const selfEntry = {
          username: currentUser?.username || 'You',
          time: finalTime,
          finished: true,
          isNpc: false,
          color: localStorage.getItem(`racer_color_${currentUser?.username}`) || '#3b82f6'
        };
        const finalRanks = [
          selfEntry,
          ...opponentMeshesRef.current.map(opp => ({
            username: opp.username,
            time: opp.finalTime,
            finished: opp.finished,
            isNpc: opp.isNpc,
            color: opp.color
          }))
        ];
        finalRanks.sort((a, b) => (a.time || 999) - (b.time || 999));
        setFinalStandings(finalRanks);
        if (onRaceFinished) onRaceFinished(finalTime, finalRanks);
      } else {
        // Show waiting screen; polling useEffect will fire commitRaceResultsRef when everyone's done
        setIsWaitingForOthers(true);
        isWaitingForOthersRef.current = true;
        // 60-second safety timeout — forces results even if a player disconnects
        waitForOpponentsTimeoutRef.current = setTimeout(() => {
          // Force-finish any stragglers with a distance-based estimate
          opponentMeshesRef.current.forEach(opp => {
            if (!opp.finished) {
              const remaining = Math.max(0, totalSplineLengthRef.current - opp.progressDistance);
              opp.finished = true;
              opp.finalTime = parseFloat((playerFinishTimeRef.current + remaining / Math.max(1, opp.baseSpeed)).toFixed(3));
            }
          });
          commitRaceResultsRef.current();
        }, 60000);
      }
    }

    // Lock screen pointerLock state
    document.exitPointerLock();

    // Determine performance results differential
    const scoreStr = localStorage.getItem(`best_time_${level.id}`);
    const previousBest = scoreStr ? parseFloat(scoreStr) : null;

    let pbDiff: number | null = null;
    let isNewPb = false;

    if (previousBest === null) {
      isNewPb = true;
      setTimeDiff(null);
    } else {
      pbDiff = finalTime - previousBest;
      setTimeDiff(pbDiff);
      if (pbDiff < 0) {
        isNewPb = true;
      }
    }

    setIsPb(isNewPb);

    // Save and commit high scores if faster
    if (previousBest === null || finalTime < previousBest) {
      localStorage.setItem(`best_time_${level.id}`, finalTime.toString());
      setPersonalBest(finalTime);

      // Commit the recorded ghost runframes list — downsample to ~10 fps for storage
      const pbFrames: GhostFrame[] = [];
      let lastKeptMs = -Infinity;
      for (const f of currentRunFramesRef.current) {
        if (f.time - lastKeptMs >= 100) {
          pbFrames.push(f);
          lastKeptMs = f.time;
        }
      }
      const replay: RunReplay = {
        levelId: level.id,
        playerEmail: currentUser?.username || 'user@aistudio.build',
        time: finalTime,
        frames: pbFrames,
        createdAt: Date.now()
      };
      localStorage.setItem(`ghost_replay_${level.id}`, JSON.stringify(replay));
    }

    // Commit run entry & calculate community standing
    if (!isLeaderboardLoggedRef.current) {
      isLeaderboardLoggedRef.current = true;
      try {
        const activeName = (currentUser?.username || 'Guest').toLowerCase().trim();

        // ── Demo mode: skip server submission; store run for post-login submit ──
        if (demoMode) {
          setCompletionPercentile(null);
          setCompletionWorldRank(null);
          if (level.id !== 'test_level_active' && onDemoRunComplete) {
            const resampledSpeeds = resampleSpeedsToUniformTime(
              currentRunFramesRef.current,
              currentRunSpeedsRef.current,
              finalTime
            );
            const pbFramesForDemo: GhostFrame[] = [];
            let lastKeptMsDemo = -Infinity;
            for (const f of currentRunFramesRef.current) {
              if (f.time - lastKeptMsDemo >= 100) {
                pbFramesForDemo.push(f);
                lastKeptMsDemo = f.time;
              }
            }
            onDemoRunComplete(level.id, {
              time: finalTime,
              date: Date.now(),
              device: isMobileRef.current ? 'mobile' : 'desktop',
              speeds: resampledSpeeds,
              frames: pbFramesForDemo,
              isNewPb: true,
            });
          }
          return;
        }

        if (isNewPb && level.id !== 'test_level_active') {
          // Show a placeholder immediately so the card stays visible while the
          // submitted leaderboard is fetched for the accurate standing.
          setCompletionPercentile(0);
          setCompletionWorldRank({ rank: 1, total: 1 });
        } else {
          setCompletionPercentile(null);
          setCompletionWorldRank(null);
        }

        if (level.id !== 'test_level_active') {
          // Raw speeds are sampled once per rendered frame, so spacing varies with
          // frame rate. Resample onto a fixed, evenly time-spaced grid using the
          // recorded frame timestamps so the stored speeds array has a true
          // uniform index-to-time mapping (required for accurate cross-run comparison).
          const resampledSpeeds = resampleSpeedsToUniformTime(
            currentRunFramesRef.current,
            currentRunSpeedsRef.current,
            finalTime
          );

          // Only include ghost frames for personal-best runs to save storage.
          // Downsample to ~10 fps (100 ms intervals) — same as the localStorage PB ghost.
          let downsampledFrames: GhostFrame[] | undefined;
          if (isNewPb) {
            const pbFramesForSubmit: GhostFrame[] = [];
            let lastKeptMs2 = -Infinity;
            for (const f of currentRunFramesRef.current) {
              if (f.time - lastKeptMs2 >= 100) {
                pbFramesForSubmit.push(f);
                lastKeptMs2 = f.time;
              }
            }
            downsampledFrames = pbFramesForSubmit;
          }

          const submitPayload = {
            time: finalTime,
            date: Date.now(),
            device: currentUser?.device ?? (isMobileRef.current ? 'mobile' : 'desktop'),
            speeds: resampledSpeeds,
            frames: downsampledFrames,
            isNewPb,
          };

          // Submit then fetch the real leaderboard for accurate standing
          import('../api').then(async ({ api, queuePendingSubmission }) => {
            try {
              await api.leaderboard.submit(level.id, submitPayload);
            } catch (e: any) {
              console.warn(`Leaderboard submit failed for level="${level.id}" time=${finalTime} user="${activeName}": ${e?.message || e}`);
              queuePendingSubmission(level.id, submitPayload);
            }

            // Fetch the real server leaderboard to compute accurate standing.
            // The course-complete standing is only shown for a new personal best.
            if (isNewPb && level.id !== 'test_level_active') {
              try {
                const serverEntries = await api.leaderboard.get(level.id);
                const currentBest = previousBest !== null && previousBest < finalTime
                  ? previousBest
                  : finalTime;
                const ranking = getPlayerRanking(serverEntries, activeName, currentBest);
                if (ranking) {
                  setCompletionPercentile(ranking.percentile);
                  setCompletionWorldRank({ rank: ranking.rank, total: ranking.total });
                }
              } catch {
                // Server fetch failed — fall back to localStorage estimate
                const stored = localStorage.getItem(`leaderboard_${level.id}`);
                const entries = stored ? JSON.parse(stored) : [];
                const currentBest = previousBest !== null && previousBest < finalTime
                  ? previousBest
                  : finalTime;
                const ranking = getPlayerRanking(entries, activeName, currentBest);
                if (ranking) {
                  setCompletionPercentile(ranking.percentile);
                  setCompletionWorldRank({ rank: ranking.rank, total: ranking.total });
                }
              }
            }
          });
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // Convert seconds floating representations to clock layout string
  const formatTime = (secs: number) => {
    if (secs < 0) secs = 0;
    const totalMilliseconds = Math.round(secs * 1000);
    const m = Math.floor(totalMilliseconds / 60000);
    const s = Math.floor((totalMilliseconds % 60000) / 1000);
    const ms = totalMilliseconds % 1000;
    return `${m > 0 ? `${m}:` : ''}${s.toString().padStart(m > 0 ? 2 : 1, '0')}.${ms.toString().padStart(3, '0')}s`;
  };

  // Calculate current completion percentage based on forward progress across Z coordinates boundary
  const calculateProgress = () => {
    const startPad = level.blocks.find(b => b.type === 'start') || level.blocks[0];
    const endPad = level.blocks.find(b => b.type === 'end') || level.blocks[level.blocks.length - 1];
    if (!startPad || !endPad) return 0;
    
    const startZ = startPad.z;
    const endZ = endPad.z;
    const currentZ = playerPos.current.z;

    const totalZ = Math.abs(endZ - startZ);
    const completedZ = Math.abs(currentZ - startZ);

    if (totalZ === 0) return 0;
    
    // Ensure clamped [0, 100]
    return Math.max(0, Math.min(100, Math.round((completedZ / totalZ) * 100)));
  };

  return (
    <div ref={canvasContainerRef} className="relative w-full h-full bg-neutral-950 overflow-hidden select-none">
      
      {/* 3D WebGL Canvas viewport */}
      <canvas 
        ref={canvasRef} 
        onClick={handleCanvasClick}
        className="w-full h-full block cursor-pointer" 
      />

      {/* Race Countdown Overlay */}
      {raceMode && raceCountdown !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50 select-none">
          <AnimatePresence mode="popLayout">
            <motion.div
              key={raceCountdown}
              initial={{ scale: 0.3, opacity: 0, y: 50 }}
              animate={{ scale: 1.1, opacity: 1, y: 0 }}
              exit={{ scale: 1.5, opacity: 0, y: -50 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="flex flex-col items-center justify-center text-center"
            >
              {raceCountdown > 0 ? (
                <>
                  <span className="text-[12rem] sm:text-[16rem] font-sans font-black text-amber-500 drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] tracking-tight leading-none">
                    {raceCountdown}
                  </span>
                  <span className="text-xl sm:text-2xl font-mono font-bold tracking-widest text-neutral-300 uppercase drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] -mt-2">
                    READY
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[10rem] sm:text-[14rem] font-sans font-black text-emerald-400 drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)] tracking-wider leading-none uppercase animate-pulse">
                    GO!
                  </span>
                  <span className="text-xl sm:text-2xl font-mono font-bold tracking-widest text-emerald-300 uppercase drop-shadow-[0_4px_4px_rgba(0,0,0,0.8)] -mt-2">
                    START RACING
                  </span>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Minimal Play HUD Overlay */}
      {!isCompleted && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
          
          {/* Ghost Override Indicator — shown when racing a specific leaderboard ghost */}
          {ghostOverrideLabel && overrideGhostActiveRef.current && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
              <div className="bg-amber-500/15 border border-amber-500/40 backdrop-blur-sm px-3 py-1.5 rounded-full flex items-center gap-2 shadow-lg">
                <span className="text-amber-400 text-sm">👻</span>
                <span className="text-[11px] font-mono font-bold text-amber-300 tracking-wide">
                  Racing {ghostOverrideLabel}'s ghost
                </span>
              </div>
            </div>
          )}

          {/* Live Racing Standings list */}
          {raceMode && liveRankings.length > 0 && (
            <div className="absolute top-36 left-6 bg-neutral-900/95 border border-neutral-800 p-4 rounded-2xl shadow-lg backdrop-blur w-56 flex flex-col gap-2 z-20 pointer-events-auto">
              <div className="text-[9px] font-mono font-bold tracking-widest text-amber-500 uppercase">
                Live Standings
              </div>
              <div className="space-y-1.5">
                {liveRankings.slice(0, 6).map((rank, idx) => {
                  const isSelf = rank.username.toLowerCase() === (currentUser?.username || '').toLowerCase() || rank.username === 'You';
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-1.5 rounded-lg text-[11px] font-mono ${
                        isSelf ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-neutral-950/40'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate max-w-[125px]">
                        <span className="text-[9px] text-neutral-500 font-bold w-3">#{idx + 1}</span>
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: rank.color }} />
                        <span className={`truncate font-sans ${isSelf ? 'font-bold text-indigo-400' : 'text-neutral-300'}`}>
                          {rank.username}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-neutral-400">
                        {rank.finished && rank.finalTime ? `${rank.finalTime.toFixed(3)}s` : `${Math.round(rank.progressDistance)}m`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Panel stats */}
          <div className="flex justify-between items-start w-full">
            
            {/* Left Box Container */}
            <div className="flex flex-col gap-2">
              {/* Left Box: Precision Time */}
              <div className="bg-neutral-900/95 border border-neutral-800 p-4 rounded-2xl shadow-lg backdrop-blur flex items-baseline gap-2.5">
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-widest">Time</span>
                  <span className="text-2xl font-bold font-mono tracking-tight text-neutral-50">
                    {formatTime(elapsedTime)}
                  </span>
                </div>
                <div className="flex flex-col border-l border-neutral-800 pl-2.5 ml-1">
                  <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest font-bold">Personal Best</span>
                  <span className="text-xs font-bold font-mono text-amber-500 block min-w-[50px]">
                    {personalBest ? formatTime(personalBest) : '--:--.--'}
                  </span>
                </div>
              </div>

              {/* Smaller Inst. Velocity box below time ONLY in mobile view */}
              {isMobileRef.current && (
                <div className="bg-neutral-900/95 border border-neutral-800 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 shadow-lg backdrop-blur self-start animate-in fade-in slide-in-from-top-2 duration-200">
                  <Flame className="w-3.5 h-3.5 text-orange-500 animate-bounce" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-mono text-neutral-400 uppercase tracking-wider">Vel:</span>
                    <span className="text-xs font-bold font-mono text-neutral-200">{speed} <span className="text-[9px] text-neutral-500">m/s</span></span>
                  </div>
                </div>
              )}
            </div>

            {/* Right Box: Course Title & Actions */}
            <div className="flex flex-col items-end gap-2">
              <div className="bg-neutral-900/95 border border-neutral-800 px-4 py-2 rounded-xl shadow-lg backdrop-blur flex items-center gap-3">
                <div className="text-right">
                  <h3 className="text-xs font-bold text-neutral-50">{level.name}</h3>
                  <div className="flex gap-2 justify-end items-center mt-0.5">
                    <span className="text-[9px] font-mono text-neutral-500 block uppercase">Gate {calculateProgress()}%</span>
                    <span className="text-[9px] font-mono text-neutral-400 block px-1.5 py-0.5 bg-neutral-950/80 border border-neutral-800/50 rounded uppercase">ATTEMPTS: {attempts}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {!raceMode && !demoMode && (
                  <button
                    onClick={() => onChangeSettings?.({ ...settings, showGhost: !settings.showGhost })}
                    title={settings.showGhost ? 'Ghost: On — click to turn off' : 'Ghost: Off — click to turn on'}
                    className="pointer-events-auto flex items-center gap-2 bg-neutral-900/90 border border-neutral-800 px-2.5 py-1.5 rounded-lg cursor-pointer transition hover:border-neutral-700"
                  >
                    <span className="text-[11px]">👻</span>
                    <div
                      className={`relative inline-flex h-4 w-7 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                        settings.showGhost ? 'bg-indigo-600' : 'bg-neutral-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          settings.showGhost ? 'translate-x-3' : 'translate-x-0'
                        }`}
                      />
                    </div>
                  </button>
                )}
                {!raceMode && demoMode && (
                  <button
                    title="Sign up to unlock ghost replay"
                    onClick={() => onDemoLoginRequest?.()}
                    className="pointer-events-auto flex items-center gap-1.5 bg-neutral-900/90 border border-neutral-700/60 px-2.5 py-1.5 rounded-lg cursor-pointer transition hover:border-indigo-500/60 hover:bg-neutral-900 text-neutral-400 hover:text-indigo-300"
                  >
                    <span className="text-[11px]">👻</span>
                    <span className="text-[10px] font-mono">🔒 Sign Up</span>
                  </button>
                )}
                <button
                  onClick={handleExitAttempt}
                  className="pointer-events-auto bg-neutral-900/90 border border-neutral-800 px-3 py-1.5 rounded-lg text-[10px] text-neutral-400 hover:text-neutral-200 cursor-pointer transition font-mono uppercase"
                >
                  Exit
                </button>
              </div>
            </div>

          </div>

          {/* Active speed / feedback and mobile touch control boards */}
          <div className="flex flex-col gap-4">
            
            {/* Floating Momentum state bar */}
            <div className="flex justify-between items-end w-full">
              <div className="flex flex-col gap-1.5">
                {/* Visual modifier badges */}
                <div className="flex gap-1.5">
                  {activeModifiers.map(mod => (
                    <span 
                      key={mod} 
                      className={`text-[9px] font-mono font-bold px-2 py-0.5 bg-indigo-500 text-white rounded uppercase animate-pulse shadow-md`}
                    >
                      {mod}
                    </span>
                  ))}
                </div>
                {!isMobileRef.current && (
                  <div className="bg-neutral-900/95 border border-neutral-800 px-3.5 py-2.5 rounded-xl flex items-baseline gap-2 shadow-lg backdrop-blur">
                    <Flame className="w-4 h-4 text-orange-500 self-center animate-bounce" />
                    <div>
                      <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest block">Inst. Velocity</span>
                      <span className="text-sm font-bold font-mono text-neutral-200">{speed} <span className="text-[10px] text-neutral-500">m/s</span></span>
                    </div>
                  </div>
                )}
              </div>

              {/* Instant screen restart button */}
              {!raceMode && (
                <button
                  onClick={() => {
                    initGame(true);
                    canvasRef.current?.focus();
                  }}
                  className="pointer-events-auto flex items-center justify-center p-3 sm:p-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-950 hover:scale-105 active:scale-95 rounded-2xl shadow-xl transition cursor-pointer"
                  title="Restart Course (Key: R)"
                >
                  <RotateCcw className="w-5 h-5 font-bold" />
                </button>
              )}
            </div>

            {/* Touch overlay inputs (Visualizes joystick on Left half, Jump on Right) */}
            {isMobileRef.current && (settings.showJoystick !== false || settings.showJumpButton !== false) && (
              <div 
                className="pointer-events-auto w-full grid grid-cols-2 h-44 gap-4"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
              >
                
                {/* Left zone: custom virtual joystick rendering */}
                <div className="relative flex items-center justify-center translate-y-6">
                  {settings.showJoystick !== false && (
                    <div className={`w-28 h-28 rounded-full border border-neutral-800 bg-neutral-950/20 backdrop-blur-sm flex items-center justify-center transition-opacity duration-200 ${touchJoystickActive ? 'opacity-100' : 'opacity-40'}`}>
                      {/* Joystick knob handle */}
                      <div 
                        className="absolute w-12 h-12 rounded-full bg-neutral-50 border border-neutral-300 shadow-xl"
                        style={{
                          transform: `translate(${touchJoystickOffset.x}px, ${touchJoystickOffset.y}px)`
                        }}
                      />
                    </div>
                  )}
                </div>

                {/* Right zone: Action execution buttons */}
                <div className="flex items-center justify-end pr-8">
                  {/* JUMP button */}
                  {settings.showJumpButton !== false && (
                    <button
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        keysRef.current[' '] = true;
                      }}
                      onTouchEnd={(e) => {
                        e.stopPropagation();
                        keysRef.current[' '] = false;
                      }}
                      onTouchCancel={(e) => {
                        e.stopPropagation();
                        keysRef.current[' '] = false;
                      }}
                      className="w-20 h-20 rounded-full bg-indigo-600 border border-indigo-500 flex flex-col items-center justify-center text-white active:bg-indigo-700 active:scale-95 shadow-xl transition"
                    >
                      <span className="text-xs font-bold font-mono">JUMP</span>
                    </button>
                  )}
                </div>

              </div>
            )}

          </div>

        </div>
      )}

      {/* Waiting-for-opponents overlay (shown when local player finishes before everyone else) */}
      {isWaitingForOthers && (
        <div className="absolute inset-0 bg-neutral-950/80 backdrop-blur-md flex items-center justify-center p-4 z-40">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl flex flex-col items-center gap-5">
            <div className="p-4 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
              <Clock className="w-10 h-10 animate-pulse" />
            </div>
            <div>
              <h2 className="text-xl font-black text-neutral-50 tracking-tight">You Finished!</h2>
              <p className="text-xs text-neutral-400 font-mono mt-1">Waiting for others to cross the line…</p>
            </div>

            {/* Live finisher list — sorted by finish time (finished racers first,
                fastest to slowest), then by in-progress racers ranked by how far
                along the course they are. */}
            <div className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl divide-y divide-neutral-900 overflow-hidden">
              {[
                {
                  username: currentUser?.username || 'You',
                  color: localStorage.getItem(`racer_color_${currentUser?.username}`) || '#3b82f6',
                  finished: true,
                  finalTime: playerFinishTimeRef.current,
                  progressDistance: totalSplineLengthRef.current,
                  isSelf: true,
                },
                ...opponentMeshesRef.current.map(opp => ({
                  username: opp.username,
                  color: opp.color,
                  finished: opp.finished,
                  finalTime: opp.finalTime,
                  progressDistance: opp.progressDistance,
                  isSelf: false,
                })),
              ]
                .sort((a, b) => {
                  if (a.finished && b.finished) return (a.finalTime || 0) - (b.finalTime || 0);
                  if (a.finished !== b.finished) return a.finished ? -1 : 1;
                  return b.progressDistance - a.progressDistance;
                })
                .map((racer, idx) => (
                  <div key={racer.username + idx} className="flex items-center justify-between p-3 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      {racer.finished ? (
                        <span className="w-5 h-5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center font-bold text-[9px]">✓</span>
                      ) : (
                        <span className="w-5 h-5 rounded bg-neutral-800 text-neutral-500 border border-neutral-700 flex items-center justify-center font-bold text-[9px] animate-pulse">…</span>
                      )}
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: racer.color }} />
                      <span className={racer.isSelf ? 'text-indigo-400 font-bold' : racer.finished ? 'text-neutral-300' : 'text-neutral-500'}>{racer.username}</span>
                    </div>
                    {racer.finished && racer.finalTime != null ? (
                      <span className={racer.isSelf ? 'text-emerald-400 font-bold' : 'text-neutral-400 font-bold'}>{racer.finalTime.toFixed(3)}s</span>
                    ) : (
                      <span className="text-neutral-600 text-[10px]">racing…</span>
                    )}
                  </div>
                ))}
            </div>

            <button
              onClick={() => {
                if (waitForOpponentsTimeoutRef.current) {
                  clearTimeout(waitForOpponentsTimeoutRef.current);
                  waitForOpponentsTimeoutRef.current = null;
                }
                setIsWaitingForOthers(false);
                isWaitingForOthersRef.current = false;
                handleExitAttempt();
              }}
              className="flex items-center gap-2 text-xs font-semibold text-neutral-500 hover:text-red-400 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              Leave Race
            </button>
          </div>
        </div>
      )}

      {/* Completion Dialog Overlay */}
      {isCompleted && !isWaitingForOthers && (
        <div className="absolute inset-0 bg-neutral-950/85 backdrop-blur-md flex items-center justify-center p-4 z-40">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl flex flex-col items-center">
            
            <div className="relative mb-4">
              <div className="p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20">
                <CheckCircle className="w-10 h-10" />
              </div>
              {isPb && (
                <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-1 border border-neutral-900 text-[9px] font-mono font-bold animate-bounce">
                  RECORD
                </div>
              )}
            </div>

            <h2 className="text-xl font-black text-neutral-50 tracking-tight">Course Complete!</h2>
            <p className="text-xs text-neutral-400 font-mono mt-1">{level.name}</p>

            {raceMode && finalStandings.length > 0 ? (
              <div className="w-full mt-6 space-y-3">
                <div className="text-[10px] font-mono text-amber-500 uppercase tracking-widest font-bold text-center">Race Standings</div>
                <div className="bg-neutral-950 border border-neutral-800 rounded-2xl divide-y divide-neutral-900 overflow-hidden w-full">
                  {finalStandings.map((std, idx) => {
                    const isSelf = std.username.toLowerCase() === (currentUser?.username || '').toLowerCase() || std.username === 'You';
                    const eloChange = idx === 0 ? 10 : idx === 1 ? 5 : idx === 2 ? 2 : idx === 3 ? -2 : idx === 4 ? -5 : -10;
                    const eloEntry = !std.isNpc ? raceEloData?.[std.username] : undefined;
                    return (
                      <div key={idx} className="flex items-center justify-between p-3 text-xs font-mono">
                        <div className="flex items-center gap-2">
                          <span 
                            className={`w-5 h-5 rounded flex items-center justify-center font-bold text-[9px] ${
                              idx === 0 
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                                : idx === 1 
                                ? 'bg-neutral-200/10 text-neutral-300 border border-neutral-300/15' 
                                : idx === 2 
                                ? 'bg-amber-700/10 text-amber-600 border border-amber-700/15'
                                : 'bg-neutral-900 text-neutral-500'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div className="flex items-center gap-1.5 font-sans font-semibold">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: std.color }} />
                            <span className={`max-w-[125px] truncate ${isSelf ? 'text-indigo-400 font-bold' : 'text-neutral-300'}`}>
                              {std.username}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-neutral-400 font-bold">
                            {std.finished && std.time != null ? `${std.time.toFixed(3)}s` : 'DNF'}
                          </span>
                          <span className={`text-[10px] font-bold ${eloChange > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {eloChange > 0 ? '+' : ''}{eloChange} ELO
                            {eloEntry && eloEntry.newRating > 0 && (
                              <span className="text-neutral-500 font-normal ml-1">
                                → {eloEntry.newRating}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                {/* Score box */}
                <div className="w-full mt-6 bg-neutral-950 border border-neutral-800 p-5 rounded-2xl flex flex-col items-center gap-1">
                  <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Time Registered</span>
                  <span className="text-3xl font-black font-mono text-emerald-400 tracking-tight">
                    {formatTime(completionTime)}
                  </span>

                  {/* PB Comparisons */}
                  <div className="text-xs font-mono mt-2.5">
                    {isPb ? (
                      <span className="text-emerald-500 font-bold bg-emerald-500/10 px-2.5 py-1 rounded-md">
                        {timeDiff !== null ? `New Personal Best! (${formatTime(Math.abs(timeDiff))} faster!)` : 'Personal Best!'}
                      </span>
                    ) : (
                      <span className="text-neutral-500 font-medium">
                        PB: {formatTime(personalBest || 0)} ({formatTime(timeDiff || 0)} off)
                      </span>
                    )}
                  </div>
                </div>

                {/* Percentile Box — demo shows blurred placeholders; real mode shows live data */}
                {demoMode ? (
                  <div className="w-full mt-3 bg-indigo-500/15 border border-indigo-500/30 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-inner relative overflow-hidden">
                    <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider font-bold">Community Standing</span>
                    <div className="flex items-center justify-around w-full gap-4 mt-1">
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-black font-mono text-indigo-300 select-none" style={{ filter: 'blur(7px)' }}>Top 4%</span>
                        <span className="text-[9px] text-neutral-400 uppercase font-mono font-bold tracking-wider">Percentile</span>
                      </div>
                      <div className="w-px h-8 bg-indigo-500/30 shrink-0" />
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-black font-mono text-emerald-400 select-none" style={{ filter: 'blur(7px)' }}>#142</span>
                        <span className="text-[9px] text-neutral-400 uppercase font-mono font-bold tracking-wider">World Rank</span>
                      </div>
                    </div>
                    <button
                      onClick={() => onDemoLoginRequest?.()}
                      className="mt-1 flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition cursor-pointer"
                    >
                      🔒 Sign Up to Reveal Your Ranking
                    </button>
                  </div>
                ) : isPb && completionPercentile !== null && completionWorldRank !== null && level.id !== 'test_level_active' && (
                  <div id="completion-percentile-card" className="w-full mt-3 bg-indigo-500/15 border border-indigo-500/30 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-inner">
                    <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider font-bold">Community Standing</span>
                    
                    <div className="flex items-center justify-around w-full gap-4 mt-1">
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-black font-mono text-indigo-300">
                          Top {formatPercentile(completionPercentile!)}%
                        </span>
                        <span className="text-[9px] text-neutral-400 uppercase font-mono font-bold tracking-wider">Percentile</span>
                      </div>
                      
                      <div className="w-px h-8 bg-indigo-500/30 shrink-0" />
                      
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-black font-mono text-emerald-400">
                          #{completionWorldRank.rank}
                        </span>
                        <span className="text-[9px] text-neutral-400 uppercase font-mono font-bold tracking-wider">
                          Rank of {completionWorldRank.total}
                        </span>
                      </div>
                    </div>

                    <p className="text-[10px] text-neutral-400 font-medium mt-1">
                      Congratulations on your new personal best!
                    </p>
                  </div>
                )}
              </>
            )}

            {!raceMode && (
              <div className={`${level.id === 'test_level_active' ? 'flex' : 'grid grid-cols-2'} gap-2.5 w-full mt-8`}>
                <button
                  onClick={initGame}
                  className={`py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-bold rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer ${level.id === 'test_level_active' ? 'w-full' : ''}`}
                >
                  <RotateCcw className="w-4 h-4" />
                  Retry Run
                </button>
                {level.id !== 'test_level_active' && (
                  demoMode ? (
                    <button
                      onClick={() => onDemoLoginRequest?.()}
                      className="py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-neutral-700"
                    >
                      🔒 Leaderboard
                    </button>
                  ) : (
                    <button
                      onClick={onShowLeaderboard}
                      className="py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-neutral-700"
                    >
                      <Award className="w-4 h-4" />
                      Leaderboard
                    </button>
                  )
                )}
              </div>
            )}

            {/* Demo mode — sign-up CTA to save run */}
            {demoMode && (
              <button
                onClick={() => onDemoLoginRequest?.()}
                className="mt-2 w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                🔓 Sign Up Free — Save This Run &amp; See Rankings
              </button>
            )}

            <button
              onClick={handleExitAttempt}
              className="mt-4 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition hover:underline"
            >
              Exit to Menu
            </button>

          </div>
        </div>
      )}

      {showExitConfirmation && (
        <div id="exit-confirmation-overlay" className="absolute inset-0 bg-neutral-950/90 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-red-500/30 p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4 border border-red-500/30 text-red-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            
            <h3 className="text-base font-bold text-neutral-50 font-sans tracking-tight">Abandon Race?</h3>
            <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
              Exiting the race now will count as a <span className="text-red-400 font-semibold">Did Not Finish (DNF)</span>. You will finish in <span className="font-semibold text-neutral-100">6th place</span> and lose ELO rating (<span className="text-red-400 font-semibold">-10</span>).
            </p>

            <div className="flex flex-col gap-2 mt-6">
              <button
                onClick={handleConfirmEarlyExit}
                className="py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition shadow cursor-pointer uppercase tracking-wider"
              >
                Abandon &amp; Lose ELO
              </button>
              <button
                onClick={() => {
                  setShowExitConfirmation(false);
                  canvasRef.current?.requestPointerLock();
                }}
                className="py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Cancel &amp; Continue Race
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
