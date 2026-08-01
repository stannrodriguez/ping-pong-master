import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import {
  launchFrom,
  measure,
  sampleAt,
  simulate,
  spinFromComponents,
  v3,
  type LaunchSpec,
} from '../physics';
import { SECTIONS } from '../ui/sections';
import { LegendItem } from '../ui/controls';
import { TableFrame } from '../viz/TableFrame';
import { Ball } from '../viz/TableFrame';
import { fitProjection, pathFrom, sideViewExtents } from '../viz/projection';
import { useClock, useSize } from '../viz/useSize';

/**
 * Three shots that differ in exactly one quantity: spin. Same launch point, same
 * speed, same angle. Whatever separates them on screen is the Magnus effect and
 * nothing else — which is the entire premise of the app, stated as a picture
 * before it is stated in words.
 */
const HERO_SPINS = [
  { label: 'Topspin', rps: 95, color: 'var(--spin-topspin)' },
  { label: 'No spin', rps: 0, color: 'var(--spin-none)' },
  { label: 'Backspin', rps: -60, color: 'var(--spin-backspin)' },
] as const;

function heroLaunch(topspinRps: number): LaunchSpec {
  const base = launchFrom({ position: v3(0, 0.3, 1.35), speed: 11, elevation: 9 });
  return {
    ...base,
    spin: spinFromComponents(base.velocity, {
      topspin: topspinRps,
      sidespin: 0,
      corkscrew: 0,
    }),
  };
}

function HeroChart() {
  const { ref, width, height } = useSize();
  const [elapsed] = useClock(true, 0.55);

  const runs = useMemo(
    () =>
      HERO_SPINS.map((spin) => {
        const launch = heroLaunch(spin.rps);
        return { ...spin, trajectory: simulate(launch, { maxBounces: 1 }) };
      }),
    [],
  );

  const longest = Math.max(...runs.map((run) => run.trajectory.duration));
  // Hold on the finished frame for a beat before looping, so the eye can compare.
  const cycle = longest + 1.1;
  const t = Math.min(longest, elapsed % cycle);

  const projection = useMemo(() => {
    const { horizontal, vertical } = sideViewExtents();
    return fitProjection(
      { width, height, padding: { top: 14, right: 14, bottom: 20, left: 14 } },
      horizontal,
      vertical,
    );
  }, [width, height]);

  return (
    // Height is chosen to roughly match the world box's own aspect ratio, so the
    // uniform-scale projection has little slack left over to centre away.
    <div ref={ref} className="h-[210px] w-full sm:h-[280px]">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Three shots launched identically, differing only in spin">
          <defs>
            {/* Paths that leave the frame have left the table — let them go. */}
            <clipPath id="hero-clip">
              <rect x="0" y="0" width={width} height={height} />
            </clipPath>
          </defs>
          <TableFrame projection={projection} plane="side" />

          <g clipPath="url(#hero-clip)">
          {runs.map((run) => {
            const points = run.trajectory.samples
              .filter((sample) => sample.t <= t)
              .map((sample) => sample.position);
            const head = sampleAt(run.trajectory, t);
            return (
              <g key={run.label}>
                <path
                  d={pathFrom(points, 'side', projection)}
                  fill="none"
                  stroke={run.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeDasharray={run.rps === 0 ? '4 4' : undefined}
                  opacity={0.9}
                />
                {t < run.trajectory.duration && (
                  <Ball
                    cx={projection.x(-head.position.z)}
                    cy={projection.y(head.position.y)}
                    projection={projection}
                    color={run.color}
                    emphasis
                  />
                )}
              </g>
            );
          })}
          </g>
        </svg>
      )}
    </div>
  );
}

export function Home() {
  // Measured, not asserted: how far past the end of the table the loop would fly
  // if its topspin were removed and nothing else changed.
  const overshoot = useMemo(() => {
    const loop = heroLaunch(95);
    const shift = measure(loop).landingShift;
    return shift ? Math.abs(shift.alongTable) : 0;
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
      <div className="fade-in">
        <h1 className="text-[length:var(--text-2xl)] font-black leading-[1.05] tracking-tight text-[var(--ink-primary)] sm:text-[length:var(--text-3xl)]">
          Spin is a force,
          <br />
          not a personality.
        </h1>
        <p className="mt-4 max-w-xl text-[length:var(--text-base)] leading-relaxed text-[var(--ink-secondary)]">
          Table tennis players describe spin in adjectives — heavy, loaded, dead. It is
          actually two mechanisms you can calculate: a sideways push from the air, and a
          friction impulse lasting half a millisecond. This app simulates both, in real
          units, and shows you the working.
        </p>
      </div>

      <div className="mt-8 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-3 fade-in">
        <HeroChart />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--line)] px-2 pt-3">
          {HERO_SPINS.map((spin) => (
            <LegendItem
              key={spin.label}
              color={spin.color}
              label={spin.label}
              dashed={spin.rps === 0}
              detail={spin.rps === 0 ? 'baseline' : `${Math.abs(spin.rps)} rev/s`}
            />
          ))}
          <p className="ml-auto text-[length:var(--text-xs)] text-[var(--ink-muted)]">
            Same launch point, speed and angle. Only the spin differs.
          </p>
        </div>
      </div>

      <p className="mt-6 max-w-2xl text-[length:var(--text-base)] leading-relaxed text-[var(--ink-secondary)] fade-in">
        Strip the topspin out of that first shot and change nothing else, and it lands{' '}
        <strong className="tnum text-[var(--ink-primary)]">{overshoot.toFixed(2)} m</strong> further
        down — well past the end of the table. That gap is the whole reason the modern
        attacking game exists, and it is a number this simulator computes rather than a
        claim it repeats.
      </p>

      <nav className="mt-10 grid gap-3 sm:grid-cols-2 fade-in">
        {SECTIONS.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            className="group rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] p-4 transition-colors hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)]"
          >
            <span className="text-[length:var(--text-base)] font-semibold text-[var(--ink-primary)]">
              {section.label}
            </span>
            <span className="mt-1 block text-[length:var(--text-sm)] text-[var(--ink-secondary)]">
              {section.question}
            </span>
          </Link>
        ))}
      </nav>

      <p className="mt-10 text-[length:var(--text-xs)] leading-relaxed text-[var(--ink-muted)] fade-in">
        Everything here runs on one engine, in SI units, with no per-spin special cases:
        one Magnus term and one friction impulse at the contact point. Its behaviour is
        pinned by tests that assert every claim this app makes in prose.
      </p>
    </div>
  );
}
