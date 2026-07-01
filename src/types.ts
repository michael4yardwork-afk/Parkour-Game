export type BlockType =
  | 'start'      // Spawn pad
  | 'end'        // Finish container
  | 'normal'     // Standard concrete block
  | 'wallrun'    // High-friction wall surface (requires jump/slide along the side)
  | 'jump'       // Propels players upward on touch
  | 'hazard'     // Spikes/lava that reset player to last checkpoint
  | 'climb'      // Climbing mesh/scaffolding
  | 'speed'      // Speed boosting conveyor block
  | 'checkpoint' // Mid-course respawn point
  | 'glass';     // Collapsible/slippery block

export interface BlockConfig {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
}

export type SceneTheme = 'sky_islands' | 'neon_grid' | 'industrial_rust' | 'mountain_sunset' | 'abstract_white';

export interface LevelConfig {
  id: string;
  name: string;
  description: string;
  blocks: BlockConfig[];
  theme: SceneTheme;
  isCustom?: boolean;
  creator?: string;
  createdAt?: number;
  isPublished?: boolean;
  likesCount?: number;
}

export interface PlayerState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
  wallRunning: 'left' | 'right' | null;
  sliding: boolean;
  climbing: boolean;
  slideTimer: number;
  crouching: boolean;
  lastActiveCheckpoint: { x: number; y: number; z: number } | null;
}

export interface GhostFrame {
  time: number; // millisecond offset from start
  x: number;
  y: number;
  z: number;
  rx: number; // pitch
  ry: number; // yaw
  state: 'run' | 'jump' | 'slide' | 'wall_left' | 'wall_right' | 'climb';
}

export interface RunReplay {
  levelId: string;
  playerEmail: string;
  time: number; // final completion time in seconds
  frames: GhostFrame[];
  createdAt: number;
}

export interface LeaderboardEntry {
  id: string;
  levelId: string;
  playerName: string;
  time: number;
  date: number;
  device?: string;
  speeds?: number[];
  actions?: string[];
}

export interface GameSettings {
  mouseSensitivity: number;
  fov: number;
  musicVolume: number;
  sfxVolume: number;
  showGhost: boolean;
  invertY: boolean;
  adjustablePerspective: boolean;
  showJoystick?: boolean;
  showJumpButton?: boolean;
}

export interface UserAccount {
  username: string;
  passwordHash: string;
  avatar: string;
  avatarBg: string;
  createdAt: number;
}

export interface RaceParticipant {
  username: string;
  color: string;
  avatar: string;
  isNpc: boolean;
  baseSpeed: number;
  seed: number;
}

export interface RaceHistoryEntry {
  id: string;
  levelId: string;
  levelName: string;
  playerName: string;
  playerColor: string;
  place: number;
  time: number;
  opponents: { username: string; time?: number; finished: boolean; isNpc: boolean; color: string }[];
  ratingChange: number;
  newRating: number;
  date: number;
}

export interface CourseNotification {
  id: string;
  creator: string;
  courseId: string;
  courseName: string;
  createdAt: number;
  read: boolean;
}



