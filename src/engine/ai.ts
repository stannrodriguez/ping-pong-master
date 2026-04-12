import { BallState, Difficulty, SpinType, TABLE } from './types';
import { predictLanding } from './physics';

const DIFFICULTY_CONFIG: Record<Difficulty, {
  reactionDelay: number;
  accuracy: number;
  spinChoiceQuality: number;
  trackingSpeed: number;
}> = {
  beginner: { reactionDelay: 0.4, accuracy: 0.5, spinChoiceQuality: 0.3, trackingSpeed: 0.04 },
  intermediate: { reactionDelay: 0.2, accuracy: 0.75, spinChoiceQuality: 0.6, trackingSpeed: 0.08 },
  advanced: { reactionDelay: 0.08, accuracy: 0.92, spinChoiceQuality: 0.9, trackingSpeed: 0.13 },
};

const SPIN_OPTIONS: SpinType[] = ['topspin', 'backspin', 'sidespin-left', 'sidespin-right', 'flat'];

export function getAITargetX(ball: BallState, difficulty: Difficulty): number {
  const cfg = DIFFICULTY_CONFIG[difficulty];

  if (ball.lastHitBy === 'opponent' || !ball.isInPlay) {
    return 0;
  }

  const landing = predictLanding(ball, -TABLE.length / 2 + 1);
  const error = (1 - cfg.accuracy) * (Math.random() - 0.5) * 2;

  return landing.x + error;
}

export function getAITrackingSpeed(difficulty: Difficulty): number {
  return DIFFICULTY_CONFIG[difficulty].trackingSpeed;
}

export function getAISpin(difficulty: Difficulty): SpinType {
  const cfg = DIFFICULTY_CONFIG[difficulty];

  if (Math.random() > cfg.spinChoiceQuality) {
    return 'flat';
  }

  const weights = {
    topspin: 0.35,
    backspin: 0.25,
    'sidespin-left': 0.15,
    'sidespin-right': 0.15,
    flat: 0.1,
  };

  const r = Math.random();
  let cumulative = 0;
  for (const spin of SPIN_OPTIONS) {
    cumulative += weights[spin];
    if (r <= cumulative) return spin;
  }

  return 'topspin';
}

export function shouldAIHit(ball: BallState, difficulty: Difficulty): boolean {
  const cfg = DIFFICULTY_CONFIG[difficulty];
  const hitZoneZ = -TABLE.length / 2 + 1.5;

  if (ball.position.z > hitZoneZ) return false;
  if (ball.position.z < -TABLE.length / 2 - 0.5) return false;
  if (ball.lastHitBy === 'opponent') return false;

  if (ball.position.z <= hitZoneZ && ball.velocity.z < 0) {
    return Math.random() < cfg.accuracy;
  }

  return false;
}

export function getReactionDelay(difficulty: Difficulty): number {
  return DIFFICULTY_CONFIG[difficulty].reactionDelay;
}
