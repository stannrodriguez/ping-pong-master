/**
 * The physics engine.
 *
 * Everything is SI: metres, seconds, kilograms, m/s, rad/s, newtons. The UI converts to
 * rev/s and centimetres at the edge; nothing inside this folder does.
 *
 * The engine never branches on a "spin type". Topspin, backspin and sidespin are the
 * same Magnus term with different axes, and the bounce is one friction impulse applied
 * identically to all of them. If a behaviour cannot be produced that way, it does not
 * belong in here.
 */

export * from './vec3';
export * from './constants';
export * from './aero';
export * from './spin';
export * from './bounce';
export * from './racket';
export * from './simulate';
export * from './shots';
