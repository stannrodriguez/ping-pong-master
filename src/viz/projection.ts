/**
 * Mapping metres to pixels.
 *
 * Everything drawn in this app is drawn to scale, in metres, with the same
 * projection helpers. That is not fussiness — the app's core claim is that its
 * numbers are real, and a table drawn 1.4× too long quietly breaks that claim on
 * every single view.
 */

import { TABLE, TABLE_HALF_LENGTH, TABLE_HALF_WIDTH, type Vec3 } from '../physics';

export interface Extent {
  min: number;
  max: number;
}

export interface Viewport {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

/**
 * A projection from world metres to SVG pixels that preserves aspect ratio.
 * Uniform scale is mandatory: a squashed axis would make a 20 cm dip look like a
 * 40 cm dip, which is exactly the kind of lie this app exists to replace.
 */
export interface Projection {
  x: (worldX: number) => number;
  y: (worldY: number) => number;
  /** Convert a length in metres to a length in pixels. */
  len: (metres: number) => number;
  /** Pixels per metre. */
  scale: number;
  viewport: Viewport;
  horizontal: Extent;
  vertical: Extent;
}

/**
 * Build a uniform-scale projection that fits `horizontal` × `vertical` inside the
 * viewport, centring whichever axis has slack.
 */
export function fitProjection(
  viewport: Viewport,
  horizontal: Extent,
  vertical: Extent,
): Projection {
  const { padding } = viewport;
  const innerWidth = Math.max(1, viewport.width - padding.left - padding.right);
  const innerHeight = Math.max(1, viewport.height - padding.top - padding.bottom);

  const worldWidth = Math.max(1e-6, horizontal.max - horizontal.min);
  const worldHeight = Math.max(1e-6, vertical.max - vertical.min);

  const scale = Math.min(innerWidth / worldWidth, innerHeight / worldHeight);

  // Centre the axis that has room to spare.
  const slackX = (innerWidth - worldWidth * scale) / 2;
  const slackY = (innerHeight - worldHeight * scale) / 2;

  return {
    scale,
    viewport,
    horizontal,
    vertical,
    x: (worldX) => padding.left + slackX + (worldX - horizontal.min) * scale,
    // SVG y grows downward; world y grows upward.
    y: (worldY) => padding.top + slackY + (vertical.max - worldY) * scale,
    len: (metres) => metres * scale,
  };
}

/**
 * The standard framing for a side elevation: the whole table plus run-off.
 *
 * `runOff` extends the far end so a shot that flies long stays visible for a
 * moment after it has left the table. Views clip to the plot box, so a path that
 * runs out of the frame reads as exactly what it is — gone.
 */
export function sideViewExtents(margin = 0.45, runOff = 0.8) {
  return {
    horizontal: { min: -TABLE_HALF_LENGTH - margin, max: TABLE_HALF_LENGTH + runOff },
    // From a little below the table surface to comfortably above a lobbed ball.
    vertical: { min: -0.12, max: 0.78 },
  };
}

/** The standard framing for a plan view, looking down at the table. */
export function planViewExtents(margin = 0.3) {
  return {
    horizontal: { min: -TABLE_HALF_LENGTH - margin, max: TABLE_HALF_LENGTH + margin * 1.6 },
    vertical: { min: -TABLE_HALF_WIDTH - margin, max: TABLE_HALF_WIDTH + margin },
  };
}

/**
 * The two projections of a 3D point the app uses.
 *
 * Side elevation looks along +x: the down-table axis is horizontal, height is
 * vertical. This is the view where dip and float live.
 *
 * Plan view looks down from +y: the down-table axis is horizontal, across-table
 * is vertical. This is the view where curve lives.
 *
 * Down-table runs toward -z, but a reader expects "the shot travels left to
 * right", so both views negate z. Doing it here, once, keeps every caller honest.
 */
export function toSide(p: Vec3): { h: number; v: number } {
  return { h: -p.z, v: p.y };
}

export function toPlan(p: Vec3): { h: number; v: number } {
  return { h: -p.z, v: p.x };
}

export type ViewPlane = 'side' | 'plan';

export function project(p: Vec3, plane: ViewPlane) {
  return plane === 'side' ? toSide(p) : toPlan(p);
}

/** Build an SVG path string from a run of world points through a projection. */
export function pathFrom(
  points: Vec3[],
  plane: ViewPlane,
  projection: Projection,
): string {
  if (points.length === 0) return '';
  let d = '';
  for (let i = 0; i < points.length; i++) {
    const { h, v } = project(points[i], plane);
    d += `${i === 0 ? 'M' : 'L'}${projection.x(h).toFixed(2)} ${projection.y(v).toFixed(2)}`;
  }
  return d;
}

/** Evenly spaced tick positions covering an extent, snapped to a round step. */
export function ticks(extent: Extent, approximateCount = 6): number[] {
  const span = extent.max - extent.min;
  const rawStep = span / Math.max(1, approximateCount);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const niceStep =
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;

  const out: number[] = [];
  const start = Math.ceil(extent.min / niceStep) * niceStep;
  for (let v = start; v <= extent.max + 1e-9; v += niceStep) {
    // Kill floating-point dust so labels read "0.5" and not "0.5000000000001".
    out.push(Math.abs(v) < 1e-9 ? 0 : Number(v.toFixed(6)));
  }
  return out;
}

/** The table's own geometry, in the coordinates each view uses. */
export const TABLE_GEOMETRY = {
  side: {
    /** Playing surface: a line from one end to the other at y = 0. */
    surface: { from: -TABLE_HALF_LENGTH, to: TABLE_HALF_LENGTH, y: 0 },
    net: { h: 0, from: 0, to: TABLE.netHeight },
  },
  plan: {
    left: -TABLE_HALF_WIDTH,
    right: TABLE_HALF_WIDTH,
    from: -TABLE_HALF_LENGTH,
    to: TABLE_HALF_LENGTH,
  },
} as const;

/** Format a length in metres for display, choosing cm below a metre. */
export function formatLength(metres: number): string {
  const abs = Math.abs(metres);
  if (abs < 1) return `${(metres * 100).toFixed(abs < 0.1 ? 1 : 0)} cm`;
  return `${metres.toFixed(2)} m`;
}
