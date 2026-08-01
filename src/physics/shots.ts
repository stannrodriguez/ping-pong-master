/**
 * Canonical shots, with parameters chosen to match published measurements of real
 * play rather than to look good on screen.
 *
 * Spin rates are the ones people actually measure with high-speed video: a world-class
 * loop drive carries 100–150 rev/s, a heavy chop 60–90 rev/s, a smash almost none.
 * Speeds are ball speeds at launch, not racket speeds.
 */

import { v3, type Vec3 } from './vec3';
import { spinFromComponents, type SpinComponents } from './spin';
import { launchFrom, type LaunchSpec } from './simulate';

export interface ShotPreset {
  id: string;
  name: string;
  /** One line on what the shot is for. */
  summary: string;
  /** What the physics does that makes the shot work. */
  mechanism: string;
  /** m/s at launch */
  speed: number;
  /** degrees above horizontal */
  elevation: number;
  /** degrees off straight down the table */
  heading: number;
  /** m — launch point, +z end of the table */
  from: Vec3;
  spin: SpinComponents;
  /** Chart/legend colour. */
  color: string;
}

export const SHOTS: ShotPreset[] = [
  {
    id: 'loop',
    name: 'Topspin loop',
    summary: 'The attacking stroke of modern table tennis: heavy forward spin, hit upward.',
    mechanism:
      'The Magnus force points straight down, which lets the ball be launched well above the net and still be pulled onto the table. Without spin this exact shot flies long.',
    speed: 13,
    elevation: 7,
    heading: 0,
    from: v3(0, 0.25, 1.45),
    spin: { topspin: 110, sidespin: 0, corkscrew: 0 },
    color: 'var(--spin-topspin)',
  },
  {
    id: 'counter',
    name: 'Counter-hit',
    summary: 'A flatter, faster drive with moderate topspin — the rally workhorse.',
    mechanism:
      'Less spin means a smaller Magnus force, so the shot has to be launched flatter to stay on the table. Faster, but a much smaller margin over the net.',
    speed: 15,
    elevation: 1,
    heading: 0,
    from: v3(0, 0.32, 1.4),
    spin: { topspin: 45, sidespin: 0, corkscrew: 0 },
    color: '#e8913a',
  },
  {
    id: 'smash',
    name: 'Smash',
    summary: 'Maximum speed, almost no spin, hit downward from a high ball.',
    mechanism:
      'With no spin there is no Magnus force at all — only gravity and drag. The ball flies a near-parabola, so the downward angle has to do all the work of keeping it on the table.',
    speed: 22,
    elevation: -9,
    heading: 0,
    from: v3(0, 0.55, 1.5),
    spin: { topspin: 12, sidespin: 0, corkscrew: 0 },
    color: '#d8465e',
  },
  {
    id: 'chop',
    name: 'Backspin chop',
    summary: 'A defensive stroke: heavy backspin, played from well behind the table.',
    mechanism:
      'The Magnus force points up, so the ball floats and hangs. At the bounce the contact patch is racing forwards, friction saturates, and most of the backspin is scrubbed off — the ball leaves the table with far less spin than it arrived with.',
    speed: 8,
    elevation: 4,
    heading: 0,
    from: v3(0, 0.3, 1.9),
    spin: { topspin: -75, sidespin: 0, corkscrew: 0 },
    color: 'var(--spin-backspin)',
  },
  {
    id: 'push',
    name: 'Short push',
    summary: 'A controlled, low backspin touch that stays short over the net.',
    mechanism:
      'Low speed with heavy backspin gives a very high spin ratio, so the float is pronounced even though the ball is barely moving. The bounce kills most of what is left.',
    speed: 4.5,
    elevation: 18,
    heading: 0,
    from: v3(0, 0.22, 1.2),
    spin: { topspin: -55, sidespin: 0, corkscrew: 0 },
    color: '#5aa8d8',
  },
  {
    id: 'block',
    name: 'Block',
    summary: 'A passive return that redirects an incoming loop with the racket angle.',
    mechanism:
      'Little added spin and little added speed. Its value is timing, not physics — which is exactly why it looks so plain next to the others here.',
    speed: 9,
    elevation: 6,
    heading: 0,
    from: v3(0, 0.28, 1.25),
    spin: { topspin: 20, sidespin: 0, corkscrew: 0 },
    color: '#8b8fa3',
  },
  {
    id: 'float-serve',
    name: 'Float serve',
    summary: 'A deceptive no-spin serve that looks like a spin serve.',
    mechanism:
      'Zero spin means zero Magnus force, so the ball follows a plain parabola and grips normally at the bounce. It is deceptive precisely because nothing happens.',
    speed: 4.5,
    elevation: 22,
    heading: 0,
    from: v3(-0.4, 0.18, 1.15),
    spin: { topspin: 0, sidespin: 0, corkscrew: 0 },
    color: 'var(--spin-none)',
  },
  {
    id: 'pendulum-serve',
    name: 'Pendulum sidespin serve',
    summary: 'A serve with the spin axis raked over toward vertical, curving in flight.',
    mechanism:
      'Two different parts of the axis do two different jobs. The vertical part puts the Magnus force in the horizontal plane, curving the ball in flight. The part raked toward the direction of travel does nothing in the air but supplies the whole sideways kick off the bounce — a purely vertical axis would bounce dead straight.',
    speed: 4.5,
    elevation: 21,
    heading: -4,
    from: v3(-0.4, 0.18, 1.15),
    spin: { topspin: -20, sidespin: 60, corkscrew: 35 },
    color: 'var(--spin-sidespin)',
  },
];

export const SHOTS_BY_ID: Record<string, ShotPreset> = Object.fromEntries(
  SHOTS.map((shot) => [shot.id, shot]),
);

/** Turn a preset into something the integrator can run. */
export function launchOf(shot: ShotPreset): LaunchSpec {
  // Spin is defined relative to the direction of travel, so the velocity has to exist
  // before the spin vector can be built.
  const base = launchFrom({
    position: shot.from,
    speed: shot.speed,
    elevation: shot.elevation,
    heading: shot.heading,
  });
  return { ...base, spin: spinFromComponents(base.velocity, shot.spin) };
}

/** The three reference spins the app keeps returning to for comparison. */
export const REFERENCE_SPINS: Array<{ label: string; components: SpinComponents; color: string }> =
  [
    { label: 'Topspin', components: { topspin: 90, sidespin: 0, corkscrew: 0 }, color: 'var(--spin-topspin)' },
    { label: 'No spin', components: { topspin: 0, sidespin: 0, corkscrew: 0 }, color: 'var(--spin-none)' },
    { label: 'Backspin', components: { topspin: -90, sidespin: 0, corkscrew: 0 }, color: 'var(--spin-backspin)' },
  ];
