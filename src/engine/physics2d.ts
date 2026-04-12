import { SpinType, SPIN_CONFIGS } from './types';

export interface Ball2D {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: SpinType;
  trail: { x: number; y: number }[];
  inPlay: boolean;
  lastHit: 'player' | 'opponent' | null;
  bounced: boolean;
}

export interface Paddle2D {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Game2DState {
  ball: Ball2D;
  player: Paddle2D;
  opponent: Paddle2D;
  playerScore: number;
  opponentScore: number;
  phase: 'serving' | 'playing' | 'point-scored' | 'game-over';
  isPlayerServing: boolean;
  selectedSpin: SpinType;
  pointMessage: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export const TABLE_2D = {
  width: 400,
  height: 600,
  netY: 300,
  paddleW: 60,
  paddleH: 10,
  ballR: 6,
} as const;

const DIFFICULTY = {
  beginner: { speed: 2.5, tracking: 0.04, accuracy: 0.5 },
  intermediate: { speed: 3.5, tracking: 0.07, accuracy: 0.75 },
  advanced: { speed: 4.5, tracking: 0.12, accuracy: 0.9 },
} as const;

export function createGame2D(difficulty: 'beginner' | 'intermediate' | 'advanced' = 'beginner'): Game2DState {
  return {
    ball: {
      x: TABLE_2D.width / 2,
      y: TABLE_2D.height - 80,
      vx: 0,
      vy: 0,
      spin: 'flat',
      trail: [],
      inPlay: false,
      lastHit: null,
      bounced: false,
    },
    player: {
      x: TABLE_2D.width / 2 - TABLE_2D.paddleW / 2,
      y: TABLE_2D.height - 40,
      width: TABLE_2D.paddleW,
      height: TABLE_2D.paddleH,
    },
    opponent: {
      x: TABLE_2D.width / 2 - TABLE_2D.paddleW / 2,
      y: 30,
      width: TABLE_2D.paddleW,
      height: TABLE_2D.paddleH,
    },
    playerScore: 0,
    opponentScore: 0,
    phase: 'serving',
    isPlayerServing: true,
    selectedSpin: 'flat',
    pointMessage: '',
    difficulty,
  };
}

export function serve2D(state: Game2DState): Game2DState {
  const spin = state.selectedSpin;
  const isPlayer = state.isPlayerServing;
  const baseSpeed = 4;

  const vx = (Math.random() - 0.5) * 2;
  const vy = isPlayer ? -baseSpeed : baseSpeed;

  return {
    ...state,
    ball: {
      x: isPlayer ? state.player.x + state.player.width / 2 : state.opponent.x + state.opponent.width / 2,
      y: isPlayer ? state.player.y - 20 : state.opponent.y + state.opponent.height + 20,
      vx,
      vy,
      spin,
      trail: [],
      inPlay: true,
      lastHit: isPlayer ? 'player' : 'opponent',
      bounced: false,
    },
    phase: 'playing',
  };
}

export function hitBall2D(state: Game2DState, paddleX: number, paddleCenterX: number, isPlayer: boolean): Ball2D {
  const spin = isPlayer ? state.selectedSpin : getAISpin2D(state.difficulty);
  const offset = (state.ball.x - paddleCenterX) / (TABLE_2D.paddleW / 2);
  const baseSpeed = 4.5;

  let vx = offset * 3;
  let vy = isPlayer ? -baseSpeed : baseSpeed;

  if (spin === 'sidespin-left') vx -= 1.5;
  if (spin === 'sidespin-right') vx += 1.5;
  if (spin === 'topspin') vy *= 1.3;
  if (spin === 'backspin') vy *= 0.7;

  return {
    ...state.ball,
    vx,
    vy,
    spin,
    lastHit: isPlayer ? 'player' : 'opponent',
    trail: [],
    bounced: false,
  };
}

function getAISpin2D(difficulty: string): SpinType {
  const spins: SpinType[] = ['topspin', 'backspin', 'sidespin-left', 'sidespin-right', 'flat'];
  if (difficulty === 'beginner' && Math.random() < 0.5) return 'flat';
  return spins[Math.floor(Math.random() * spins.length)];
}

export function step2D(state: Game2DState): Game2DState {
  if (state.phase !== 'playing' || !state.ball.inPlay) return state;

  const { spin, lastHit, bounced } = state.ball;
  let { x, y, vx, vy, trail } = state.ball;

  // Spin effects (applied continuously for visual curve)
  if (spin === 'sidespin-left') vx -= 0.04;
  if (spin === 'sidespin-right') vx += 0.04;
  if (spin === 'topspin') vy += (vy < 0 ? -0.02 : 0.02);
  if (spin === 'backspin') vy -= (vy < 0 ? 0.015 : -0.015);

  x += vx;
  y += vy;

  trail = [...trail.slice(-25), { x, y }];

  // Side walls — bounce
  if (x < TABLE_2D.ballR) { x = TABLE_2D.ballR; vx = Math.abs(vx); }
  if (x > TABLE_2D.width - TABLE_2D.ballR) { x = TABLE_2D.width - TABLE_2D.ballR; vx = -Math.abs(vx); }

  // Net collision
  if (Math.abs(y - TABLE_2D.netY) < 4 && !bounced) {
    const netResult = { ...state };
    const spinLabel = SPIN_CONFIGS[spin].label;
    if (lastHit === 'player') {
      netResult.opponentScore++;
      netResult.pointMessage = `Net! Your ${spinLabel} hit the net`;
    } else {
      netResult.playerScore++;
      netResult.pointMessage = `Net! AI's ${spinLabel} hit the net`;
    }
    netResult.ball = { ...state.ball, x, y, vx: 0, vy: 0, inPlay: false, trail };
    netResult.phase = 'point-scored';
    return checkGameOver(netResult);
  }

  // Player paddle
  const pp = state.player;
  if (y >= pp.y - 2 && y <= pp.y + pp.height && x >= pp.x && x <= pp.x + pp.width && vy > 0) {
    const newBall = hitBall2D(state, pp.x, pp.x + pp.width / 2, true);
    return { ...state, ball: { ...newBall, x, y: pp.y - 2, trail } };
  }

  // Opponent paddle
  const op = state.opponent;
  if (y <= op.y + op.height + 2 && y >= op.y && x >= op.x && x <= op.x + op.width && vy < 0) {
    const newBall = hitBall2D(state, op.x, op.x + op.width / 2, false);
    return { ...state, ball: { ...newBall, x, y: op.y + op.height + 2, trail } };
  }

  // Out bottom — opponent scores
  if (y > TABLE_2D.height + 20) {
    const spinLabel = SPIN_CONFIGS[spin].label;
    return checkGameOver({
      ...state,
      opponentScore: state.opponentScore + 1,
      ball: { ...state.ball, inPlay: false, trail },
      phase: 'point-scored',
      pointMessage: lastHit === 'player' ? `AI's point! Your ${spinLabel} went out` : `AI's point! You missed`,
    });
  }

  // Out top — player scores
  if (y < -20) {
    const spinLabel = SPIN_CONFIGS[spin].label;
    return checkGameOver({
      ...state,
      playerScore: state.playerScore + 1,
      ball: { ...state.ball, inPlay: false, trail },
      phase: 'point-scored',
      pointMessage: lastHit === 'opponent' ? `Your point! AI's ${spinLabel} went out` : `Your point! AI missed`,
    });
  }

  // AI tracking
  const dcfg = DIFFICULTY[state.difficulty];
  const aiTargetX = x - state.opponent.width / 2 + (Math.random() - 0.5) * (1 - dcfg.accuracy) * 60;
  const newOpX = state.opponent.x + (aiTargetX - state.opponent.x) * dcfg.tracking;

  return {
    ...state,
    ball: { x, y, vx, vy, spin, trail, inPlay: true, lastHit, bounced },
    opponent: { ...state.opponent, x: Math.max(0, Math.min(TABLE_2D.width - TABLE_2D.paddleW, newOpX)) },
  };
}

function checkGameOver(state: Game2DState): Game2DState {
  if (state.playerScore >= 11 || state.opponentScore >= 11) {
    if (Math.abs(state.playerScore - state.opponentScore) >= 2) {
      return { ...state, phase: 'game-over' };
    }
  }
  return state;
}

export function nextServe2D(state: Game2DState): Game2DState {
  const total = state.playerScore + state.opponentScore;
  const isPlayerServing = Math.floor(total / 2) % 2 === 0;

  return {
    ...state,
    phase: 'serving',
    isPlayerServing,
    ball: {
      x: TABLE_2D.width / 2,
      y: isPlayerServing ? TABLE_2D.height - 80 : 80,
      vx: 0,
      vy: 0,
      spin: 'flat',
      trail: [],
      inPlay: false,
      lastHit: null,
      bounced: false,
    },
  };
}
