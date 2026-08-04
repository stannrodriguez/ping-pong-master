/**
 * Serve generation for the Return Trainer.
 *
 * Serves are generated from randomised parameters inside realistic family ranges and
 * validated by running the simulator — a candidate that would be an illegal serve
 * (wrong half first, net, long) is discarded and redrawn. Like the Predict page,
 * there is no answer key anywhere: what a serve "is" is whatever the engine does
 * with it, and the trainer's grading later runs the same engine.
 *
 * Frame: the opponent serves from the -z end toward the receiver at +z. All of the
 * receiver-facing geometry ("left", "right") is therefore in the +x/-x sense seen by
 * a player standing at +z looking down the table, which matches the camera.
 */

import {
  launchFrom,
  sampleAt,
  simulate,
  spinFromComponents,
  v3,
  type BallState,
  type LaunchSpec,
  type SpinComponents,
  type Trajectory,
} from '../physics';
import { gradeAllChoices } from './strokes';

export type ServeFamilyId = 'backspin' | 'float' | 'topspin' | 'side-left' | 'side-right';

export interface ServeFamily {
  id: ServeFamilyId;
  name: string;
  /** The response the family is drilling, in one line. Shown only after the reveal. */
  read: string;
}

export const SERVE_FAMILIES: ServeFamily[] = [
  {
    id: 'backspin',
    name: 'Heavy backspin',
    read: 'Float in the air, dies off the bounce. Open the racket and lift, or it goes into the net.',
  },
  {
    id: 'float',
    name: 'No-spin float',
    read: 'Looks like backspin, is not. A flat drive punishes it; a big open push pops it up.',
  },
  {
    id: 'topspin',
    name: 'Fast topspin',
    read: 'Long, quick, kicks forward off the bounce. Close the face and block it back — an open push balloons it.',
  },
  {
    id: 'side-left',
    name: 'Sidespin, kicking left',
    read: 'Curves and kicks toward your left, then throws your return further left off the rubber. Hit through it and aim right — a slow push gets thrown wide.',
  },
  {
    id: 'side-right',
    name: 'Sidespin, kicking right',
    read: 'The mirror serve. It walks your return to the right — hit through it and aim left to compensate.',
  },
];

export const FAMILIES_BY_ID: Record<ServeFamilyId, ServeFamily> = Object.fromEntries(
  SERVE_FAMILIES.map((f) => [f.id, f]),
) as Record<ServeFamilyId, ServeFamily>;

/** One serve the trainer can play: the launch, its simulation, and the moment to hit. */
export interface ServeRep {
  family: ServeFamily;
  launch: LaunchSpec;
  trajectory: Trajectory;
  /** s — when the receiver takes the ball (near the top of its bounce). */
  contactT: number;
  /** Ball state at that moment — position, velocity and remaining spin. */
  contact: BallState;
  /** s — when the ball bounces on the receiver's half; the read must be done by then. */
  receiverBounceT: number;
}

interface ServeParams {
  x: number;
  y: number;
  z: number;
  speed: number;
  elevation: number;
  heading: number;
  spin: SpinComponents;
}

const between = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo);

/**
 * Draw serve parameters for a family. Mid-range values are deliberately usable with
 * `rng = () => 0.5` to get one deterministic, representative serve per family — the
 * tests grade the trainer's advice against exactly those.
 */
function drawParams(family: ServeFamilyId, rng: () => number): ServeParams {
  const base = {
    x: between(rng, -0.35, 0.35),
    y: between(rng, 0.27, 0.35),
    z: -between(rng, 1.3, 1.45),
    heading: between(rng, -6, 6),
  };
  // A serve's launch angle has to fall as its speed rises — a slow serve is lofted
  // slightly, a fast one is hit down — or the first bounce misses the server's half.
  // The slope comes from sweeping the simulator, not from a rulebook.
  const elevationFor = (speed: number, lo: number, hi: number, anchor: number) =>
    between(rng, lo, hi) - (speed - anchor) * 5;
  switch (family) {
    case 'backspin': {
      const speed = between(rng, 3.3, 4.2);
      return {
        ...base,
        speed,
        elevation: elevationFor(speed, -3, 8, 3.7),
        spin: { topspin: -between(rng, 55, 80), sidespin: between(rng, -8, 8), corkscrew: 0 },
      };
    }
    case 'float': {
      const speed = between(rng, 3.3, 4.2);
      return {
        ...base,
        speed,
        elevation: elevationFor(speed, -4, 7, 3.7),
        spin: { topspin: between(rng, -4, 6), sidespin: 0, corkscrew: 0 },
      };
    }
    case 'topspin': {
      const speed = between(rng, 5.5, 7.0);
      return {
        ...base,
        speed,
        elevation: elevationFor(speed, -8, -2, 5.5),
        spin: { topspin: between(rng, 30, 55), sidespin: 0, corkscrew: 0 },
      };
    }
    case 'side-left':
    case 'side-right': {
      // A pendulum-style serve: mostly sidespin, the axis raked a little toward the
      // travel direction (corkscrew), often with a touch of backspin underneath.
      const sign = family === 'side-left' ? 1 : -1;
      const speed = between(rng, 3.4, 4.4);
      return {
        ...base,
        speed,
        elevation: elevationFor(speed, -4, 7, 3.9),
        spin: {
          topspin: between(rng, -20, 5),
          sidespin: sign * between(rng, 40, 60),
          corkscrew: sign * between(rng, 15, 35),
        },
      };
    }
  }
}

function toLaunch(params: ServeParams): LaunchSpec {
  const base = launchFrom({
    position: v3(params.x, params.y, params.z),
    speed: params.speed,
    elevation: params.elevation,
    heading: params.heading,
    fromSide: -1,
  });
  return { ...base, spin: spinFromComponents(base.velocity, params.spin) };
}

/** m — where the receiver's strike zone begins; long serves are taken at this plane. */
const CONTACT_PLANE_Z = 2.0;
/** s — how long after the bounce the ball is taken, when it stays short of the plane. */
const CONTACT_DELAY = 0.3;

/**
 * Decide when the receiver hits the ball: at the contact plane if the serve carries
 * that deep, otherwise near the top of its bounce on the receiver's half — the
 * standard "take it at the peak" coaching default. Returns undefined if the serve
 * never gives the receiver a playable ball.
 */
function findContact(trajectory: Trajectory): { contactT: number; receiverBounceT: number } | undefined {
  const bounce = trajectory.events.find((e) => e.kind === 'bounce' && e.position.z > 0);
  if (!bounce) return undefined;
  const following = trajectory.events.find((e) => e.t > bounce.t + 1e-9);
  const nextEventT = following ? following.t : trajectory.duration;

  // First crossing of the contact plane after the bounce, if any.
  let planeT: number | undefined;
  for (const s of trajectory.samples) {
    if (s.t > bounce.t && s.position.z >= CONTACT_PLANE_Z) {
      planeT = s.t;
      break;
    }
  }

  // Otherwise: a fixed beat after the bounce, but never past the next event —
  // a short serve about to bounce again is taken at the apex between the two.
  const apexT = bounce.t + Math.min(CONTACT_DELAY, (nextEventT - bounce.t) * 0.55);
  const contactT = Math.min(planeT ?? Infinity, apexT);
  if (!(contactT > bounce.t + 0.02)) return undefined;
  return { contactT, receiverBounceT: bounce.t };
}

function buildRep(family: ServeFamily, params: ServeParams): ServeRep | undefined {
  const launch = toLaunch(params);
  const trajectory = simulate(launch, { maxBounces: 4, maxTime: 3 });

  // Serve legality: first bounce on the server's own half, then a legal landing.
  const firstBounce = trajectory.events.find((e) => e.kind === 'bounce');
  if (!firstBounce || firstBounce.position.z >= 0) return undefined;
  if (!trajectory.isLegal) return undefined;

  const contact = findContact(trajectory);
  if (!contact) return undefined;

  const contactState = sampleAt(trajectory, contact.contactT);
  // The ball has to be somewhere a person could actually swing at.
  if (contactState.position.y < -0.15 || contactState.position.y > 0.75) return undefined;

  // Fairness: at least one of the nine choices must land. The family ranges allow
  // a few draws (the heaviest sidespins, mostly) that none of the trainer's fixed
  // strokes can return; an unanswerable rep teaches nothing, so it is redrawn.
  const anyReturn = gradeAllChoices(contactState)
    .flat()
    .some((result) => result.outcome === 'landed');
  if (!anyReturn) return undefined;

  return {
    family,
    launch,
    trajectory,
    contactT: contact.contactT,
    contact: contactState,
    receiverBounceT: contact.receiverBounceT,
  };
}

/**
 * Generate a playable serve of the given family, redrawing until the simulator
 * accepts it. Falls back to the deterministic mid-range serve, which is verified
 * playable by the tests.
 */
export function generateServe(family: ServeFamilyId, rng: () => number = Math.random): ServeRep {
  const meta = FAMILIES_BY_ID[family];
  for (let attempt = 0; attempt < 40; attempt++) {
    const rep = buildRep(meta, drawParams(family, rng));
    if (rep) return rep;
  }
  return canonicalServe(family);
}

/** The deterministic mid-range serve for a family — what the tests grade against. */
export function canonicalServe(family: ServeFamilyId): ServeRep {
  const rep = buildRep(FAMILIES_BY_ID[family], drawParams(family, () => 0.5));
  if (!rep) {
    throw new Error(`Canonical ${family} serve is not playable — family ranges are broken`);
  }
  return rep;
}

/**
 * Pick the next serve family, weighted toward what the player has been misreading.
 * With no history it is uniform; every error roughly doubles that family's share
 * until it is answered correctly again.
 */
export function pickFamily(
  record: Partial<Record<ServeFamilyId, { right: number; total: number }>>,
  rng: () => number = Math.random,
): ServeFamilyId {
  const weights = SERVE_FAMILIES.map(({ id }) => {
    const r = record[id];
    if (!r || r.total === 0) return { id, weight: 1 };
    return { id, weight: 1 + (2 * (r.total - r.right)) / r.total };
  });
  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = rng() * total;
  for (const w of weights) {
    roll -= w.weight;
    if (roll <= 0) return w.id;
  }
  return weights[weights.length - 1].id;
}
