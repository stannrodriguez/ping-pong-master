/**
 * Building spin vectors, and reading them back.
 *
 * The engine only ever deals in an angular velocity vector ω (rad/s). But "ω = (-370, 0, 0)"
 * is not a thought anyone has at a table — players think in topspin/backspin/sidespin
 * *relative to where the ball is going*. This module is the translation layer, and it
 * keeps every sign convention in one auditable place.
 */

import { rpsToRadPerSec, radPerSecToRps, BALL } from './constants';
import {
  add,
  cross,
  dot,
  horizontal,
  length,
  normalize,
  scale,
  UP,
  v3,
  type Vec3,
} from './vec3';

/**
 * Spin expressed the way a player thinks about it, in rev/s, relative to the
 * horizontal direction of travel.
 */
export interface SpinComponents {
  /** rev/s — positive is topspin (ball rolls forward), negative is backspin. */
  topspin: number;
  /**
   * rev/s — spin about the vertical axis. Positive curves the ball to its own left
   * (toward -x for a ball travelling toward -z).
   */
  sidespin: number;
  /**
   * rev/s — "corkscrew"/drill spin about the direction of travel. Produces no Magnus
   * force at all, but still changes what happens at the bounce.
   */
  corkscrew: number;
}

export const NO_SPIN: SpinComponents = Object.freeze({
  topspin: 0,
  sidespin: 0,
  corkscrew: 0,
});

/**
 * The orthonormal basis a shot's spin is described in: forward (horizontal direction of
 * travel), up, and the topspin axis.
 */
export function spinBasis(velocity: Vec3) {
  const flat = horizontal(velocity);
  // A purely vertical shot has no meaningful "forward"; fall back to -z (down the table).
  const forward = length(flat) === 0 ? v3(0, 0, -1) : normalize(flat);
  // Topspin means the top of the ball moves along `forward`. The point at +r·ŷ has
  // velocity ω × rŷ, so we need ω × ŷ ∝ forward, which is satisfied by ω ∝ ŷ × forward.
  const topspinAxis = cross(UP, forward);
  return { forward, up: { ...UP } as Vec3, topspinAxis };
}

/** Build an angular velocity vector (rad/s) from player-facing components in rev/s. */
export function spinFromComponents(velocity: Vec3, components: SpinComponents): Vec3 {
  const { forward, up, topspinAxis } = spinBasis(velocity);
  return add(
    add(
      scale(topspinAxis, rpsToRadPerSec(components.topspin)),
      scale(up, rpsToRadPerSec(components.sidespin)),
    ),
    scale(forward, rpsToRadPerSec(components.corkscrew)),
  );
}

/** Read an angular velocity vector back as player-facing components in rev/s. */
export function componentsFromSpin(velocity: Vec3, spin: Vec3): SpinComponents {
  const { forward, up, topspinAxis } = spinBasis(velocity);
  return {
    topspin: radPerSecToRps(dot(spin, topspinAxis)),
    sidespin: radPerSecToRps(dot(spin, up)),
    corkscrew: radPerSecToRps(dot(spin, forward)),
  };
}

/**
 * Build spin from a total rate plus an axis "rake" angle, which is how the Trajectory
 * Lab exposes it: 0° is pure topspin, 90° is pure sidespin, 180° is pure backspin.
 * One continuous control that sweeps the whole family, rather than five discrete buttons.
 */
export function spinFromRake(velocity: Vec3, rateRps: number, rakeDegrees: number): Vec3 {
  const rake = (rakeDegrees * Math.PI) / 180;
  return spinFromComponents(velocity, {
    topspin: rateRps * Math.cos(rake),
    sidespin: rateRps * Math.sin(rake),
    corkscrew: 0,
  });
}

/** rev/s — total spin rate regardless of axis. */
export function spinRateRps(spin: Vec3): number {
  return radPerSecToRps(length(spin));
}

/** m/s — how fast the ball's surface moves relative to its centre. */
export function surfaceSpeed(spin: Vec3): number {
  return BALL.radius * length(spin);
}

/**
 * A short human label for a spin vector, used in legends and readouts. Deliberately
 * derived from the vector rather than carried alongside it, so a label can never
 * disagree with the physics being simulated.
 */
export function describeSpin(velocity: Vec3, spin: Vec3): string {
  const rate = spinRateRps(spin);
  // Below 3 rev/s, the difference is not a useful cue for a player. Treat that
  // tiny residual as near no-spin instead of contradicting labels such as
  // "No-spin float" with a readout of "Light topspin".
  if (rate < 0.05) return 'No spin';
  if (rate < 3) return 'Near no spin';

  const c = componentsFromSpin(velocity, spin);
  const parts: string[] = [];
  // Only name axes that carry a meaningful share of the total.
  const threshold = rate * 0.25;
  if (Math.abs(c.topspin) > threshold) parts.push(c.topspin > 0 ? 'topspin' : 'backspin');
  if (Math.abs(c.sidespin) > threshold) {
    parts.push(c.sidespin > 0 ? 'left sidespin' : 'right sidespin');
  }
  if (Math.abs(c.corkscrew) > threshold) parts.push('corkscrew');
  if (parts.length === 0) return `${Math.round(rate)} rev/s`;

  const heaviness = rate > 90 ? 'Heavy ' : rate > 40 ? '' : 'Light ';
  return `${heaviness}${parts.join(' + ')}`.replace(/^(.)/, (m) => m.toUpperCase());
}
