/**
 * Minimal 3-vector maths. All values are SI (metres, m/s, rad/s).
 *
 * Frame convention used everywhere in this engine:
 *   +x — across the table, to the right when looking down the length from +z
 *   +y — up
 *   +z — along the table length; the near player stands at +z and hits toward -z
 * Origin sits at the centre of the table, on the playing surface.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const ZERO: Vec3 = Object.freeze({ x: 0, y: 0, z: 0 });
export const UP: Vec3 = Object.freeze({ x: 0, y: 1, z: 0 });

export function v3(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

/** a + b*s — fused, to keep integrator code readable. */
export function addScaled(a: Vec3, b: Vec3, s: number): Vec3 {
  return { x: a.x + b.x * s, y: a.y + b.y * s, z: a.z + b.z * s };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function lengthSq(v: Vec3): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

/** Unit vector, or the zero vector if the input has no length. */
export function normalize(v: Vec3): Vec3 {
  const l = length(v);
  return l === 0 ? { ...ZERO } : { x: v.x / l, y: v.y / l, z: v.z / l };
}

/** Horizontal part of a vector (y removed). */
export function horizontal(v: Vec3): Vec3 {
  return { x: v.x, y: 0, z: v.z };
}

/** Component of `v` parallel to unit vector `axis`. */
export function projectOnto(v: Vec3, axis: Vec3): Vec3 {
  return scale(axis, dot(v, axis));
}

/** Component of `v` perpendicular to unit vector `axis`. */
export function rejectFrom(v: Vec3, axis: Vec3): Vec3 {
  return sub(v, projectOnto(v, axis));
}

export function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function clone(v: Vec3): Vec3 {
  return { x: v.x, y: v.y, z: v.z };
}
