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
  passedNet: boolean;
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
  aimX: number;
}

export const TABLE_2D = {
  width: 400,
  height: 600,
  netY: 300,
  paddleW: 80,
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
      passedNet: false,
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
    aimX: TABLE_2D.width / 2,
  };
}

export function serve2D(state: Game2DState): Game2DState {
  const spin = state.selectedSpin;
  const isPlayer = state.isPlayerServing;
  const baseSpeed = 4;

  const paddleCenterX = state.player.x + state.player.width / 2;
  const aimOffset = (state.aimX - paddleCenterX) / (TABLE_2D.width / 2);
  const vx = isPlayer ? aimOffset * 3 : (Math.random() - 0.5) * 2;
  const vy = isPlayer ? -baseSpeed : baseSpeed;

  return {
    ...state,
    ball: {
      x: isPlayer ? paddleCenterX : state.opponent.x + state.opponent.width / 2,
      y: isPlayer ? state.player.y - 20 : state.opponent.y + state.opponent.height + 20,
      vx,
      vy,
      spin,
      trail: [],
      inPlay: true,
      lastHit: isPlayer ? 'player' : 'opponent',
      passedNet: false,
    },
    phase: 'playing',
  };
}

function hitBall2DWithAim(ball: Ball2D, aimX: number, isPlayer: boolean, selectedSpin: SpinType, difficulty: string): Ball2D {
  const spin = isPlayer ? selectedSpin : getAISpin2D(difficulty);
  const baseSpeed = 4.5;

  const aimOffset = isPlayer
    ? (aimX - ball.x) / (TABLE_2D.width / 2)
    : (Math.random() - 0.5) * 1.5;

  let vx = aimOffset * 4;
  let vy = isPlayer ? -baseSpeed : baseSpeed;

  if (spin === 'sidespin-left') vx -= 1.2;
  if (spin === 'sidespin-right') vx += 1.2;
  if (spin === 'topspin') vy *= 1.25;
  if (spin === 'backspin') vy *= 0.7;

  return {
    ...ball,
    vx,
    vy,
    spin,
    lastHit: isPlayer ? 'player' : 'opponent',
    trail: [],
    passedNet: false,
  };
}

function getAISpin2D(difficulty: string): SpinType {
  const spins: SpinType[] = ['topspin', 'backspin', 'sidespin-left', 'sidespin-right', 'flat'];
  if (difficulty === 'beginner' && Math.random() < 0.5) return 'flat';
  return spins[Math.floor(Math.random() * spins.length)];
}

export function step2D(state: Game2DState): Game2DState {
  if (state.phase !== 'playing' || !state.ball.inPlay) return state;

  const { spin, lastHit } = state.ball;
  let { x, y, vx, vy, trail, passedNet } = state.ball;

  // Spin curve effects
  if (spin === 'sidespin-left') vx -= 0.04;
  if (spin === 'sidespin-right') vx += 0.04;
  if (spin === 'topspin') vy += (vy < 0 ? -0.015 : 0.015);
  if (spin === 'backspin') vy -= (vy < 0 ? 0.01 : -0.01);

  x += vx;
  y += vy;

  trail = [...trail.slice(-25), { x, y }];

  // Side walls
  if (x < TABLE_2D.ballR) { x = TABLE_2D.ballR; vx = Math.abs(vx); }
  if (x > TABLE_2D.width - TABLE_2D.ballR) { x = TABLE_2D.width - TABLE_2D.ballR; vx = -Math.abs(vx); }

  // Track net crossing
  if (!passedNet) {
    if ((vy < 0 && y < TABLE_2D.netY) || (vy > 0 && y > TABLE_2D.netY)) {
      passedNet = true;
    }
  }

  // Player paddle auto-intercept
  const pp = state.player;
  if (vy > 0 && y >= pp.y - 4 && y <= pp.y + pp.height + 4) {
    if (x >= pp.x - 8 && x <= pp.x + pp.width + 8 && lastHit === 'opponent') {
      const newBall = hitBall2DWithAim(
        { x, y, vx, vy, spin, trail, inPlay: true, lastHit, passedNet },
        state.aimX, true, state.selectedSpin, state.difficulty,
      );
      return { ...state, ball: { ...newBall, x, y: pp.y - 6, trail } };
    }
  }

  // Opponent paddle auto-intercept
  const op = state.opponent;
  if (vy < 0 && y <= op.y + op.height + 4 && y >= op.y - 4) {
    if (x >= op.x - 8 && x <= op.x + op.width + 8 && lastHit === 'player') {
      const newBall = hitBall2DWithAim(
        { x, y, vx, vy, spin, trail, inPlay: true, lastHit, passedNet },
        TABLE_2D.width / 2, false, state.selectedSpin, state.difficulty,
      );
      return { ...state, ball: { ...newBall, x, y: op.y + op.height + 6, trail } };
    }
  }

  // Out bottom
  if (y > TABLE_2D.height + 20) {
    const spinLabel = SPIN_CONFIGS[spin].label;
    return checkGameOver({
      ...state,
      opponentScore: state.opponentScore + 1,
      ball: { x, y, vx: 0, vy: 0, spin, trail, inPlay: false, lastHit, passedNet },
      phase: 'point-scored',
      pointMessage: lastHit === 'player'
        ? `AI's point! Your ${spinLabel} went long`
        : `AI's point! You missed the return`,
    });
  }

  // Out top
  if (y < -20) {
    const spinLabel = SPIN_CONFIGS[spin].label;
    return checkGameOver({
      ...state,
      playerScore: state.playerScore + 1,
      ball: { x, y, vx: 0, vy: 0, spin, trail, inPlay: false, lastHit, passedNet },
      phase: 'point-scored',
      pointMessage: lastHit === 'opponent'
        ? `Your point! AI's ${spinLabel} went long`
        : `Your point! AI missed the return`,
    });
  }

  // Out wide
  if (x < -30 || x > TABLE_2D.width + 30) {
    const spinLabel = SPIN_CONFIGS[spin].label;
    if (lastHit === 'player') {
      return checkGameOver({
        ...state,
        opponentScore: state.opponentScore + 1,
        ball: { x, y, vx: 0, vy: 0, spin, trail, inPlay: false, lastHit, passedNet },
        phase: 'point-scored',
        pointMessage: `AI's point! Your ${spinLabel} went wide`,
      });
    } else {
      return checkGameOver({
        ...state,
        playerScore: state.playerScore + 1,
        ball: { x, y, vx: 0, vy: 0, spin, trail, inPlay: false, lastHit, passedNet },
        phase: 'point-scored',
        pointMessage: `Your point! AI's ${spinLabel} went wide`,
      });
    }
  }

  // AI paddle tracking
  const dcfg = DIFFICULTY[state.difficulty];
  const aiTargetX = x - state.opponent.width / 2 + (Math.random() - 0.5) * (1 - dcfg.accuracy) * 60;
  const newOpX = state.opponent.x + (aiTargetX - state.opponent.x) * dcfg.tracking;

  // Player paddle auto-tracks ball X
  const playerTargetX = Math.max(0, Math.min(TABLE_2D.width - TABLE_2D.paddleW, x - pp.width / 2));
  const newPlayerX = pp.x + (playerTargetX - pp.x) * 0.25;

  return {
    ...state,
    ball: { x, y, vx, vy, spin, trail, inPlay: true, lastHit, passedNet },
    player: { ...pp, x: newPlayerX },
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
      passedNet: false,
    },
  };
}
