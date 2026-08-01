/**
 * The bounce, modelled as a single friction impulse at the contact point.
 *
 * This file is the reason the rewrite exists. The old engine asserted outcomes
 * (`if (topspin) vz *= 1.15`), which meant it could show you that topspin kicks but
 * could never show you *why*. Here there is one rule, applied identically to every
 * spin, and every phenomenon a player knows falls out of it.
 *
 * The rule: friction acts on the velocity of the patch of ball actually touching the
 * table — the *contact-point velocity* — not on the velocity of the ball's centre.
 * Those two are different whenever the ball is spinning, and the difference is the
 * entire subject.
 *
 * Two consequences worth knowing before reading further, because both contradict
 * things table tennis players are commonly taught:
 *
 *  1. A *purely vertical* spin axis produces no lateral kick at all. The contact point
 *     lies on the axis, so the surface there isn't moving and friction has nothing to
 *     bite on — the ball just pivots. The sideways kick off a serve comes from the
 *     part of the axis raked toward the direction of travel, not from "sidespin".
 *  2. Once friction saturates, adding more backspin does not take more speed off the
 *     ball. The impulse is capped at μ·J_n whatever the slip speed. What extra backspin
 *     buys is a change in the outgoing *spin*, not the outgoing speed.
 *
 * Neither was designed in. Both fall out of the impulse model, and both are asserted
 * in `physics.test.ts` so the app's copy can't drift away from them.
 */

import { BALL, BALL_INERTIA, CONTACT, TABLE } from './constants';
import {
  add,
  cross,
  horizontal,
  length,
  normalize,
  scale,
  sub,
  v3,
  type Vec3,
} from './vec3';

/**
 * Δu = J_t·(1/m + r²/I) for a tangential impulse at the contact point, so the impulse
 * that exactly kills slip is J_roll = -u/(1/m + r²/I) = -0.4·m·u for a hollow sphere.
 */
const SLIP_RESPONSE = 1 / BALL.mass + (BALL.radius * BALL.radius) / BALL_INERTIA;
/** 1/(1 + 1/α) — the fraction of contact-point velocity a gripping bounce removes. */
export const ROLL_IMPULSE_FACTOR = 1 / (BALL.mass * SLIP_RESPONSE);

export type BounceRegime = 'grip' | 'slip';

export interface BounceInput {
  velocity: Vec3;
  spin: Vec3;
}

export interface BounceResult {
  velocity: Vec3;
  spin: Vec3;
  /** Whether the contact point was brought to rest ("grip") or slid throughout ("slip"). */
  regime: BounceRegime;
  /** m/s — velocity of the contact patch before impact. Friction acts on this. */
  contactVelocity: Vec3;
  /** m/s — velocity of the contact patch after impact. Zero for a gripping bounce. */
  contactVelocityAfter: Vec3;
  /** N·s — the normal impulse, m(1+e)|v_y|. */
  normalImpulse: number;
  /** N·s — the tangential (friction) impulse actually applied. */
  frictionImpulse: Vec3;
  /** N·s — the largest friction impulse the surface could have supplied, μ·J_n. */
  frictionImpulseAvailable: number;
  /** N·s — the friction impulse that gripping would have required, 0.4·m·|u|. */
  frictionImpulseRequired: number;
}

/**
 * m/s — velocity of the material point at the bottom of the ball: u = v + ω × (-r·ŷ).
 *
 * Worked example, ball travelling toward -z with topspin (ω = -|ω|x̂):
 *   ω × (-rŷ) = (-|ω|x̂) × (-rŷ) = |ω|r·(x̂ × ŷ) = |ω|r·ẑ
 *   u = (-|v|ẑ) + (|ω|r)ẑ = (|ω|r - |v|)·ẑ
 * so the contact patch is nearly still when rω ≈ v — a rolling ball — and friction has
 * almost nothing to act on. That is the whole explanation of the topspin kick.
 */
export function contactPointVelocity(velocity: Vec3, spin: Vec3): Vec3 {
  const leverArm = v3(0, -BALL.radius, 0);
  return horizontal(add(velocity, cross(spin, leverArm)));
}

/**
 * m/s — the largest contact-point speed the surface can still bring to rest at this
 * impact speed. Below this the ball grips; above it, it slides.
 *
 * |u| ≤ μ·(1+e)·|v_y| / ROLL_IMPULSE_FACTOR
 */
export function gripThreshold(verticalSpeed: number): number {
  return (
    (CONTACT.friction * (1 + CONTACT.restitution) * Math.abs(verticalSpeed)) /
    ROLL_IMPULSE_FACTOR
  );
}

/**
 * Resolve one ball–table contact.
 *
 * Normal direction: simple restitution, v_y' = -e·v_y.
 * Tangential direction: Coulomb friction acting on the contact-point velocity, with the
 * two regimes falling out of a single comparison of required vs available impulse.
 */
export function bounceOffTable(input: BounceInput): BounceResult {
  const { velocity, spin } = input;

  const impactSpeed = Math.abs(velocity.y);
  const normalImpulse = BALL.mass * (1 + CONTACT.restitution) * impactSpeed;
  const frictionImpulseAvailable = CONTACT.friction * normalImpulse;

  const u = contactPointVelocity(velocity, spin);
  const slipSpeed = length(u);
  const frictionImpulseRequired = ROLL_IMPULSE_FACTOR * BALL.mass * slipSpeed;

  let frictionImpulse: Vec3;
  let regime: BounceRegime;

  if (slipSpeed === 0) {
    // Already rolling — nothing for friction to do.
    frictionImpulse = v3();
    regime = 'grip';
  } else if (frictionImpulseRequired <= frictionImpulseAvailable) {
    // The surface can supply enough friction to stop the slip within the contact.
    frictionImpulse = scale(u, -ROLL_IMPULSE_FACTOR * BALL.mass);
    regime = 'grip';
  } else {
    // Friction saturates: the ball slides through the entire contact, and the impulse
    // is capped at μ·J_n, directed against the slip.
    frictionImpulse = scale(normalize(u), -frictionImpulseAvailable);
    regime = 'slip';
  }

  // Linear response: Δv = J/m, plus restitution on the normal axis.
  const outVelocity = v3(
    velocity.x + frictionImpulse.x / BALL.mass,
    Math.abs(velocity.y) * CONTACT.restitution,
    velocity.z + frictionImpulse.z / BALL.mass,
  );

  // Angular response: Δω = I⁻¹·(r_contact × J), with r_contact = -r·ŷ.
  const torqueImpulse = cross(v3(0, -BALL.radius, 0), frictionImpulse);
  const outSpin = add(spin, scale(torqueImpulse, 1 / BALL_INERTIA));

  return {
    velocity: outVelocity,
    spin: outSpin,
    regime,
    contactVelocity: u,
    contactVelocityAfter: contactPointVelocity(outVelocity, outSpin),
    normalImpulse,
    frictionImpulse,
    frictionImpulseAvailable,
    frictionImpulseRequired,
  };
}

/**
 * True if a point on the table plane is actually on the playing surface. The ball has
 * to come down inside these bounds for `bounceOffTable` to be the right thing to do.
 */
export function isOverTable(position: Vec3): boolean {
  return (
    Math.abs(position.x) <= TABLE.width / 2 && Math.abs(position.z) <= TABLE.length / 2
  );
}

/** True if the ball is within the net's extent laterally (it overhangs the table). */
export function isWithinNetSpan(x: number): boolean {
  return Math.abs(x) <= TABLE.width / 2 + TABLE.netOverhang;
}

/**
 * A compact, human-readable account of what friction just did — used verbatim by the
 * Bounce Lab so the explanation can never drift from the simulation.
 */
export function explainBounce(result: BounceResult): string {
  const speedBefore = length(horizontal(sub(result.velocity, result.frictionImpulse)));
  const speedAfter = length(horizontal(result.velocity));
  const delta = speedAfter - speedBefore;

  if (result.regime === 'grip') {
    return delta > 0.05
      ? 'Gripped. The contact patch was moving backwards under the ball, so friction pushed the ball forwards — it left the table faster than it arrived.'
      : 'Gripped. The contact patch was nearly at rest, so friction had little to act on and the ball kept almost all of its horizontal speed.';
  }
  return delta < -0.05
    ? 'Slid. The contact patch was racing forwards, so friction ran at its limit against the direction of travel and stripped horizontal speed off the ball.'
    : 'Slid. Friction saturated at μ·J_n and could not bring the contact patch to rest within the contact.';
}
