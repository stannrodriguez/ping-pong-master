/**
 * Aerodynamics: drag and the Magnus force.
 *
 * There is exactly one Magnus term. Topspin dipping, backspin floating and sidespin
 * curving are not three cases — they are one force, `½ρA·C_L·|v|²·normalise(ω × v)`,
 * evaluated with three different spin axes. Nothing in this file branches on a
 * "spin type", and nothing should.
 */

import { AERO, AIR, BALL, GRAVITY } from './constants';
import {
  cross,
  dot,
  length,
  normalize,
  rejectFrom,
  scale,
  sub,
  v3,
  type Vec3,
  ZERO,
} from './vec3';

/** ½ρA — the factor common to both aerodynamic forces. */
const HALF_RHO_A = 0.5 * AIR.density * BALL.area;

/**
 * Spin ratio S = r·|ω⊥| / |v|.
 *
 * Only the component of ω perpendicular to the velocity produces a Magnus force —
 * a ball spinning about its own direction of travel (a "corkscrew" or "drill" spin)
 * generates no lateral force at all, which is exactly why a pure drill serve flies
 * straight but still misbehaves off the bounce.
 *
 * S is the single most important number in the app: it says that spin only matters
 * relative to speed. Returns 0 for a stationary ball.
 */
export function spinRatio(velocity: Vec3, spin: Vec3): number {
  const speed = length(velocity);
  if (speed === 0) return 0;
  const perpendicularSpin = rejectFrom(spin, normalize(velocity));
  return (BALL.radius * length(perpendicularSpin)) / speed;
}

/** Lift coefficient — saturating fit, C_L(S) = 0.45·S/(S + 0.5). */
export function liftCoefficient(spinRatioValue: number): number {
  const s = Math.abs(spinRatioValue);
  return (AERO.liftMax * s) / (s + AERO.liftHalfSaturation);
}

/** Drag coefficient — 0.40 baseline, rising modestly with spin. */
export function dragCoefficient(spinRatioValue: number): number {
  const s = Math.abs(spinRatioValue);
  return AERO.dragBase + (AERO.dragSpinGain * s) / (s + AERO.liftHalfSaturation);
}

/** N — drag, always directly opposing the velocity. */
export function dragForce(velocity: Vec3, spin: Vec3): Vec3 {
  const speed = length(velocity);
  if (speed === 0) return { ...ZERO };
  const cd = dragCoefficient(spinRatio(velocity, spin));
  // -½ρA·C_D·|v|·v  ==  -½ρA·C_D·|v|²·v̂
  return scale(velocity, -HALF_RHO_A * cd * speed);
}

/**
 * N — the Magnus force, ½ρA·C_L·|v|²·normalise(ω × v).
 *
 * Sign check worth keeping: a ball travelling in -z with topspin has ω = -|ω|·x̂, so
 * ω × v = (-|ω|x̂) × (-|v|ẑ) = -|ω||v|·ŷ — downward. Topspin dips. The same expression
 * with the spin axis flipped floats, and with a vertical axis curves.
 */
export function magnusForce(velocity: Vec3, spin: Vec3): Vec3 {
  const speed = length(velocity);
  if (speed === 0) return { ...ZERO };
  const direction = cross(spin, velocity);
  const directionLength = length(direction);
  // ω parallel to v (pure drill spin) → no Magnus force.
  if (directionLength === 0) return { ...ZERO };
  const cl = liftCoefficient(spinRatio(velocity, spin));
  const magnitude = HALF_RHO_A * cl * speed * speed;
  return scale(direction, magnitude / directionLength);
}

/** N — weight, constant and downward. */
export function gravityForce(): Vec3 {
  return v3(0, -BALL.mass * GRAVITY, 0);
}

/** rad/s² — aerodynamic spin decay, modelled as a first-order lag. */
export function spinDecay(spin: Vec3): Vec3 {
  return scale(spin, -1 / AERO.spinDecayTime);
}

export interface ForceBreakdown {
  gravity: Vec3;
  drag: Vec3;
  magnus: Vec3;
  total: Vec3;
  /** Dimensionless S = r|ω⊥|/|v|. */
  spinRatio: number;
  liftCoefficient: number;
  dragCoefficient: number;
}

/**
 * Every force acting on the ball, itemised. The UI draws these directly — the force
 * diagram in the app is this function's output, not a separate hand-drawn illustration.
 */
export function forceBreakdown(velocity: Vec3, spin: Vec3): ForceBreakdown {
  const s = spinRatio(velocity, spin);
  const gravity = gravityForce();
  const drag = dragForce(velocity, spin);
  const magnus = magnusForce(velocity, spin);
  return {
    gravity,
    drag,
    magnus,
    total: {
      x: gravity.x + drag.x + magnus.x,
      y: gravity.y + drag.y + magnus.y,
      z: gravity.z + drag.z + magnus.z,
    },
    spinRatio: s,
    liftCoefficient: liftCoefficient(s),
    dragCoefficient: dragCoefficient(s),
  };
}

/** m/s² — total acceleration of the ball in flight. */
export function acceleration(velocity: Vec3, spin: Vec3): Vec3 {
  const drag = dragForce(velocity, spin);
  const magnus = magnusForce(velocity, spin);
  return {
    x: (drag.x + magnus.x) / BALL.mass,
    y: (drag.y + magnus.y) / BALL.mass - GRAVITY,
    z: (drag.z + magnus.z) / BALL.mass,
  };
}

/**
 * Express a force in multiples of the ball's own weight. Newtons on a 2.7 g ball are
 * uselessly small numbers to read; "2.4 g" is immediately meaningful.
 */
export function inGravities(force: Vec3): number {
  return length(force) / (BALL.mass * GRAVITY);
}

/**
 * Decompose the Magnus force into the part that changes the ball's speed (along v)
 * and the part that curves it (perpendicular to v).
 *
 * Useful sanity result the UI can state outright: the along-v component is always
 * zero, because ω × v is perpendicular to v by construction. Magnus *only* bends the
 * path — it never speeds the ball up or slows it down. Only drag does that.
 */
export function magnusDecomposition(velocity: Vec3, spin: Vec3) {
  const magnus = magnusForce(velocity, spin);
  const vHat = normalize(velocity);
  const along = dot(magnus, vHat);
  const perpendicular = sub(magnus, scale(vHat, along));
  return { magnus, along, perpendicular, perpendicularMagnitude: length(perpendicular) };
}
