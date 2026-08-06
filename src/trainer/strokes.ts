/**
 * The receiver's decision space, and how it is graded.
 *
 * A choice is a stroke (which couples a racket angle to a swing, the way a real
 * stroke does) crossed with an aim. The choice builds a `RacketPlane`; the racket
 * contact model produces the outgoing ball; the simulator flies it. Whether a choice
 * was "correct" is never looked up — it is whatever that simulation does. The same
 * grading runs for all nine choices to build the outcome map shown after each rep.
 *
 * Stroke constants (angles, swing speeds) are tuned against the simulator the same
 * way the shot presets are: change one and re-run `trainer.test.ts`, which asserts
 * the coaching truths the trainer exists to teach (open beats backspin, closed beats
 * topspin, sidespin walks the return sideways).
 */

import {
  contactWithRacket,
  simulate,
  TABLE,
  TABLE_HALF_LENGTH,
  TABLE_HALF_WIDTH,
  v3,
  type BallState,
  type RacketContactResult,
  type RacketPlane,
  type Trajectory,
  type Vec3,
} from '../physics';

export type StrokeId = 'push' | 'drive' | 'block';
export type AimId = 'left' | 'straight' | 'right';

export interface StrokeChoice {
  stroke: StrokeId;
  aim: AimId;
}

export interface StrokeDef {
  id: StrokeId;
  name: string;
  /** Racket face, as a player would say it. */
  face: string;
  /** deg — blade tilt. Positive opens the face toward the ceiling. */
  tilt: number;
  /** m/s — swing speed along the aim direction (horizontal). */
  forward: number;
  /** m/s — vertical swing component. Positive brushes up. */
  lift: number;
}

/**
 * Three real strokes. The tilt/swing pairs are what distinguish them; everything
 * downstream is the one contact model.
 */
export const STROKES: StrokeDef[] = [
  { id: 'push', name: 'Push', face: 'open the face, dig under the ball', tilt: 42, forward: 3.0, lift: 0 },
  { id: 'drive', name: 'Drive', face: 'near-flat face, lift through the ball', tilt: -5, forward: 3.0, lift: 3.0 },
  { id: 'block', name: 'Block', face: 'close over it, let the pace work', tilt: -6, forward: 4.6, lift: 1.6 },
];

export const STROKES_BY_ID = Object.fromEntries(STROKES.map((s) => [s.id, s])) as Record<
  StrokeId,
  StrokeDef
>;

export const AIMS: Array<{ id: AimId; name: string; heading: number }> = [
  { id: 'left', name: 'Aim left', heading: -14 },
  { id: 'straight', name: 'Straight', heading: 0 },
  { id: 'right', name: 'Aim right', heading: 14 },
];

export const AIMS_BY_ID = Object.fromEntries(AIMS.map((a) => [a.id, a])) as Record<
  AimId,
  { id: AimId; name: string; heading: number }
>;

/**
 * Build the blade for a choice. The receiver hits toward -z; `heading` yaws the
 * stroke about vertical (+ toward +x, the receiver's right), `tilt` opens or closes
 * the face about the horizontal axis of the blade.
 */
export function racketFor(choice: StrokeChoice): RacketPlane {
  const stroke = STROKES_BY_ID[choice.stroke];
  const yaw = (AIMS_BY_ID[choice.aim].heading * Math.PI) / 180;
  const tilt = (stroke.tilt * Math.PI) / 180;

  // Horizontal aim direction, unit: straight is (0, 0, -1).
  const dir = v3(Math.sin(yaw), 0, -Math.cos(yaw));
  // Face normal: the aim direction pitched by the tilt.
  const normal = v3(dir.x * Math.cos(tilt), Math.sin(tilt), dir.z * Math.cos(tilt));
  const velocity = v3(dir.x * stroke.forward, stroke.lift, dir.z * stroke.forward);
  return { normal, velocity };
}

export type ReturnOutcome = 'landed' | 'popped' | 'net' | 'long' | 'wide' | 'own-half';

export const OUTCOME_LABELS: Record<ReturnOutcome, string> = {
  landed: 'On the table',
  popped: 'Popped up — smashed',
  net: 'Into the net',
  long: 'Flew long',
  wide: 'Went wide',
  'own-half': 'Died on your side',
};

/**
 * m — a legal return whose apex climbs above this is scored as a sitter. The
 * simulator decides whether the ball lands; whether a landed ball was *safe* is a
 * table-tennis judgment, and this is the one judgment call in the grading: a return
 * hanging half a metre over the table is smashed by any opponent who can hold a bat.
 */
export const POPPED_APEX = 0.45;

export interface ReturnResult {
  choice: StrokeChoice;
  contact: RacketContactResult;
  trajectory: Trajectory;
  outcome: ReturnOutcome;
  /** m — depth of the landing beyond the net on the opponent's half, when it landed. */
  landingDepth?: number;
}

function classify(trajectory: Trajectory): ReturnOutcome {
  if (trajectory.isLegal) return trajectory.apex > POPPED_APEX ? 'popped' : 'landed';
  if (trajectory.events.some((e) => e.kind === 'net')) return 'net';

  const down = trajectory.touchdown;
  if (down) {
    // First came down on the receiver's own side — hit down or ballooned straight up.
    if (down.z > 0) return 'own-half';
    if (Math.abs(down.x) > TABLE_HALF_WIDTH) return 'wide';
    if (down.z < -TABLE_HALF_LENGTH) return 'long';
  }
  return 'long';
}

/** Play one choice against the ball the serve delivered, and grade what happens. */
export function playReturn(ball: BallState, choice: StrokeChoice): ReturnResult {
  const contact = contactWithRacket(
    { velocity: ball.velocity, spin: ball.spin },
    racketFor(choice),
  );
  const trajectory = simulate(
    { position: ball.position, velocity: contact.velocity, spin: contact.spin },
    { maxBounces: 1, maxTime: 2.5 },
  );
  const outcome = classify(trajectory);
  return {
    choice,
    contact,
    trajectory,
    outcome,
    landingDepth: trajectory.landing ? -trajectory.landing.z : undefined,
  };
}

/** The full 3×3 decision space, graded. Rows are strokes, columns are aims. */
export function gradeAllChoices(ball: BallState): ReturnResult[][] {
  return STROKES.map((stroke) =>
    AIMS.map((aim) => playReturn(ball, { stroke: stroke.id, aim: aim.id })),
  );
}

/**
 * One line on why a return did what it did, written from the contact numbers so it
 * can never disagree with the simulation it describes.
 */
export function explainReturn(ball: BallState, result: ReturnResult): string {
  const { contact, outcome } = result;
  const gripped = contact.regime === 'grip';
  const bite = gripped
    ? 'The rubber stopped the ball sliding across the face.'
    : 'The ball kept sliding across the rubber.';
  const spinNote = `The incoming spin made the contact point move at ${vecSpeed(contact.contactVelocity).toFixed(1)} m/s across the face.`;

  const ending =
    outcome === 'landed'
      ? `The return cleared the net and landed ${result.landingDepth ? `${result.landingDepth.toFixed(2)} m` : ''} beyond it.`
      : outcome === 'net'
        ? 'The result left the blade too low and went into the net.'
        : outcome === 'long'
          ? 'The result left the blade too fast and high, and carried past the end line.'
          : outcome === 'wide'
            ? 'The sideways throw off the rubber carried it past the sideline.'
            : 'It came off the blade downward and died on your own half.';

  return `${bite} ${spinNote} ${ending}`;
}

function vecSpeed(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

/** m — the height of the net, re-exported for the trainer HUD. */
export const NET_HEIGHT = TABLE.netHeight;
