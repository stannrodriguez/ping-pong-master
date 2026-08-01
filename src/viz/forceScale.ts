/**
 * The scale and ordering behind the force arrows.
 *
 * Split out from the drawing components so both can be imported without dragging
 * a React component graph along, and so fast refresh stays happy.
 */

import { BALL, GRAVITY, type ForceBreakdown, type Vec3 } from '../physics';

/**
 * One "gravity length" of arrow is always exactly 1 g, in every view, on every
 * page. That makes the ball's own weight a built-in ruler — an arrow drawn twice
 * as long as the gravity arrow *is* 2 g, and a reader can measure it without
 * consulting a legend. Auto-scaling the arrows to fit would destroy that, which
 * is why it isn't done.
 */
export const PIXELS_PER_GRAVITY = 42;

/** N — the ball's weight, the unit every arrow is measured in. */
export const WEIGHT = BALL.mass * GRAVITY;

export interface ForceArrow {
  key: string;
  label: string;
  color: string;
  force: Vec3;
}

/** The three forces, in a fixed order so the legend never reshuffles. */
export function forceArrows(forces: ForceBreakdown): ForceArrow[] {
  return [
    { key: 'gravity', label: 'Gravity', color: 'var(--force-gravity)', force: forces.gravity },
    { key: 'drag', label: 'Drag', color: 'var(--force-drag)', force: forces.drag },
    { key: 'magnus', label: 'Magnus', color: 'var(--force-magnus)', force: forces.magnus },
  ];
}

/** Multiples of the ball's own weight — the number the arrow length encodes. */
export function inWeights(force: Vec3): number {
  return Math.hypot(force.x, force.y, force.z) / WEIGHT;
}
