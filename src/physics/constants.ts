/**
 * Physical constants. Everything here is a real, checkable quantity in SI units —
 * that is the whole point of the rewrite. No tuning knobs disguised as physics.
 */

/** ITTF regulation ball (40 mm, 2.7 g). */
export const BALL = {
  /** m — 40 mm diameter */
  radius: 0.02,
  /** kg */
  mass: 0.0027,
  /** m² — frontal area πr² */
  area: Math.PI * 0.02 * 0.02,
  /**
   * Moment of inertia factor α in I = α·m·r².
   * A table tennis ball is a thin hollow shell, so α = 2/3 (not 2/5 as for a solid
   * sphere). This value directly sets how much spin the bounce can trade for speed.
   */
  inertiaFactor: 2 / 3,
} as const;

/** I = α·m·r², kg·m² */
export const BALL_INERTIA = BALL.inertiaFactor * BALL.mass * BALL.radius * BALL.radius;

/** ITTF regulation table. */
export const TABLE = {
  /** m — end to end */
  length: 2.74,
  /** m — side to side */
  width: 1.525,
  /** m — playing surface above the floor */
  height: 0.76,
  /** m — net height above the playing surface */
  netHeight: 0.1525,
  /** m — the net overhangs the table edge by 15.25 cm each side */
  netOverhang: 0.1525,
} as const;

export const TABLE_HALF_LENGTH = TABLE.length / 2;
export const TABLE_HALF_WIDTH = TABLE.width / 2;

export const AIR = {
  /** kg/m³ at ~20 °C, sea level */
  density: 1.2,
} as const;

/** m/s² */
export const GRAVITY = 9.81;

export const CONTACT = {
  /**
   * Coefficient of restitution, ball on table. A regulation ball dropped from 30 cm
   * must rebound 24–26 cm, which is e = sqrt(0.25/0.30) ≈ 0.91.
   */
  restitution: 0.9,
  /**
   * Coulomb friction coefficient, ball on table surface. Published values for a
   * celluloid/ABS ball on a coated table top cluster around 0.2–0.3.
   */
  friction: 0.25,
} as const;

/**
 * Aerodynamic coefficient fits.
 *
 * Both are functions of the spin ratio S = r·|ω⊥|/|v| — the ratio of surface speed to
 * flight speed. Smooth saturating fits to published table tennis wind-tunnel data:
 * C_L ≈ 0.15 at S = 0.25, ≈ 0.23 at S = 0.5, ≈ 0.30 at S = 1.0, saturating toward 0.45.
 */
export const AERO = {
  liftMax: 0.45,
  liftHalfSaturation: 0.5,
  dragBase: 0.4,
  dragSpinGain: 0.12,
  /**
   * s — spin decay time constant in flight. A documented simplification: the true
   * aerodynamic moment is speed-dependent, but over a single ~0.5 s flight the
   * difference is far below anything visible.
   */
  spinDecayTime: 4,
} as const;

/** Unit helpers — the UI talks in rev/s, the engine talks in rad/s. */
export const TAU = Math.PI * 2;

export function rpsToRadPerSec(rps: number): number {
  return rps * TAU;
}

export function radPerSecToRps(radPerSec: number): number {
  return radPerSec / TAU;
}

export function rpmToRps(rpm: number): number {
  return rpm / 60;
}

export function rpsToRpm(rps: number): number {
  return rps * 60;
}
