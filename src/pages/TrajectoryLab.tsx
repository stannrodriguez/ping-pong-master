import { useMemo, useState } from 'react';

import {
  TABLE_HALF_LENGTH,
  describeSpin,
  forcesAt,
  launchFrom,
  sampleAt,
  simulate,
  spinFromRake,
  spinRatio,
  v3,
  withoutSpin,
  type LaunchSpec,
  type Trajectory,
} from '../physics';
import { PageHeader } from '../ui/AppShell';
import { Chip, LegendItem, Note, Panel, Readout, Slider } from '../ui/controls';
import { ForceScaleKey, ForceVectors, SpinDial } from '../viz/ForceVectors';
import { inWeights } from '../viz/forceScale';
import { Ball, ScaleLabels, TableFrame } from '../viz/TableFrame';
import {
  fitProjection,
  formatLength,
  pathFrom,
  planViewExtents,
  project,
  sideViewExtents,
  type ViewPlane,
} from '../viz/projection';
import { useClock, useSize } from '../viz/useSize';

interface Shot {
  speed: number;
  elevation: number;
  height: number;
  spinRate: number;
  /** 0° pure topspin, 90° pure sidespin, 180° pure backspin. */
  rake: number;
}

const DEFAULT_SHOT: Shot = {
  speed: 12,
  elevation: 8,
  height: 0.28,
  spinRate: 90,
  rake: 0,
};

function buildLaunch(shot: Shot): LaunchSpec {
  const base = launchFrom({
    position: v3(0, shot.height, TABLE_HALF_LENGTH + 0.08),
    speed: shot.speed,
    elevation: shot.elevation,
  });
  return { ...base, spin: spinFromRake(base.velocity, shot.spinRate, shot.rake) };
}

/**
 * One view of the simulation. The no-spin baseline is drawn on every one of them,
 * always, because a single curve tells a learner nothing — the *gap* between the
 * spun shot and the identical unspun shot is the Magnus effect, and it is the
 * only thing on screen worth looking at.
 */
function TrajectoryView({
  plane,
  spun,
  plain,
  t,
  label,
  caption,
}: {
  plane: ViewPlane;
  spun: Trajectory;
  plain: Trajectory;
  t: number;
  label: string;
  caption: string;
}) {
  const { ref, width, height } = useSize();
  const clipId = `clip-${plane}`;

  const projection = useMemo(() => {
    const extents = plane === 'side' ? sideViewExtents() : planViewExtents();
    return fitProjection(
      {
        width,
        height,
        padding: { top: 16, right: 16, bottom: 26, left: plane === 'side' ? 30 : 16 },
      },
      extents.horizontal,
      extents.vertical,
    );
  }, [width, height, plane]);

  const head = sampleAt(spun, t);
  const forces = forcesAt(head);

  // The band between the two paths, closed into a fillable shape.
  const deviationBand = useMemo(() => {
    const upTo = (trajectory: Trajectory) =>
      trajectory.samples.filter((sample) => sample.t <= t).map((sample) => sample.position);
    const a = upTo(spun);
    const b = upTo(plain).reverse();
    if (a.length < 2 || b.length < 2) return '';
    return `${pathFrom(a, plane, projection)} L${pathFrom(b, plane, projection).slice(1)} Z`;
  }, [spun, plain, t, plane, projection]);

  return (
    <figure className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]">
      <figcaption className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] px-3 py-2">
        <span className="text-[length:var(--text-sm)] font-semibold text-[var(--ink-primary)]">
          {label}
        </span>
        <span className="text-[length:var(--text-xs)] text-[var(--ink-muted)]">{caption}</span>
      </figcaption>

      {/*
        Aspect ratios are matched to each view's own world box (side ≈ 4.4:1, plan
        ≈ 1.8:1) so the uniform-scale projection has almost no slack to centre
        away. Get this wrong and the table shrinks into the middle of an empty box.
      */}
      <div ref={ref} className={plane === 'side' ? 'aspect-[22/5] w-full' : 'aspect-[16/9] w-full max-w-[620px]'}>
        {width > 0 && (
          <svg width={width} height={height}>
            <defs>
              <clipPath id={clipId}>
                <rect x="0" y="0" width={width} height={height} />
              </clipPath>
            </defs>

            <TableFrame projection={projection} plane={plane} />
            <ScaleLabels projection={projection} plane={plane} />

            <g clipPath={`url(#${clipId})`}>
              {/* The Magnus effect, as an area rather than an assertion. */}
              <path d={deviationBand} fill="var(--accent)" opacity={0.13} />

              {/*
                The baseline is drawn complete from the start. It is a reference,
                not a race — seeing where the unspun ball ends up while the real
                one is still in the air is the entire comparison.
              */}
              <path
                d={pathFrom(plain.samples.map((s) => s.position), plane, projection)}
                fill="none"
                stroke="var(--spin-none)"
                strokeWidth={1.75}
                strokeDasharray="4 4"
              />
              <path
                d={pathFrom(
                  spun.samples.filter((s) => s.t <= t).map((s) => s.position),
                  plane,
                  projection,
                )}
                fill="none"
                stroke="var(--ink-primary)"
                strokeWidth={2.25}
                strokeLinecap="round"
              />

              <ForceVectors
                at={head.position}
                forces={forces}
                projection={projection}
                plane={plane}
              />
              <Ball
                cx={projection.x(project(head.position, plane).h)}
                cy={projection.y(project(head.position, plane).v)}
                projection={projection}
                emphasis
              />
            </g>
          </svg>
        )}
      </div>
    </figure>
  );
}

export function TrajectoryLab() {
  const [shot, setShot] = useState<Shot>(DEFAULT_SHOT);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useClock(playing, 0.4);

  const { spun, plain, launch } = useMemo(() => {
    const l = buildLaunch(shot);
    return {
      launch: l,
      spun: simulate(l, { maxBounces: 1 }),
      plain: simulate(withoutSpin(l), { maxBounces: 1 }),
    };
  }, [shot]);

  // The timeline belongs to the shot under study, not to the baseline — which is
  // drawn complete anyway — so the ball and its force vectors are on screen for
  // the whole of every cycle.
  const span = spun.duration;
  const cycle = span + 0.9;
  const t = Math.min(span, elapsed % cycle);

  const head = sampleAt(spun, t);
  const forces = forcesAt(head);
  const set = <K extends keyof Shot>(key: K) => (value: number) =>
    setShot((previous) => ({ ...previous, [key]: value }));

  const shift = useMemo(() => {
    if (!spun.touchdown || !plain.touchdown) return undefined;
    return {
      along: spun.touchdown.z - plain.touchdown.z,
      across: spun.touchdown.x - plain.touchdown.x,
    };
  }, [spun, plain]);

  const S = spinRatio(launch.velocity, launch.spin);

  /** m — how far the ball wanders across the table over the whole flight. */
  const lateralSpread = useMemo(() => {
    const xs = spun.samples.map((sample) => sample.position.x);
    return Math.max(...xs) - Math.min(...xs);
  }, [spun]);

  return (
    <>
      <PageHeader title="Trajectory Lab" question="What shape does this shot make, and what forces make that shape?">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="cursor-pointer rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-[length:var(--text-sm)] text-[var(--ink-primary)]"
          >
            {playing ? 'Pause' : 'Play'}
          </button>
          <label className="flex items-center gap-2 text-[length:var(--text-xs)] text-[var(--ink-muted)]">
            <span className="tnum">{t.toFixed(3)} s</span>
            <input
              type="range"
              min={0}
              max={span}
              step={span / 400}
              value={t}
              onChange={(e) => {
                setPlaying(false);
                setElapsed(Number(e.target.value));
              }}
              className="w-40"
              aria-label="Scrub through the flight"
            />
          </label>
        </div>
      </PageHeader>

      <div className="grid gap-4 p-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <Panel title="The shot" subtitle="Change one thing at a time and watch what moves.">
            <div className="flex flex-col gap-4">
              <Slider label="Speed" value={shot.speed} min={3} max={25} step={0.5} unit="m/s" onChange={set('speed')} format={(v) => v.toFixed(1)} />
              <Slider label="Launch angle" value={shot.elevation} min={-12} max={26} step={1} unit="°" onChange={set('elevation')} />
              <Slider label="Launch height" value={shot.height} min={0.05} max={0.7} step={0.01} unit="m" onChange={set('height')} format={(v) => v.toFixed(2)} />
            </div>
          </Panel>

          <Panel title="The spin">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1 flex flex-col gap-4">
                <Slider label="Spin rate" value={shot.spinRate} min={0} max={160} step={1} unit="rev/s" onChange={set('spinRate')} />
                <Slider
                  label="Axis rake"
                  value={shot.rake}
                  min={0}
                  max={180}
                  step={1}
                  unit="°"
                  onChange={set('rake')}
                  hint="0° topspin · 90° sidespin · 180° backspin"
                />
              </div>
              <SpinDial
                topspinRps={shot.spinRate * Math.cos((shot.rake * Math.PI) / 180)}
                sidespinRps={shot.spinRate * Math.sin((shot.rake * Math.PI) / 180)}
              />
            </div>

            <p className="mt-3 text-[length:var(--text-sm)] text-[var(--ink-secondary)]">
              {describeSpin(launch.velocity, launch.spin)}
            </p>
          </Panel>

          <Panel title="Right now">
            <div className="grid grid-cols-2 gap-4">
              <Readout label="Spin ratio S" value={S.toFixed(2)} tone="accent" note="r·ω / v" />
              <Readout label="Magnus" value={inWeights(forces.magnus).toFixed(2)} unit="g" />
              <Readout label="Drag" value={inWeights(forces.drag).toFixed(2)} unit="g" />
              <Readout label="Speed" value={Math.hypot(head.velocity.x, head.velocity.y, head.velocity.z).toFixed(1)} unit="m/s" />
            </div>
            <div className="mt-4">
              <Note>
                Magnus is always perpendicular to the velocity, so it only ever bends the
                path — it never speeds the ball up or slows it down. All of that is drag.
              </Note>
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <TrajectoryView
            plane="side"
            spun={spun}
            plain={plain}
            t={t}
            label="Side elevation"
            caption="metres · where dip and float live"
          />
          {/*
            The plan view only earns its space when there is something lateral to
            look at. Rather than showing a large empty rectangle with a dead-straight
            line through it, say why the line is straight — that is the lesson.
          */}
          {lateralSpread > 0.015 ? (
            <TrajectoryView
              plane="plan"
              spun={spun}
              plain={plain}
              t={t}
              label="Plan view"
              caption="metres · where curve lives"
            />
          ) : (
            <div className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] px-4 py-3">
              <Note>
                No plan view: this spin axis has no vertical component, so ω × v has no
                horizontal part and the ball does not curve sideways at all. Rake the axis
                past 0° to put the Magnus force into the horizontal plane.
              </Note>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] px-4 py-3">
            <LegendItem color="var(--ink-primary)" label="This shot" />
            <LegendItem color="var(--spin-none)" label="Same shot, no spin" dashed detail="baseline" />
            <LegendItem color="var(--accent)" label="The difference" area detail="what spin did" />
            <span className="ml-auto">
              <ForceScaleKey />
            </span>
          </div>

          <Panel title="Outcome">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Readout
                label="Net clearance"
                value={spun.netClearance == null ? '—' : formatLength(spun.netClearance)}
                tone={spun.netClearance == null ? 'default' : spun.netClearance > 0 ? 'good' : 'bad'}
              />
              <Readout label="Apex" value={formatLength(spun.apex)} note="above the surface" />
              <Readout label="Flight time" value={spun.duration.toFixed(3)} unit="s" />
              <Readout
                label="Result"
                value={spun.isLegal ? 'On the table' : spun.events.some((e) => e.kind === 'net') ? 'Into the net' : 'Long'}
                tone={spun.isLegal ? 'good' : 'bad'}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Chip tone="accent">
                {shift
                  ? `Spin moved the landing point ${formatLength(Math.abs(shift.along))} ${
                      shift.along > 0 ? 'shorter' : 'longer'
                    }`
                  : 'The no-spin version never reaches the table'}
              </Chip>
              {shift && Math.abs(shift.across) > 0.02 && (
                <Chip tone="accent">
                  and {formatLength(Math.abs(shift.across))} to the{' '}
                  {shift.across > 0 ? 'right' : 'left'}
                </Chip>
              )}
              {!plain.isLegal && spun.isLegal && (
                <Chip tone="good">Without its spin, this shot does not stay on the table</Chip>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
