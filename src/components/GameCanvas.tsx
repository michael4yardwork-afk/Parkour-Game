import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RotateCcw, Award, CheckCircle, Flame, Compass, FileText } from 'lucide-react';
import { LevelConfig, GhostFrame, RunReplay, GameSettings, UserAccount, RaceParticipant } from '../types';
import { synths } from '../audio';

interface GameCanvasProps {
  level: LevelConfig;
  settings: GameSettings;
  onExit: () => void;
  onShowLeaderboard: () => void;
  currentUser?: UserAccount | null;
  raceMode?: boolean;
  raceOpponents?: RaceParticipant[];
  onRaceFinished?: (
    finalTime: number,
    rankings: { username: string; time?: number; finished: boolean; isNpc: boolean; color: string }[]
  ) => void;
}

export default function GameCanvas({ 
  level, 
  settings, 
  onExit, 
  onShowLeaderboard, 
  currentUser,
  raceMode = false,
  raceOpponents = [],
  onRaceFinished
}: GameCanvasProps) {
  // Game states
  const [, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0.00);
  const [personalBest, setPersonalBest] = useState<number | null>(null);
  const [speed, setSpeed] = useState(0);
  const [deaths, setDeaths] = useState(0);
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
  const sprintingRef = useRef<boolean>(false);
  const currentMaxSpeedRef = useRef<number>(12.0);
  const movementStartedRef = useRef<boolean>(false);

  // Pointer Lock details
  const [isLocked, setIsLocked] = useState(false);

  // Race Countdown details
  const [raceCountdown, setRaceCountdown] = useState<number | null>(null);
  const hasCountdownStartedRef = useRef<boolean>(false);

  // Ghost information
  const currentRunFramesRef = useRef<GhostFrame[]>([]);
  const ghostFramesRef = useRef<GhostFrame[]>([]);
  const ghostMeshRef = useRef<THREE.Mesh | null>(null);
  const ghostActiveRef = useRef<boolean>(false);

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
  }[]>([]);

  const splinePointsRef = useRef<THREE.Vector3[]>([]);
  const cumulativeSplineDistancesRef = useRef<number[]>([]);
  const totalSplineLengthRef = useRef<number>(0);
  const bcRef = useRef<BroadcastChannel | null>(null);

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

    // Attempt to load Ghost
    const ghostData = localStorage.getItem(`ghost_replay_${level.id}`);
    if (ghostData && settings.showGhost) {
      try {
        const parsed: RunReplay = JSON.parse(ghostData);
        ghostFramesRef.current = parsed.frames;
        ghostActiveRef.current = true;
      } catch (e) {
        console.error('Failed to parse ghost records', e);
      }
    }

    // Detect mobile device
    const checkMobile = () => {
      const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      isMobileRef.current = isTouch;
    };
    checkMobile();

  }, [level.id, settings.showGhost]);

  // Restart / Setup Game Loop
  const initGame = (isManualRestart = false) => {
    isLeaderboardLoggedRef.current = false;
    // Locate the spawn coordinate block
    const spawnBlock = level.blocks.find(b => b.type === 'start') || level.blocks[0];
    const spawnY = spawnBlock ? spawnBlock.y + spawnBlock.h + 1.2 : 4;
    const spawnX = spawnBlock ? spawnBlock.x : 0;
    const spawnZ = spawnBlock ? spawnBlock.z : 0;

    // Build sequential spline route for racing bots
    if (level.blocks && level.blocks.length > 0) {
      const blocksCopy = [...level.blocks];
      const seqBlocks: any[] = [];
      let currentBlock = level.blocks.find(b => b.type === 'start') || level.blocks[0];
      let pool = blocksCopy.filter(b => b.id !== currentBlock.id);
      seqBlocks.push(currentBlock);

      while (pool.length > 0) {
        let closestIdx = 0;
        let minDistance = Infinity;
        for (let i = 0; i < pool.length; i++) {
          const dx = pool[i].x - currentBlock.x;
          const dy = pool[i].y - currentBlock.y;
          const dz = pool[i].z - currentBlock.z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
          if (dist < minDistance) {
            minDistance = dist;
            closestIdx = i;
          }
        }
        currentBlock = pool[closestIdx];
        pool.splice(closestIdx, 1);
        seqBlocks.push(currentBlock);
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
      });
    }

    playerPos.current.set(spawnX, spawnY, spawnZ);
    playerVel.current.set(0, 0, 0);
    playerYaw.current = Math.PI; // point forward (down negative Z)
    playerPitch.current = 0;
    groundedRef.current = false;
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
    elapsedTimeRef.current = 0.00;
    sprintingRef.current = false;
    currentMaxSpeedRef.current = 12.0;
    movementStartedRef.current = false;
    setElapsedTime(0.00);
    setIsCompleted(false);
    isCompletedRef.current = false;
    setTimeDiff(null);
    setIsPb(false);
    setCompletionPercentile(null);
    setCompletionWorldRank(null);
    isPlayingRef.current = true;
    countdownRef.current = null;
    checkpointSoundCoolRef.current = {};
    jumpCoolRef.current = {};
    speedCoolRef.current = {};

    synths.playTick();
    updateGhostReplay();
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

  const getPlayerSplineProgress = () => {
    const pts = splinePointsRef.current;
    const dists = cumulativeSplineDistancesRef.current;
    if (pts.length === 0) return 0;

    let closestIdx = 0;
    let minSqDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const sqDist = pts[i].distanceToSquared(playerPos.current);
      if (sqDist < minSqDist) {
        minSqDist = sqDist;
        closestIdx = i;
      }
    }

    return dists[closestIdx] || 0;
  };

  // Timer for countdown
  useEffect(() => {
    if (!raceMode) {
      setRaceCountdown(null);
      countdownRef.current = null;
      return;
    }

    const isMobileDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const shouldStart = isMobileDevice || isLocked;
    if (shouldStart && !hasCountdownStartedRef.current) {
      hasCountdownStartedRef.current = true;
      setRaceCountdown(3);
      countdownRef.current = 3;
      synths.playCountdownTick();
    }
  }, [raceMode, isLocked, level.id]);

  useEffect(() => {
    if (raceCountdown === null) return;

    if (raceCountdown > 0) {
      const timer = setTimeout(() => {
        const next = raceCountdown - 1;
        setRaceCountdown(next);
        if (next === 0) {
          countdownRef.current = null;
          synths.playCountdownGo();
        } else {
          countdownRef.current = next;
          synths.playCountdownTick();
        }
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown is 0 (GO!)
      const timer = setTimeout(() => {
        setRaceCountdown(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [raceCountdown]);

  useEffect(() => {
    if (!raceMode) return;

    bcRef.current = new BroadcastChannel('momentum_races_channel');

    bcRef.current.onmessage = (event) => {
      const { type, levelId, username, x, y, z, rx, ry, state, time } = event.data;

      if (levelId !== level.id) return;

      if (type === 'GAME_TICK') {
        const opp = opponentMeshesRef.current.find(o => o.username.toLowerCase().trim() === username.toLowerCase().trim());
        if (opp && !opp.isNpc) {
          opp.targetPosition.set(x, y, z);
          opp.targetYaw = ry;
          opp.lastUpdateMs = Date.now();
          opp.progressDistance = Math.max(0, -z);
        }
      } else if (type === 'GAME_FINISHED') {
        const opp = opponentMeshesRef.current.find(o => o.username.toLowerCase().trim() === username.toLowerCase().trim());
        if (opp && !opp.isNpc && !opp.finished) {
          opp.finished = true;
          opp.finalTime = time;
        }
      }
    };

    return () => {
      bcRef.current?.close();
    };
  }, [raceMode, level.id]);

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

    // Spawn Ghost Mesh if personal best ghost exists
    if (ghostActiveRef.current && ghostFramesRef.current.length > 0) {
      const ghostGeom = new THREE.CapsuleGeometry(0.5, 1.0, 4, 8);
      const ghostMat = new THREE.MeshBasicMaterial({
        color: 0x60a5fa,
        transparent: true,
        opacity: 0.45,
        wireframe: true
      });
      const gMesh = new THREE.Mesh(ghostGeom, ghostMat);
      scene.add(gMesh);
      ghostMeshRef.current = gMesh;
    }

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
          baseSpeed: opponent.baseSpeed || 10
        });
      });
    }
    opponentMeshesRef.current = opponentMeshes;

    // Save Three.js references
    sceneRef.current = scene;
    rendererRef.current = renderer;
    cameraRef.current = camera;
    
    const clock = new THREE.Clock();
    clockRef.current = clock;

    // Direct game startup mechanics
    initGame();
    setIsPlaying(true);
    isPlayingRef.current = true;
    isCompletedRef.current = false;
    countdownRef.current = null;

    // Main running execution thread loop
    let activeLoop = true;
    const gameLoop = () => {
      if (!activeLoop) return;
      requestAnimationFrame(gameLoop);

      if (isPlayingRef.current && !isCompletedRef.current && countdownRef.current === null) {
        const dt = Math.min(clock.getDelta(), 0.1); // clamp delta ticks
        
        // Force countdown start immediately when race mode is active so NPCs of the race move correctly
        if (raceMode && !movementStartedRef.current) {
          movementStartedRef.current = true;
        }

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
            state: wallRunDirectionRef.current === 'left' ? 'wall_left' 
                   : wallRunDirectionRef.current === 'right' ? 'wall_right'
                   : sprintingRef.current ? 'sprint' 
                   : climbingRef.current ? 'climb' 
                   : groundedRef.current ? 'run' : 'jump'
          });

          elapsedTimeRef.current += dt;
          updateGhostReplay();
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
          setElapsedTime(0.00);
          updateGhostReplay();
        }

        // Multiplayer / Racing updates
        opponentMeshesRef.current.forEach((opp) => {
          if (opp.finished) return;

          if (opp.isNpc) {
            // Move bot along course spline representation sequentially
            opp.progressDistance += dt * opp.baseSpeed;

            const targetPos = getPointAtLength(opp.progressDistance);

            // Interpolate bot positioning
            opp.mesh.position.lerp(targetPos, 0.12);

            // Compute direction to look
            const nextTarget = getPointAtLength(opp.progressDistance + 1.5);
            const walkDir = new THREE.Vector3().subVectors(nextTarget, opp.mesh.position).setY(0);
            if (walkDir.lengthSq() > 0.01) {
              const dirYaw = Math.atan2(walkDir.x, walkDir.z);
              opp.mesh.rotation.y = dirYaw;
            }

            // Bots hit finish threshold
            if (opp.progressDistance >= totalSplineLengthRef.current) {
              opp.finished = true;
              opp.finalTime = parseFloat(elapsedTimeRef.current.toFixed(2));
            }
          } else {
            // Linearly interpolate received websocket positions
            opp.mesh.position.lerp(opp.targetPosition, 0.15);
            opp.mesh.rotation.y = THREE.MathUtils.lerp(opp.mesh.rotation.y, opp.targetYaw, 0.15);
          }
        });

        // Broadcast current user tick to general channel
        if (raceMode && bcRef.current) {
          bcRef.current.postMessage({
            type: 'GAME_TICK',
            levelId: level.id,
            username: currentUser?.username || 'Guest',
            x: playerPos.current.x,
            y: playerPos.current.y,
            z: playerPos.current.z,
            ry: playerYaw.current,
            time: elapsedTimeRef.current
          });
        }

        // Live HUD position standings update
        if (raceMode) {
          liveUpdateFrameCountRef.current++;
          if (liveUpdateFrameCountRef.current % 12 === 0) {
            const ourProgress = getPlayerSplineProgress();
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
    };

  }, [level.id, level.theme, level.blocks.length, settings.showGhost]);

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
        // If joystick not active, start tracking
        if (joystickTouchIdRef.current === null) {
          joystickTouchIdRef.current = touch.identifier;
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
          touchMoveRef.current = { x: touch.clientX, y: touch.clientY };
          
          setTouchJoystickActive(true);
          touchJoystickActiveRef.current = true;
          setTouchJoystickOffset({ x: 0, y: 0 });
          touchJoystickOffsetRef.current = { x: 0, y: 0 };
        }
      } else {
        // Look control in the right half
        if (lookTouchIdRef.current === null) {
          lookTouchIdRef.current = touch.identifier;
          touchLookStartRef.current = { x: touch.clientX, y: touch.clientY };
        }
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
        if (touchLookStartRef.current) {
          const dx = touch.clientX - touchLookStartRef.current.x;
          const dy = touch.clientY - touchLookStartRef.current.y;
          
          // Transform screen delta look rotation
          const sensitivity = 0.007;
          playerYaw.current -= dx * sensitivity;
          playerPitch.current = Math.max(-1.45, Math.min(1.45, playerPitch.current - dy * sensitivity));

          touchLookStartRef.current = { x: touch.clientX, y: touch.clientY };
        }
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
      keysRef.current[k] = true;

      // Fast immediate R button to retry
      if (k === 'r') {
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
  }, [level.id]);

  // Pointer lock callback trigger for desktops
  const handleCanvasClick = () => {
    if (!isMobileRef.current && canvasRef.current) {
      canvasRef.current.requestPointerLock();
    }
  };

  useEffect(() => {
    const handleLockChange = () => {
      setIsLocked(document.pointerLockElement === canvasRef.current);
    };
    document.addEventListener('pointerlockchange', handleLockChange);
    return () => {
      document.removeEventListener('pointerlockchange', handleLockChange);
    };
  }, []);

  // Handle Mouse movement looking rotations
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isLocked) return;

      const sensitivity = settings.mouseSensitivity * 0.0015;
      playerYaw.current -= e.movementX * sensitivity;

      // Apply pitch clamping look
      const pitchTarget = playerPitch.current - e.movementY * sensitivity * (settings.invertY ? -1 : 1);
      playerPitch.current = Math.max(-1.48, Math.min(1.48, pitchTarget));
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isLocked, settings.mouseSensitivity, settings.invertY]);

  // Main custom bounding-box collision checker and physics step solver
  const updatePhysics = (dt: number) => {
    // Apply gravity
    let gravity = 23.5; // athletic arcade gravity feel

    if (climbingRef.current) {
      gravity = 0; // suspend falling
    } else if (wallRunDirectionRef.current) {
      gravity = 6.0; // low slow gravity sliding along wall
    }

    // Apply gravity velocity
    playerVel.current.y -= gravity * dt;

    const keysPressed = keysRef.current['w'] || keysRef.current['arrowup'] || keysRef.current['up'] ||
                        keysRef.current['s'] || keysRef.current['arrowdown'] || keysRef.current['down'] ||
                        keysRef.current['a'] || keysRef.current['d'] ||
                        keysRef.current['arrowleft'] || keysRef.current['left'] ||
                        keysRef.current['arrowright'] || keysRef.current['right'] ||
                        (isMobileRef.current && touchJoystickActiveRef.current && (Math.abs(touchJoystickOffsetRef.current.x) > 5 || Math.abs(touchJoystickOffsetRef.current.y) > 5));

    // Air drag dampeners - lower when actively accelerating so we can reach max speed limits (normal / sprint)
    const activeDrag = sprintingRef.current ? 2.5 : 4.02;
    const dragX = groundedRef.current ? (keysPressed ? activeDrag : 8.5) : 1.5;
    const dragZ = groundedRef.current ? (keysPressed ? activeDrag : 8.5) : 1.5;
    playerVel.current.x -= playerVel.current.x * dragX * dt;
    playerVel.current.z -= playerVel.current.z * dragZ * dt;

    // Translate keypad WASD or touch-joystick vector inputs
    let moveForward = 0;
    let moveRight = 0;

    if (isMobileRef.current && touchJoystickActiveRef.current) {
      // Scale coordinates relative to touch joysticks offsets
      moveForward = -touchJoystickOffsetRef.current.y / 45; // forward is negative Y
      moveRight = touchJoystickOffsetRef.current.x / 45;
    } else {
      if (keysRef.current['w'] || keysRef.current['arrowup'] || keysRef.current['up']) moveForward += 1.0;
      if (keysRef.current['s'] || keysRef.current['arrowdown'] || keysRef.current['down']) moveForward -= 1.0;
      if (keysRef.current['a']) moveRight -= 1.0;
      if (keysRef.current['d']) moveRight += 1.0;
      if (keysRef.current['arrowleft'] || keysRef.current['left']) moveRight -= 1.0; // left arrow moves player left
      if (keysRef.current['arrowright'] || keysRef.current['right']) moveRight += 1.0; // right arrow moves player right
    }

    // Calculate motion vector relative to player facing camera Yaw direction
    const forwardVec = new THREE.Vector3(Math.sin(playerYaw.current), 0, Math.cos(playerYaw.current)).normalize();
    const rightVec = new THREE.Vector3(-Math.cos(playerYaw.current), 0, Math.sin(playerYaw.current)).normalize();

    const inputVec = new THREE.Vector3();
    inputVec.addScaledVector(forwardVec, moveForward);
    inputVec.addScaledVector(rightVec, moveRight);
    
    // Clamp joystick input magnitude to unit vectors
    if (inputVec.length() > 1.0) {
      inputVec.normalize();
    }

    if (!movementStartedRef.current) {
      const hasInput = (Math.abs(moveForward) > 0.01) || (Math.abs(moveRight) > 0.01) || 
                       keysRef.current[' '] || keysRef.current['space'] || 
                       keysRef.current['shift'] || keysRef.current['c'];
      if (hasInput) {
        movementStartedRef.current = true;
      }
    }

    // Sprinting modifiers and dynamic max speed limits
    let accelRate = groundedRef.current ? 50.0 : 18.0; // Air steering rate is lowered to 18.0 to make jumps less floaty and far

    const isHoldingSprint = keysRef.current['shift'] || keysRef.current['c'];

    if (groundedRef.current) {
      if (isHoldingSprint && inputVec.length() > 0.1) {
        if (!sprintingRef.current) {
          sprintingRef.current = true;
        }
        // Gradually accelerate max speed on the ground up to 6 m/s faster than typical running speed.
        // Typical running speed is 12.0, sprinting limit is 18.0.
        currentMaxSpeedRef.current = Math.min(18.0, currentMaxSpeedRef.current + 2.0 * dt);

        // Apply exactly 2 m/s^2 linear acceleration during active sprint towards currentMaxSpeedRef
        const horizVel = new THREE.Vector2(playerVel.current.x, playerVel.current.z);
        const horizSpeed = horizVel.length();
        if (horizSpeed < currentMaxSpeedRef.current) {
          const targetSpeed = Math.min(currentMaxSpeedRef.current, horizSpeed + 2.0 * dt);
          if (horizSpeed > 0.05) {
            playerVel.current.x = (playerVel.current.x / horizSpeed) * targetSpeed;
            playerVel.current.z = (playerVel.current.z / horizSpeed) * targetSpeed;
          } else {
            playerVel.current.x += inputVec.x * 2.0 * dt;
            playerVel.current.z += inputVec.z * 2.0 * dt;
          }
        }
      } else {
        sprintingRef.current = false;
        // Gradually decay back to normal running speed on the ground
        currentMaxSpeedRef.current = Math.max(12.0, currentMaxSpeedRef.current - 12.0 * dt);
      }
    } else {
      // In the air, sprinting state can be held, but we CANNOT increase max speed further.
      // The current max speed limit is locked at whatever it was when taking off.
      if (!isHoldingSprint) {
        sprintingRef.current = false;
      }
    }

    const currentMaxSpeed = currentMaxSpeedRef.current;

    // Accelerating the player's core velocity
    playerVel.current.addScaledVector(inputVec, accelRate * speedBoostRef.current * dt);

    // Apply speed limits (unless launched)
    const horizSpeed = Math.hypot(playerVel.current.x, playerVel.current.z);
    const maxSpeedLimit = currentMaxSpeed * speedBoostRef.current;
    if (horizSpeed > maxSpeedLimit) {
      if (speedBoostRef.current === 1.0) {
        // Smoothly and gradually decay excess speed back to maxSpeedLimit (rather than locking/snapping instantly)
        const decayRate = groundedRef.current ? 4.5 : 1.2; // 1.2 in air makes it very soft, natural, and gradual
        const newSpeed = Math.max(maxSpeedLimit, horizSpeed - (horizSpeed - maxSpeedLimit) * decayRate * dt);
        playerVel.current.x = (playerVel.current.x / horizSpeed) * newSpeed;
        playerVel.current.z = (playerVel.current.z / horizSpeed) * newSpeed;
      } else {
        // When speed boost is active, hard cap at the boosted max limit to prevent out-of-control speeds
        playerVel.current.x = (playerVel.current.x / horizSpeed) * maxSpeedLimit;
        playerVel.current.z = (playerVel.current.z / horizSpeed) * maxSpeedLimit;
      }
    }

    // Handle climbing motion input
    if (climbingRef.current) {
      playerVel.current.y = 0;
      if (keysRef.current['w'] || keysRef.current['arrowup'] || (isMobileRef.current && touchJoystickActiveRef.current && touchJoystickOffsetRef.current.y < -15)) {
        playerVel.current.y = 6.0;
      } else if (keysRef.current['s'] || keysRef.current['arrowdown'] || (isMobileRef.current && touchJoystickActiveRef.current && touchJoystickOffsetRef.current.y > 15)) {
        playerVel.current.y = -6.0;
      }
    }

    // JUMPING ACTION!
    const wantsJump = keysRef.current[' '] || keysRef.current['space'];
    if (wantsJump) {
      // Clear flag to avoid continuous jumps
      keysRef.current[' '] = false;
      keysRef.current['space'] = false;

      // Check if player is on or recently touched a jump block
      const now = Date.now();
      const recentlyTouchedJump = (now - lastJumpBlockCollisionTimeRef.current) < 250;
      const recentlyTouchedWall = lastWallTouchRef.current && (now - lastWallTouchRef.current.time < 350) && !groundedRef.current;

      if (recentlyTouchedJump) {
        // Super massive jump leap boost!
        playerVel.current.y = 26.0; // standard jump is 14.5, automatic is 18.0. Manual active jump on jump block gives 26.0!
        groundedRef.current = false;
        lastJumpBlockCollisionTimeRef.current = 0; // Consume jump pad collision so it can only be triggered once
        synths.playBoost();
        // Give a little forward push as well!
        playerVel.current.addScaledVector(forwardVec, 5.5);
      } else if (groundedRef.current || (Date.now() - lastTimeGroundedRef.current < 160)) {
        // Normal jump (balanced height) with Coyote Time (e.g. 160ms leeway window)
        playerVel.current.y = 14.5; // standard jump velocity (was 17.0)
        groundedRef.current = false;
        lastTimeGroundedRef.current = 0; // Prevent repetitive coyote jumping mid-air
        synths.playJump();
      } else if (recentlyTouchedWall && lastWallTouchRef.current) {
        // WALL JUMP off any wall block (uses physical contact normal!)
        const wallNormal = lastWallTouchRef.current.normal.clone();
        
        playerVel.current.y = 14.5; // wall jump height (was 17.0)
        // Set/Add velocity away from wall normal and forward
        playerVel.current.x = wallNormal.x * 8.5 + forwardVec.x * 5.5;
        playerVel.current.z = wallNormal.z * 8.5 + forwardVec.z * 5.5;

        wallRunDirectionRef.current = null;
        wallRunCooldownRef.current = 0.35; // delay subsequent stickings
        lastWallTouchRef.current = null; // consume touch

        synths.playJump();
      } else if (wallRunDirectionRef.current) {
        // WALL JUMP! Kick players AWAY from wall + forward speed boost!
        const wallNormal = new THREE.Vector3(-Math.cos(playerYaw.current), 0, Math.sin(playerYaw.current)).normalize();
        if (wallRunDirectionRef.current === 'right') {
          wallNormal.negate(); // push left
         }
        
        playerVel.current.y = 14.5; 
        playerVel.current.x = wallNormal.x * 8.5 + forwardVec.x * 5.5;
        playerVel.current.z = wallNormal.z * 8.5 + forwardVec.z * 5.5;

        wallRunDirectionRef.current = null;
        wallRunCooldownRef.current = 0.35; // delay subsequent stickings

        synths.playJump();
      } else if (climbingRef.current) {
        // Dismount ladder kick
        playerVel.current.y = 10.5;
        playerVel.current.addScaledVector(forwardVec, -4.0); // leap backwards
        climbingRef.current = false;
        synths.playJump();
      }
    }

    // Wall run Cooldown decr
    if (wallRunCooldownRef.current > 0) {
      wallRunCooldownRef.current -= dt;
    }

    // Update coordinates step prospectively
    const stepX = playerVel.current.x * dt;
    const stepY = playerVel.current.y * dt;
    const stepZ = playerVel.current.z * dt;

    playerPos.current.x += stepX;
    playerPos.current.y += stepY;
    playerPos.current.z += stepZ;

    // Check collision boundaries with and solve kinematics
    const playerRadius = 0.65;
    const playerHeight = slidingRef.current ? 0.9 : 1.8;
    
    // Bounds check
    let nextGrounded = false;
    let nextClimbing = false;
    let adjacentWallrunWall: 'left' | 'right' | null = null;

    for (const block of level.blocks) {
      // Define block AABB bounding limits
      const minX = block.x - block.w / 2;
      const maxX = block.x + block.w / 2;
      const minY = block.y;
      const maxY = block.y + block.h;
      const minZ = block.z - block.d / 2;
      const maxZ = block.z + block.d / 2;

      // Define player bounding offset
      const px = playerPos.current.x;
      const py = playerPos.current.y;
      const pz = playerPos.current.z;

      // Check spatial coordinate overlaps
      const isOverlapping = 
        (px + playerRadius > minX && px - playerRadius < maxX) &&
        (py + playerHeight > minY && py < maxY) &&
        (pz + playerRadius > minZ && pz - playerRadius < maxZ);

      if (isOverlapping) {
        // Collision actions on interactive elements
        if (block.type === 'hazard') {
          handlePlayerDeath();
          break; // Stop processing all other collisions immediately on death
        }

        if (block.type === 'end') {
          handleLevelCompleted();
          break; // Stop processing other collisions on level completion
        }

        if (block.type === 'checkpoint') {
          const checkpointId = `ch_${block.id}`;
          if (!activeCheckpointRef.current || !activeCheckpointRef.current.equals(new THREE.Vector3(block.x, block.y + 1, block.z))) {
            activeCheckpointRef.current = new THREE.Vector3(block.x, block.y + 1.2, block.z);
            
            // Limit coordinate trigger sound spamming
            const now = Date.now();
            const lastTriggered = checkpointSoundCoolRef.current[checkpointId] || 0;
            if (now - lastTriggered > 4000) {
              synths.playCheckpoint();
              checkpointSoundCoolRef.current[checkpointId] = now;
            }
          }
          // Do not return! Proceed to physical resolution so standard collision check keeps player from falling through checkpoint blocks.
        }

        if (block.type === 'jump') {
          const now = Date.now();
          lastJumpBlockCollisionTimeRef.current = now;
          const lastLaunch = jumpCoolRef.current[block.id] || 0;
          if (now - lastLaunch > 500) {
            playerVel.current.y = 22.5; // dynamic solid upward launch (made higher from 18.0)
            
            // Boost player in their horizontal looking direction to easily clear horizontal gaps
            playerVel.current.x = forwardVec.x * 8.5;
            playerVel.current.z = forwardVec.z * 8.5;

            synths.playBoost();
            jumpCoolRef.current[block.id] = now;
          }
          // Do not return! Proceed to physical resolution so player doesn't fall through.
        }

        if (block.type === 'speed') {
          const now = Date.now();
          const lastBoost = speedCoolRef.current[block.id] || 0;
          if (now - lastBoost > 800) {
            speedBoostRef.current = 1.6;
            // Add a substantial direct velocity push along player facing forwardVec
            playerVel.current.add(forwardVec.clone().multiplyScalar(6.5));
            synths.playBoost();
            speedCoolRef.current[block.id] = now;
            setTimeout(() => {
              speedBoostRef.current = 1.0;
            }, 800);
          }
          // Do not return! Let player stand on speed pads.
        }

        if (block.type === 'climb') {
          nextClimbing = true;
          continue; // ladders allow overlaps, continue checking remaining blocks
        }

        // Kinematic physical box displacement solving (calculate minimum separation penetration vectors)
        const overlapX = Math.min(px + playerRadius - minX, maxX - (px - playerRadius));
        const overlapY = Math.min(py + playerHeight - minY, maxY - py);
        const overlapZ = Math.min(pz + playerRadius - minZ, maxZ - (pz - playerRadius));

        // Push player outside of block on the shallowest intersection axis
        if (overlapY < overlapX && overlapY < overlapZ) {
          // Collision on horizontal roof or floor
          const isFallingOrDescending = playerVel.current.y <= 0.05;
          if (isFallingOrDescending || py + playerRadius > (minY + maxY) / 2) {
            // Standing coordinates floor collision (grounded)
            playerPos.current.y = maxY;
            if (block.type !== 'jump') {
              playerVel.current.y = 0;
              nextGrounded = true;

              // Simple micro land feedback audio
              if (!groundedRef.current) {
                synths.playLand();
              }
            }
          } else {
            // Underneath roof collision (bump head)
            playerPos.current.y = minY - playerHeight;
            playerVel.current.y = Math.min(0, playerVel.current.y);
          }
        } else if (overlapX < overlapY && overlapX < overlapZ) {
          // Lateral X axis displacement push-out
          if (px < (minX + maxX) / 2) {
            playerPos.current.x = minX - playerRadius;
          } else {
            playerPos.current.x = maxX + playerRadius;
          }
          playerVel.current.x = 0;

          // Check if this block was wallrun compatible (now supporting normal blocks so player can wall-jump off normal wall blocks as well!)
          if ((block.type === 'wallrun' || block.type === 'normal') && !groundedRef.current && wallRunCooldownRef.current <= 0) {
            adjacentWallrunWall = px < (minX + maxX) / 2 ? 'right' : 'left';
            const normX = px < (minX + maxX) / 2 ? -1 : 1;
            lastWallTouchRef.current = {
              normal: new THREE.Vector3(normX, 0, 0),
              time: Date.now(),
              blockId: block.id
            };
          }
        } else {
          // Longitudinal Z axis displacement push-out
          if (pz < (minZ + maxZ) / 2) {
            playerPos.current.z = minZ - playerRadius;
          } else {
            playerPos.current.z = maxZ + playerRadius;
          }
          playerVel.current.z = 0;

          if ((block.type === 'wallrun' || block.type === 'normal') && !groundedRef.current && wallRunCooldownRef.current <= 0) {
            adjacentWallrunWall = pz < (minZ + maxZ) / 2 ? 'right' : 'left';
            const normZ = pz < (minZ + maxZ) / 2 ? -1 : 1;
            lastWallTouchRef.current = {
              normal: new THREE.Vector3(0, 0, normZ),
              time: Date.now(),
              blockId: block.id
            };
          }
        }
      }
    }

    groundedRef.current = nextGrounded;
    if (nextGrounded) {
      lastTimeGroundedRef.current = Date.now();
    }
    climbingRef.current = nextClimbing;

    // Trigger active wallrunning mechanics
    if (adjacentWallrunWall && (keysRef.current['w'] || (isMobileRef.current && touchJoystickActiveRef.current && touchJoystickOffsetRef.current.y < -15))) {
      if (!wallRunDirectionRef.current) {
        // Trigger start sound
        synths.playWallrun();
      }
      wallRunDirectionRef.current = adjacentWallrunWall;
    } else {
      wallRunDirectionRef.current = null;
    }

    // Fall out of level bounds checking
    if (playerPos.current.y < -35) {
      handlePlayerDeath();
    }

    // Set interactive speed HUD displays
    setSpeed(Math.round(playerVel.current.length()));

    // Dynamic HUD modifiers indicators lists
    const mods: string[] = [];
    if (sprintingRef.current && groundedRef.current) mods.push('SPRINT');
    if (wallRunDirectionRef.current) mods.push('WALL-RUN');
    if (climbingRef.current) mods.push('CLIMBING');
    if (speedBoostRef.current > 1.0) mods.push('BOOST');
    setActiveModifiers(mods);
  };

  // Replay ghost coordinates side-by-side
  const updateGhostReplay = () => {
    if (!ghostActiveRef.current || !ghostMeshRef.current || ghostFramesRef.current.length === 0) return;

    // Find ghost frame corresponding to current timestamp
    const targetMs = elapsedTimeRef.current * 1000;
    
    // Simple interpolation search
    let activeFrame = ghostFramesRef.current[0];
    for (let i = 0; i < ghostFramesRef.current.length; i++) {
      if (ghostFramesRef.current[i].time > targetMs) {
        activeFrame = ghostFramesRef.current[i];
        break;
      }
    }

    if (activeFrame) {
      ghostMeshRef.current.position.set(activeFrame.x, activeFrame.y + 0.8, activeFrame.z);
      ghostMeshRef.current.rotation.set(activeFrame.rx, activeFrame.ry, 0);
    }
  };

  const handlePlayerDeath = () => {
    setDeaths(prev => prev + 1);
    synths.playDeath();

    // Reset player back to last active Checkpoint coordinates or start pad
    if (activeCheckpointRef.current) {
      playerPos.current.copy(activeCheckpointRef.current);
    } else {
      const spawnBlock = level.blocks.find(b => b.type === 'start') || level.blocks[0];
      playerPos.current.set(
        spawnBlock ? spawnBlock.x : 0, 
        spawnBlock ? spawnBlock.y + spawnBlock.h + 1.2 : 4,
        spawnBlock ? spawnBlock.z : 0
      );
    }
    playerVel.current.set(0, 0, 0);
    slidingRef.current = false;
    sprintingRef.current = false;
    currentMaxSpeedRef.current = 12.0;
    climbingRef.current = false;
    wallRunDirectionRef.current = null;
    lastWallTouchRef.current = null;
  };

  const handleLevelCompleted = () => {
    if (isCompletedRef.current) return;
    setIsCompleted(true);
    isCompletedRef.current = true;
    setCompletionTime(elapsedTimeRef.current);
    synths.playFinish();

    if (raceMode) {
      const selfEntry = {
        username: currentUser?.username || 'You',
        time: elapsedTimeRef.current,
        finished: true,
        isNpc: false,
        color: localStorage.getItem(`racer_color_${currentUser?.username}`) || '#3b82f6'
      };

      opponentMeshesRef.current.forEach(opp => {
        if (!opp.finished) {
          const remainingDist = Math.max(0, totalSplineLengthRef.current - opp.progressDistance);
          const predictedTime = elapsedTimeRef.current + (remainingDist / Math.max(1, opp.baseSpeed));
          opp.finished = true;
          opp.finalTime = parseFloat(predictedTime.toFixed(2));
        }
      });

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

      if (onRaceFinished) {
        onRaceFinished(elapsedTimeRef.current, finalRanks);
      }

      bcRef.current?.postMessage({
        type: 'GAME_FINISHED',
        levelId: level.id,
        username: currentUser?.username || 'Guest',
        time: elapsedTimeRef.current
      });
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
      pbDiff = elapsedTimeRef.current - previousBest;
      setTimeDiff(pbDiff);
      if (pbDiff < 0) {
        isNewPb = true;
      }
    }

    setIsPb(isNewPb);

    // Save and commit high scores if faster
    if (previousBest === null || elapsedTimeRef.current < previousBest) {
      localStorage.setItem(`best_time_${level.id}`, elapsedTimeRef.current.toString());
      setPersonalBest(elapsedTimeRef.current);

      // Commit the recorded ghost runframes list
      const replay: RunReplay = {
        levelId: level.id,
        playerEmail: currentUser?.username || 'user@aistudio.build',
        time: elapsedTimeRef.current,
        frames: currentRunFramesRef.current,
        createdAt: Date.now()
      };
      localStorage.setItem(`ghost_replay_${level.id}`, JSON.stringify(replay));
    }

    // Commit run entry to local leaderboards list & Calculate standing percentile
    if (!isLeaderboardLoggedRef.current) {
      isLeaderboardLoggedRef.current = true;
      try {
        const stored = localStorage.getItem(`leaderboard_${level.id}`);
        const entries = stored ? JSON.parse(stored) : [];
        
        // Calculate World Rank & Percentile dynamically
        const activeName = (currentUser?.username || 'Guest').toLowerCase().trim();
        const playerBests: { [username: string]: number } = {};
        
        // Add all historical entries
        entries.forEach((r: any) => {
          if (!r.time || r.time <= 0.05) return;
          const name = r.playerName.toLowerCase().trim();
          if (!playerBests[name] || r.time < playerBests[name]) {
            playerBests[name] = r.time;
          }
        });
        
        // Ensure our run (new PB) is recorded as our best in this analysis
        playerBests[activeName] = elapsedTimeRef.current;
        
        // Sort and find active player's world standing index
        const allPlayerBests = Object.keys(playerBests).map(name => playerBests[name]);
        allPlayerBests.sort((a, b) => a - b);
        
        const rankIdx = allPlayerBests.indexOf(elapsedTimeRef.current);
        const totalLen = allPlayerBests.length;
        const worldRank = rankIdx + 1;
        
        let percentileVal = 100;
        if (totalLen > 1) {
          percentileVal = Math.round((1 - (rankIdx / (totalLen - 1))) * 100);
        }
        
        if (isNewPb) {
          setCompletionPercentile(percentileVal);
          setCompletionWorldRank({ rank: worldRank, total: totalLen });
        } else {
          setCompletionPercentile(null);
          setCompletionWorldRank(null);
        }

        const newEntry = {
          id: `run_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          levelId: level.id,
          playerName: currentUser?.username || 'Guest',
          time: elapsedTimeRef.current,
          date: Date.now(),
          device: isMobileRef.current ? 'mobile' : 'desktop'
        };
        localStorage.setItem(`leaderboard_${level.id}`, JSON.stringify([...entries, newEntry]));
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

  // Telemetry download export ghost data
  const exportGhostToClipboard = () => {
    const data = localStorage.getItem(`ghost_replay_${level.id}`);
    if (data) {
      navigator.clipboard.writeText(data);
      alert('Copied Ghost Replay JSON code to clipboard!');
    } else {
      alert('No run recorded yet to export.');
    }
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
    <div ref={canvasContainerRef} className="relative w-full h-[90vh] bg-neutral-950 overflow-hidden select-none">
      
      {/* 3D WebGL Canvas viewport */}
      <canvas 
        ref={canvasRef} 
        onClick={handleCanvasClick}
        className="w-full h-full block cursor-pointer" 
      />

      {/* Pointer Lock Help Overlay for desktops */}
      {!isLocked && !isCompleted && !isMobileRef.current && (
        <div className="absolute inset-0 bg-neutral-950/75 backdrop-blur-sm flex flex-col justify-center items-center p-6 text-center z-25">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-sm shadow-2xl flex flex-col items-center">
            <Compass className="w-12 h-12 text-indigo-500 mb-4 animate-pulse" />
            <h2 className="text-xl font-extrabold text-neutral-50 tracking-tight">Time Trial Simulation</h2>
            <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
              Click anywhere on screen to lock your cursor and steer the camera with your mouse. Use <b>WASD</b> to move.
            </p>
            
            <div className="grid grid-cols-2 gap-2 w-full mt-6 text-[10px] font-mono text-neutral-400">
              <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-xl">
                <span className="text-neutral-500 font-bold block mb-1">WASD</span>
                Movement
              </div>
              <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-xl">
                <span className="text-neutral-500 font-bold block mb-1">SPACE</span>
                Leap Jump
              </div>
              <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-xl">
                <span className="text-neutral-500 font-bold block mb-1">L-SHIFT / C</span>
                Sprint Hold
              </div>
              <div className="p-2.5 bg-neutral-950 border border-neutral-800 rounded-xl">
                <span className="text-neutral-500 font-bold block mb-1">R KEY</span>
                Restart Run
              </div>
            </div>

            <button 
              onClick={() => canvasRef.current?.requestPointerLock()}
              className="mt-6 w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-lg cursor-pointer"
            >
              Lock Cursor &amp; Play
            </button>
            <button
              onClick={onExit}
              className="mt-3 text-xs text-neutral-500 hover:text-neutral-300 font-medium hover:underline"
            >
              Exit Course
            </button>
          </div>
        </div>
      )}

      {/* Minimal Play HUD Overlay */}
      {!isCompleted && (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 z-10">
          
          {/* Live Racing Standings list */}
          {raceMode && liveRankings.length > 0 && (
            <div className="absolute top-24 left-6 bg-neutral-900/95 border border-neutral-800 p-4 rounded-2xl shadow-lg backdrop-blur w-56 flex flex-col gap-2 z-20 pointer-events-auto">
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
                        {rank.finished && rank.finalTime ? `${rank.finalTime.toFixed(1)}s` : `${Math.round(rank.progressDistance)}m`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Panel stats */}
          <div className="flex justify-between items-start w-full">
            
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

            {/* Right Box: Course Title & Actions */}
            <div className="flex flex-col items-end gap-2">
              <div className="bg-neutral-900/95 border border-neutral-800 px-4 py-2 rounded-xl shadow-lg backdrop-blur flex items-center gap-3">
                <div className="text-right">
                  <h3 className="text-xs font-bold text-neutral-50">{level.name}</h3>
                  <div className="flex gap-2 justify-end items-center mt-0.5">
                    <span className="text-[9px] font-mono text-neutral-500 block uppercase">Gate {calculateProgress()}%</span>
                    <span className="text-[9px] font-mono text-neutral-400 block px-1.5 py-0.5 bg-neutral-950/80 border border-neutral-800/50 rounded uppercase">Deaths: {deaths}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={onExit}
                className="pointer-events-auto bg-neutral-900/90 border border-neutral-800 px-3 py-1.5 rounded-lg text-[10px] text-neutral-400 hover:text-neutral-200 cursor-pointer transition font-mono uppercase"
              >
                Exit
              </button>
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
                <div className="bg-neutral-900/95 border border-neutral-800 px-3.5 py-2.5 rounded-xl flex items-baseline gap-2 shadow-lg backdrop-blur">
                  <Flame className="w-4 h-4 text-orange-500 self-center animate-bounce" />
                  <div>
                    <span className="text-[9px] font-mono text-neutral-500 uppercase tracking-widest block">Inst. Velocity</span>
                    <span className="text-sm font-bold font-mono text-neutral-200">{speed} <span className="text-[10px] text-neutral-500">m/s</span></span>
                  </div>
                </div>
              </div>

              {/* Instant screen restart button */}
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
            </div>

            {/* Touch overlay inputs (Visualizes joystick on Left half, Jump on Right) */}
            {isMobileRef.current && (
              <div 
                className="pointer-events-auto w-full grid grid-cols-2 h-44 gap-4"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
              >
                
                {/* Left zone: custom virtual joystick rendering */}
                <div className="relative flex items-center justify-center">
                  <div className={`w-28 h-28 rounded-full border border-neutral-800 bg-neutral-950/20 backdrop-blur-sm flex items-center justify-center transition-opacity duration-200 ${touchJoystickActive ? 'opacity-100' : 'opacity-40'}`}>
                    {/* Joystick knob handle */}
                    <div 
                      className="absolute w-12 h-12 rounded-full bg-neutral-50 border border-neutral-300 shadow-xl"
                      style={{
                        transform: `translate(${touchJoystickOffset.x}px, ${touchJoystickOffset.y}px)`
                      }}
                    />
                  </div>
                </div>

                {/* Right zone: Action execution buttons */}
                <div className="flex gap-4 items-center justify-end pr-4">
                  {/* SPRINT button */}
                  <button
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      keysRef.current['shift'] = true;
                    }}
                    onTouchEnd={(e) => {
                      e.stopPropagation();
                      keysRef.current['shift'] = false;
                    }}
                    onTouchCancel={(e) => {
                      e.stopPropagation();
                      keysRef.current['shift'] = false;
                    }}
                    className="w-16 h-16 rounded-full bg-neutral-900/60 border border-neutral-800 flex flex-col items-center justify-center active:bg-indigo-600 transition animate-pulse"
                  >
                    <span className="text-[10px] font-bold text-neutral-400 font-mono">SPRINT</span>
                  </button>

                  {/* JUMP button */}
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
                </div>

              </div>
            )}

          </div>

        </div>
      )}

      {/* Completion Dialog Overlay */}
      {isCompleted && (
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
                        <span className="text-neutral-400 font-bold">
                          {std.time ? `${std.time.toFixed(2)}s` : 'DNF'}
                        </span>
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

                {/* Percentile Box */}
                {completionPercentile !== null && completionWorldRank !== null && (
                  <div id="completion-percentile-card" className="w-full mt-3 bg-indigo-500/15 border border-indigo-500/30 p-4 rounded-2xl flex flex-col items-center justify-center gap-2 shadow-inner">
                    <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-wider font-bold">Community Standing</span>
                    
                    <div className="flex items-center justify-around w-full gap-4 mt-1">
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-black font-mono text-indigo-300">
                          Top {completionPercentile}%
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

            <div className="grid grid-cols-2 gap-2.5 w-full mt-8">
              <button
                onClick={initGame}
                className="py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-900 text-xs font-bold rounded-xl transition shadow flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Run
              </button>
              <button
                onClick={onShowLeaderboard}
                className="py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer border border-neutral-700"
              >
                <Award className="w-4 h-4" />
                Leaderboard
              </button>
            </div>

            {settings.showGhost && personalBest && (
              <button
                onClick={exportGhostToClipboard}
                className="mt-6 text-[10px] text-neutral-500 font-mono hover:text-indigo-400 hover:underline flex items-center gap-1 justify-center py-2 border-t border-neutral-800/80 w-full"
              >
                <FileText className="w-3 h-3" />
                Export telemetry ghost string
              </button>
            )}

            <button
              onClick={onExit}
              className="mt-4 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition hover:underline"
            >
              Exit to Menu
            </button>

          </div>
        </div>
      )}

    </div>
  );
}
