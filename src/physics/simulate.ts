/**
 * Trajectory integration.
 *
 * RK4 at fixed dt, with bisection onto the table plane and the net plane so contact
 * events land at the true crossing time instead of being smeared across a step. That
 * accuracy matters here: the bounce is resolved from the incoming velocity, so a bounce
 * detected half a step late is a bounce resolved with the wrong velocity, and the whole
 * point of the app is that the numbers on screen are checkable.
 */

import { acceleration, forceBreakdown, spinRatio, type ForceBreakdown } from './aero';
import { spinDecay } from './aero';
import { bounceOffTable, isOverTable, isWithinNetSpan, type BounceResult } from './bounce';
import { BALL, TABLE, TABLE_HALF_LENGTH } from './constants';
import { add, addScaled, clone, length, scale, v3, type Vec3 } from './vec3';

export interface BallState {
  /** s — time since launch */
  t: number;
  /** m — position of the ball's centre, origin at table centre on the surface */
  position: Vec3;
  /** m/s */
  velocity: Vec3;
  /** rad/s */
  spin: Vec3;
}

export type EventKind = 'bounce' | 'net' | 'floor' | 'out' | 'end';

export interface SimEvent {
  kind: EventKind;
  t: number;
  position: Vec3;
  /** Present for `bounce` events. */
  bounce?: BounceResult;
}

export interface Trajectory {
  /** Uniformly-ish sampled states, in time order, including exact event states. */
  samples: BallState[];
  events: SimEvent[];
  /** m — highest point reached by the ball's centre above the table surface. */
  apex: number;
  /** s — total simulated time. */
  duration: number;
  /**
   * m — height of the ball's centre above the net line as it crossed z = 0.
   * Negative means it hit the net. Undefined if it never crossed.
   */
  netClearance?: number;
  /** m — where the ball first landed on the far half, if it did. */
  landing?: Vec3;
  /**
   * m — where the ball first descended through the table's height plane, whether or
   * not that point was on the table. This is the honest "where would it come down"
   * measure, and it is what comparisons against a no-spin baseline use: a shot that
   * flies long still has a touchdown point, it just isn't a legal landing.
   */
  touchdown?: Vec3;
  /** True if the ball crossed the net and landed on the far half of the table. */
  isLegal: boolean;
}

export interface LaunchSpec {
  position: Vec3;
  velocity: Vec3;
  spin: Vec3;
}

export interface SimOptions {
  /** s — integration step. */
  dt?: number;
  /** s — hard stop. */
  maxTime?: number;
  /** Stop after this many table bounces. Default 2 (serve-like: near half, far half). */
  maxBounces?: number;
  /** Stop as soon as the ball touches the table on the far side. */
  stopAtFirstFarBounce?: boolean;
}

const DEFAULTS = {
  dt: 1 / 480,
  maxTime: 4,
  maxBounces: 3,
  stopAtFirstFarBounce: false,
};

/** d/dt of (position, velocity, spin) — the ODE the integrator advances. */
function derivative(state: { position: Vec3; velocity: Vec3; spin: Vec3 }) {
  return {
    position: state.velocity,
    velocity: acceleration(state.velocity, state.spin),
    spin: spinDecay(state.spin),
  };
}

function advance(
  state: { position: Vec3; velocity: Vec3; spin: Vec3 },
  d: ReturnType<typeof derivative>,
  h: number,
) {
  return {
    position: addScaled(state.position, d.position, h),
    velocity: addScaled(state.velocity, d.velocity, h),
    spin: addScaled(state.spin, d.spin, h),
  };
}

/** One classical RK4 step. */
export function step(state: BallState, dt: number): BallState {
  const k1 = derivative(state);
  const k2 = derivative(advance(state, k1, dt / 2));
  const k3 = derivative(advance(state, k2, dt / 2));
  const k4 = derivative(advance(state, k3, dt));

  const combine = (a: Vec3, b: Vec3, c: Vec3, d: Vec3): Vec3 => ({
    x: ((a.x + 2 * b.x + 2 * c.x + d.x) * dt) / 6,
    y: ((a.y + 2 * b.y + 2 * c.y + d.y) * dt) / 6,
    z: ((a.z + 2 * b.z + 2 * c.z + d.z) * dt) / 6,
  });

  return {
    t: state.t + dt,
    position: add(state.position, combine(k1.position, k2.position, k3.position, k4.position)),
    velocity: add(state.velocity, combine(k1.velocity, k2.velocity, k3.velocity, k4.velocity)),
    spin: add(state.spin, combine(k1.spin, k2.spin, k3.spin, k4.spin)),
  };
}

/**
 * Bisect within one step to find the sub-step time at which `f` changes sign, and
 * return the state there. `f` is negative before the event and positive after.
 */
function refine(from: BallState, dt: number, f: (s: BallState) => number): BallState {
  let lo = 0;
  let hi = dt;
  let best = step(from, dt);
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const candidate = step(from, mid);
    if (f(candidate) >= 0) {
      hi = mid;
      best = candidate;
    } else {
      lo = mid;
    }
  }
  return best;
}

/**
 * Integrate a shot from launch until it lands, hits the net, or times out.
 *
 * Sampling: states are recorded every ~1/240 s regardless of the integration step, plus
 * an exact state on each side of every contact event, so the UI can draw a continuous
 * path and still show the discontinuity at the bounce.
 */
export function simulate(launch: LaunchSpec, options: SimOptions = {}): Trajectory {
  const { dt, maxTime, maxBounces, stopAtFirstFarBounce } = { ...DEFAULTS, ...options };
  const sampleInterval = 1 / 240;

  let state: BallState = {
    t: 0,
    position: clone(launch.position),
    velocity: clone(launch.velocity),
    spin: clone(launch.spin),
  };

  const samples: BallState[] = [state];
  const events: SimEvent[] = [];
  let apex = state.position.y;
  let nextSampleAt = sampleInterval;
  let bounces = 0;
  let netClearance: number | undefined;
  let landing: Vec3 | undefined;
  let touchdown: Vec3 | undefined;
  let crossedNet = false;
  let landedFar = false;
  const startSide = Math.sign(state.position.z) || 1;

  const record = (s: BallState) => {
    samples.push(s);
    if (s.position.y > apex) apex = s.position.y;
  };

  const finish = (kind: EventKind, s: BallState): Trajectory => {
    events.push({ kind, t: s.t, position: clone(s.position) });
    return {
      samples,
      events,
      apex: apex - BALL.radius,
      duration: s.t,
      netClearance,
      landing,
      touchdown,
      isLegal: crossedNet && landedFar,
    };
  };

  while (state.t < maxTime) {
    const next = step(state, dt);

    // --- Net plane, z = 0 -------------------------------------------------------
    const netPlaneCrossed =
      Math.sign(state.position.z) !== Math.sign(next.position.z) && !crossedNet;
    if (netPlaneCrossed) {
      const at = refine(state, dt, (s) => -startSide * s.position.z);
      const heightAboveNet = at.position.y - TABLE.netHeight;
      netClearance = heightAboveNet - BALL.radius;

      if (at.position.y - BALL.radius < TABLE.netHeight && isWithinNetSpan(at.position.x)) {
        record(at);
        events.push({ kind: 'net', t: at.t, position: clone(at.position) });
        return finish('end', at);
      }
      crossedNet = true;
      record(at);
      state = at;
      continue;
    }

    // --- Table plane -------------------------------------------------------------
    const surface = BALL.radius;
    if (next.position.y <= surface && state.position.y > surface) {
      const at = refine(state, dt, (s) => surface - s.position.y);
      if (!touchdown) touchdown = clone(at.position);

      if (isOverTable(at.position)) {
        record(at);
        const result = bounceOffTable({ velocity: at.velocity, spin: at.spin });
        bounces += 1;
        events.push({
          kind: 'bounce',
          t: at.t,
          position: clone(at.position),
          bounce: result,
        });

        const onFarSide = Math.sign(at.position.z) !== startSide;
        if (crossedNet && onFarSide && !landedFar) {
          landedFar = true;
          landing = clone(at.position);
        }

        state = {
          t: at.t,
          position: { ...at.position, y: surface },
          velocity: result.velocity,
          spin: result.spin,
        };
        record(state);

        if (bounces >= maxBounces || (stopAtFirstFarBounce && landedFar)) {
          return finish('end', state);
        }
        continue;
      }

      // Missed the table — let it keep falling to the floor.
      record(at);
      state = at;
      continue;
    }

    // --- Terminal conditions -----------------------------------------------------
    if (next.position.y <= -TABLE.height + BALL.radius) {
      const at = refine(state, dt, (s) => -TABLE.height + BALL.radius - s.position.y);
      record(at);
      return finish('floor', at);
    }
    if (Math.abs(next.position.z) > TABLE_HALF_LENGTH + 2 || Math.abs(next.position.x) > 3) {
      record(next);
      return finish('out', next);
    }

    state = next;
    if (state.t >= nextSampleAt) {
      record(state);
      nextSampleAt += sampleInterval;
    }
  }

  return finish('end', state);
}

/** Linear interpolation into a trajectory at time `t`, for scrubbing. */
export function sampleAt(trajectory: Trajectory, t: number): BallState {
  const { samples } = trajectory;
  if (samples.length === 0) {
    return { t: 0, position: v3(), velocity: v3(), spin: v3() };
  }
  if (t <= samples[0].t) return samples[0];
  const last = samples[samples.length - 1];
  if (t >= last.t) return last;

  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= t) lo = mid;
    else hi = mid;
  }

  const a = samples[lo];
  const b = samples[hi];
  const span = b.t - a.t;
  // Contact events produce two samples at the same instant; snap to the post-event one.
  if (span <= 1e-9) return b;
  const k = (t - a.t) / span;

  const mix = (p: Vec3, q: Vec3): Vec3 => ({
    x: p.x + (q.x - p.x) * k,
    y: p.y + (q.y - p.y) * k,
    z: p.z + (q.z - p.z) * k,
  });

  return {
    t,
    position: mix(a.position, b.position),
    velocity: mix(a.velocity, b.velocity),
    spin: mix(a.spin, b.spin),
  };
}

/** The force diagram for a given moment of a trajectory. */
export function forcesAt(state: BallState): ForceBreakdown {
  return forceBreakdown(state.velocity, state.spin);
}

/**
 * The same shot with the spin removed. Every visualization draws this alongside the
 * real path — the gap between them is the Magnus effect made visible, and without it
 * a single curve tells a learner nothing.
 */
export function withoutSpin(launch: LaunchSpec): LaunchSpec {
  return { ...launch, spin: v3() };
}

export interface TrajectoryMetrics {
  apex: number;
  duration: number;
  netClearance?: number;
  landing?: Vec3;
  touchdown?: Vec3;
  isLegal: boolean;
  /** m/s — speed at launch. */
  launchSpeed: number;
  /** Dimensionless spin ratio at launch. */
  launchSpinRatio: number;
  /** m — how far the landing point moved compared with the same shot with no spin. */
  landingShift?: { alongTable: number; acrossTable: number; total: number };
}

/** Headline numbers for a trajectory, measured against its own no-spin baseline. */
export function measure(launch: LaunchSpec, options?: SimOptions): TrajectoryMetrics {
  const spun = simulate(launch, options);
  const plain = simulate(withoutSpin(launch), options);

  // Compared at the touchdown point, not the landing point: a shot that flies long
  // still has a touchdown, and "this shot would have flown long without its spin" is
  // exactly the comparison worth showing.
  let landingShift: TrajectoryMetrics['landingShift'];
  if (spun.touchdown && plain.touchdown) {
    const alongTable = spun.touchdown.z - plain.touchdown.z;
    const acrossTable = spun.touchdown.x - plain.touchdown.x;
    landingShift = {
      alongTable,
      acrossTable,
      total: Math.hypot(alongTable, acrossTable),
    };
  }

  return {
    apex: spun.apex,
    duration: spun.duration,
    netClearance: spun.netClearance,
    landing: spun.landing,
    touchdown: spun.touchdown,
    isLegal: spun.isLegal,
    launchSpeed: length(launch.velocity),
    launchSpinRatio: spinRatio(launch.velocity, launch.spin),
    landingShift,
  };
}

/**
 * Build a launch from the quantities the UI actually exposes: speed, elevation and
 * heading angles, and a start position.
 */
export function launchFrom(opts: {
  position: Vec3;
  /** m/s */
  speed: number;
  /** degrees above horizontal */
  elevation: number;
  /** degrees of heading away from straight down the table (+ toward +x) */
  heading?: number;
  spin?: Vec3;
  /** Which end the ball is hit from; determines the down-table direction. */
  fromSide?: 1 | -1;
}): LaunchSpec {
  const { position, speed, elevation, heading = 0, spin = v3(), fromSide = 1 } = opts;
  const el = (elevation * Math.PI) / 180;
  const hd = (heading * Math.PI) / 180;
  const horizontalSpeed = speed * Math.cos(el);
  return {
    position: clone(position),
    velocity: v3(
      horizontalSpeed * Math.sin(hd),
      speed * Math.sin(el),
      -fromSide * horizontalSpeed * Math.cos(hd),
    ),
    spin: clone(spin),
  };
}

/** Scale a trajectory's spin without touching anything else — used for sweeps. */
export function withSpin(launch: LaunchSpec, spin: Vec3): LaunchSpec {
  return { ...launch, spin: clone(spin) };
}

/** Sweep a parameter and measure the outcome — the data behind the app's charts. */
export function sweep<T>(
  values: T[],
  build: (value: T) => LaunchSpec,
  options?: SimOptions,
): Array<{ value: T; metrics: TrajectoryMetrics; trajectory: Trajectory }> {
  return values.map((value) => {
    const launch = build(value);
    return {
      value,
      metrics: measure(launch, options),
      trajectory: simulate(launch, options),
    };
  });
}

export { scale as scaleVec, length as vecLength };
