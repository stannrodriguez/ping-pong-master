export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type SpinType = 'topspin' | 'backspin' | 'sidespin-left' | 'sidespin-right' | 'flat';

export interface SpinConfig {
  type: SpinType;
  label: string;
  color: string;
  description: string;
  tip: string;
  icon: string;
  rpm: Vec3;
}

export interface BallState {
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
  spinType: SpinType;
  isServing: boolean;
  lastHitBy: 'player' | 'opponent' | null;
  trail: Vec3[];
  bounceCount: number;
  isInPlay: boolean;
}

export interface PaddleState {
  position: Vec3;
  rotation: Vec3;
  spinType: SpinType;
}

export interface PlayerState {
  paddle: PaddleState;
  score: number;
  name: string;
}

export type GameMode = 'ai' | 'multiplayer' | 'lab';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type GamePhase = 'menu' | 'serving' | 'playing' | 'point-scored' | 'game-over';

export interface GameConfig {
  mode: GameMode;
  difficulty: Difficulty;
  pointsToWin: number;
  showSpinHelpers: boolean;
  showTrajectory: boolean;
}

export const SPIN_CONFIGS: Record<SpinType, SpinConfig> = {
  topspin: {
    type: 'topspin',
    label: 'Topspin',
    color: '#ff4444',
    description: 'Ball dips down faster — great for aggressive shots',
    tip: 'Brush UP on the back of the ball. The ball dips quickly after the bounce, making it hard to return.',
    icon: '⬆️',
    rpm: { x: -3000, y: 0, z: 0 },
  },
  backspin: {
    type: 'backspin',
    label: 'Backspin',
    color: '#4488ff',
    description: 'Ball floats and stays low after bounce — great for control',
    tip: 'Brush DOWN on the bottom of the ball. The ball floats and bounces low, slowing the rally.',
    icon: '⬇️',
    rpm: { x: 3000, y: 0, z: 0 },
  },
  'sidespin-left': {
    type: 'sidespin-left',
    label: 'Sidespin Left',
    color: '#ffaa00',
    description: 'Ball curves left — use to pull opponents wide',
    tip: 'Brush the RIGHT side of the ball. It curves left from your perspective, moving the opponent out of position.',
    icon: '⬅️',
    rpm: { x: 0, y: 2500, z: 0 },
  },
  'sidespin-right': {
    type: 'sidespin-right',
    label: 'Sidespin Right',
    color: '#ffaa00',
    description: 'Ball curves right — mirror of left sidespin',
    tip: 'Brush the LEFT side of the ball. It curves right from your perspective — great for serves and angled returns.',
    icon: '➡️',
    rpm: { x: 0, y: -2500, z: 0 },
  },
  flat: {
    type: 'flat',
    label: 'Flat / No Spin',
    color: '#aaaaaa',
    description: 'No spin — predictable straight shot',
    tip: 'Hit the ball dead center with a flat paddle. Predictable but easy to read.',
    icon: '⏺️',
    rpm: { x: 0, y: 0, z: 0 },
  },
};

export const TABLE = {
  width: 5,
  length: 9,
  height: 0.1,
  surfaceY: 0.76,
  netHeight: 0.15,
  netThickness: 0.02,
} as const;

export const BALL = {
  radius: 0.02,
  mass: 0.0027,
  restitution: 0.9,
  dragCoeff: 0.5,
  liftCoeff: 0.0002,
  magnusCoeff: 0.00015,
} as const;

export const GAME = {
  gravity: -9.81,
  dt: 1 / 120,
  maxBallSpeed: 15,
  serveSpeed: 4,
  returnSpeed: 6,
  trailLength: 30,
  pointsToWin: 11,
} as const;
