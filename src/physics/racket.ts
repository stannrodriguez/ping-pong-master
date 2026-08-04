/**
 * Ball–racket contact: the table bounce generalised to a tilted, moving plane.
 *
 * Same mechanism as `bounce.ts`, applied in the racket's rest frame. Work in the
 * ball's velocity *relative to the blade*, split it into a normal part (restitution)
 * and a tangential part (one Coulomb friction impulse acting on the contact-point
 * velocity), and transform back. Nothing branches on a spin type or a stroke name —
 * "open the racket against backspin" has to *fall out* of the same grip/slip rule
 * that produces the topspin kick off the table, or it does not belong in the app.
 *
 * Two rubber-specific constants differ from the table:
 *
 *  - μ is much higher. Inverted rubber is designed to grip; published sliding
 *    measurements for ball on fresh inverted rubber cluster around 0.5–0.8, versus
 *    0.2–0.3 for the coated table top. Grip is therefore the common regime at the
 *    racket, which is exactly why incoming spin dictates so much of what the racket
 *    can do — the rubber almost always bites.
 *  - e is lower than the table's 0.90. A sandwich rubber on a hand-held blade
 *    absorbs energy in the sponge; rebound tests off a firmly held racket measure
 *    0.6–0.85 depending on the rubber. We use the middle of that range.
 */

import { BALL, BALL_INERTIA } from './constants';
import { ROLL_IMPULSE_FACTOR, type BounceRegime } from './bounce';
import { add, cross, dot, length, normalize, scale, sub, v3, type Vec3 } from './vec3';

export const RUBBER = {
  /** Coefficient of restitution, ball on a firmly held sandwich rubber. */
  restitution: 0.75,
  /** Coulomb friction, ball on inverted rubber — far grippier than the table. */
  friction: 0.6,
} as const;

/** The blade at the instant of contact: where it faces and how it is moving. */
export interface RacketPlane {
  /** Unit vector out of the rubber, toward the incoming ball. */
  normal: Vec3;
  /** m/s — velocity of the blade. The stroke. */
  velocity: Vec3;
}

export interface RacketContactResult {
  velocity: Vec3;
  spin: Vec3;
  regime: BounceRegime;
  /** m/s — how fast the ball closed on the blade along the normal. */
  approachSpeed: number;
  /** m/s — slip velocity of the ball's contact patch across the rubber, before impact. */
  contactVelocity: Vec3;
  /** N·s */
  normalImpulse: number;
  frictionImpulse: Vec3;
  frictionImpulseAvailable: number;
  frictionImpulseRequired: number;
}

/**
 * Resolve one ball–racket contact.
 *
 * The ball must be approaching the blade (relative normal velocity into the rubber);
 * if it is not, the contact does nothing and the state passes through unchanged.
 */
export function contactWithRacket(
  ball: { velocity: Vec3; spin: Vec3 },
  racket: RacketPlane,
): RacketContactResult {
  const n = normalize(racket.normal);

  // Everything happens in the blade's rest frame.
  const w = sub(ball.velocity, racket.velocity);
  const wNormal = dot(w, n);
  const approachSpeed = -wNormal;

  if (approachSpeed <= 0) {
    // The blade is not closing on the ball — a whiff, not a hit.
    return {
      velocity: ball.velocity,
      spin: ball.spin,
      regime: 'grip',
      approachSpeed,
      contactVelocity: v3(),
      normalImpulse: 0,
      frictionImpulse: v3(),
      frictionImpulseAvailable: 0,
      frictionImpulseRequired: 0,
    };
  }

  const normalImpulse = BALL.mass * (1 + RUBBER.restitution) * approachSpeed;
  const frictionImpulseAvailable = RUBBER.friction * normalImpulse;

  // Contact point sits at -r·n̂ from the centre. Its velocity across the rubber is the
  // tangential relative velocity plus the surface velocity from the spin — the exact
  // analogue of u = v + ω × (-r·ŷ) at the table, with ŷ replaced by the blade normal.
  const wTangential = sub(w, scale(n, wNormal));
  const u = add(wTangential, cross(ball.spin, scale(n, -BALL.radius)));
  const slipSpeed = length(u);
  const frictionImpulseRequired = ROLL_IMPULSE_FACTOR * BALL.mass * slipSpeed;

  let frictionImpulse: Vec3;
  let regime: BounceRegime;
  if (slipSpeed === 0) {
    frictionImpulse = v3();
    regime = 'grip';
  } else if (frictionImpulseRequired <= frictionImpulseAvailable) {
    frictionImpulse = scale(u, -ROLL_IMPULSE_FACTOR * BALL.mass);
    regime = 'grip';
  } else {
    frictionImpulse = scale(normalize(u), -frictionImpulseAvailable);
    regime = 'slip';
  }

  // Back to the world frame: restitution along the normal, friction in the plane.
  const outRelative = add(
    add(wTangential, scale(frictionImpulse, 1 / BALL.mass)),
    scale(n, RUBBER.restitution * approachSpeed),
  );
  const velocity = add(racket.velocity, outRelative);

  // Δω = I⁻¹·(r_contact × J_t), with r_contact = -r·n̂.
  const torqueImpulse = cross(scale(n, -BALL.radius), frictionImpulse);
  const spin = add(ball.spin, scale(torqueImpulse, 1 / BALL_INERTIA));

  return {
    velocity,
    spin,
    regime,
    approachSpeed,
    contactVelocity: u,
    normalImpulse,
    frictionImpulse,
    frictionImpulseAvailable,
    frictionImpulseRequired,
  };
}
