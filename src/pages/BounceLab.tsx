import { useMemo, useState } from 'react';

import {
  BALL,
  CONTACT,
  bounceOffTable,
  componentsFromSpin,
  contactPointVelocity,
  explainBounce,
  gripThreshold,
  spinFromComponents,
  v3,
  type BounceResult,
  type Vec3,
} from '../physics';
import { PageHeader } from '../ui/AppShell';
import { Chip, LegendItem, Note, Panel, Readout, Slider } from '../ui/controls';
import { ticks } from '../viz/projection';
import { useSize } from '../viz/useSize';

interface Incoming {
  /** m/s — horizontal speed, travelling toward -z (drawn left to right). */
  speed: number;
  /** degrees below horizontal */
  descent: number;
  /** rev/s — positive topspin, negative backspin */
  spin: number;
}

const DEFAULT: Incoming = { speed: 9, descent: 20, spin: 80 };

function buildContact(incoming: Incoming): { velocity: Vec3; spin: Vec3 } {
  const rad = (incoming.descent * Math.PI) / 180;
  const velocity = v3(0, -incoming.speed * Math.sin(rad), -incoming.speed * Math.cos(rad));
  return {
    velocity,
    spin: spinFromComponents(velocity, { topspin: incoming.spin, sidespin: 0, corkscrew: 0 }),
  };
}

/** m/s → pixels, fixed so vectors stay comparable as the sliders move. */
const PX_PER_MPS = 20;

/**
 * The contact, drawn large.
 *
 * The one thing this diagram exists to show is that friction acts on the *contact
 * patch*, not on the ball. Those two velocities are drawn from two different
 * points — the centre and the bottom of the ball — because they are genuinely
 * different vectors, and every counter-intuitive thing about the bounce follows
 * from the difference.
 */
function ContactDiagram({
  velocity,
  spin,
  result,
}: {
  velocity: Vec3;
  spin: Vec3;
  result: BounceResult;
}) {
  const { ref, width, height } = useSize();
  if (width === 0) return <div ref={ref} className="aspect-[20/7] w-full" />;

  const cx = width * 0.42;
  const surfaceY = height * 0.66;
  const r = Math.min(62, height * 0.23);
  const cy = surfaceY - r;

  // World -z is drawn to the right, world +y is drawn up.
  const toPx = (v: Vec3) => ({ dx: -v.z * PX_PER_MPS, dy: -v.y * PX_PER_MPS });
  const inV = toPx(velocity);
  const outV = toPx(result.velocity);
  const u = toPx(result.contactVelocity);
  // Impulses are in N·s; scale them onto the same picture by their velocity effect.
  const friction = toPx({
    x: 0,
    y: 0,
    z: result.frictionImpulse.z / BALL.mass,
  });

  /**
   * `incoming` arrows are drawn arriving *at* the anchor point, outgoing ones
   * leaving it. Drawing both outward from the centre — the obvious first
   * implementation — makes the incoming velocity read as though the ball is
   * departing back the way it came.
   */
  const arrow = (
    key: string,
    x: number,
    y: number,
    d: { dx: number; dy: number },
    color: string,
    label: string,
    opts: { incoming?: boolean; labelSide?: number; labelGap?: number } = {},
  ) => {
    const { incoming = false, labelSide = 1, labelGap = 16 } = opts;
    const len = Math.hypot(d.dx, d.dy);
    if (len < 6) return null;

    const [x1, y1, x2, y2] = incoming
      ? [x - d.dx, y - d.dy, x, y]
      : [x, y, x + d.dx, y + d.dy];
    const nx = -d.dy / len;
    const ny = d.dx / len;

    return (
      <g key={key}>
        <defs>
          <marker
            id={`bounce-tip-${key}`}
            viewBox="0 0 8 8"
            refX="6.5"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto"
          >
            <path d="M0.5 0.8 L7 4 L0.5 7.2 z" fill={color} />
          </marker>
        </defs>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={2.5}
          markerEnd={`url(#bounce-tip-${key})`}
        />
        <text
          x={(x1 + x2) / 2 + nx * labelGap * labelSide}
          y={(y1 + y2) / 2 + ny * labelGap * labelSide + 4}
          textAnchor="middle"
          fill={color}
          stroke="var(--surface-1)"
          strokeWidth={3.5}
          paintOrder="stroke"
          style={{ fontSize: 11, fontWeight: 600 }}
        >
          {label}
        </text>
      </g>
    );
  };

  const topspinRps = componentsFromSpin(velocity, spin).topspin;

  return (
    <div ref={ref} className="aspect-[20/7] w-full">
      <svg width={width} height={height} role="img" aria-label="Ball-table contact analysis">
        {/* The table. */}
        <line x1={12} y1={surfaceY} x2={width - 12} y2={surfaceY} stroke="var(--line-strong)" strokeWidth={2.5} />
        <rect x={12} y={surfaceY} width={width - 24} height={9} fill="var(--surface-3)" />

        <circle cx={cx} cy={cy} r={r} fill="var(--surface-2)" stroke="var(--line-strong)" strokeWidth={2} />

        {/* Rotation, as a three-quarter arc inside the ball. */}
        {Math.abs(topspinRps) > 1 && (
          <>
            <defs>
              <marker id="bounce-spin-tip" viewBox="0 0 8 8" refX="5" refY="4" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M0.5 0.8 L7 4 L0.5 7.2 z" fill="var(--accent)" />
              </marker>
            </defs>
            <path
              d={(() => {
                const rr = r * 0.6;
                const cw = topspinRps >= 0;
                const a0 = -Math.PI * 0.7;
                const a1 = a0 + (cw ? 1 : -1) * Math.PI * 1.5;
                const at = (a: number) => `${cx + rr * Math.cos(a)} ${cy + rr * Math.sin(a)}`;
                return `M${at(a0)} A ${rr} ${rr} 0 1 ${cw ? 1 : 0} ${at(a1)}`;
              })()}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              markerEnd="url(#bounce-spin-tip)"
            />
          </>
        )}

        {arrow('in', cx, cy, inV, 'var(--ink-secondary)', 'v in', { incoming: true, labelSide: -1 })}
        {arrow('out', cx, cy, outV, 'var(--ink-primary)', 'v out', { labelSide: 1 })}

        {/* The contact patch and its velocity — the point of the whole page. */}
        <circle cx={cx} cy={surfaceY} r={4.5} fill="var(--status-warn)" stroke="var(--surface-1)" strokeWidth={1.5} />

        {/*
          u and the friction impulse are anti-parallel by definition, so they are
          anchored on opposite sides of the table line — otherwise the two arrows
          lie on top of each other and their labels collide, on every single
          configuration rather than as an edge case.
        */}
        {arrow('u', cx, surfaceY - 16, u, 'var(--status-warn)', 'slip at bottom (u)', { labelSide: -1, labelGap: 14 })}
        {arrow('f', cx, surfaceY + 28, friction, 'var(--force-drag)', 'friction impulse', { labelSide: 1, labelGap: 14 })}

        <text x={12} y={height - 8} className="viz-label">
          the ball is travelling →
        </text>
      </svg>
    </div>
  );
}

/**
 * Sweep incoming spin and plot what comes out. The grip threshold is marked
 * because the whole character of the bounce changes there, and that change of
 * character is a thing a fudge-factor model simply does not have.
 */
function BounceSweep({
  incoming,
  metric,
}: {
  incoming: Incoming;
  metric: (result: BounceResult, before: { velocity: Vec3; spin: Vec3 }) => number;
}) {
  const { ref, width, height } = useSize();

  const data = useMemo(() => {
    const points: Array<{ spin: number; value: number; regime: string }> = [];
    for (let rps = -160; rps <= 160; rps += 2) {
      const before = buildContact({ ...incoming, spin: rps });
      const result = bounceOffTable(before);
      points.push({ spin: rps, value: metric(result, before), regime: result.regime });
    }
    return points;
  }, [incoming, metric]);

  if (width === 0) return <div ref={ref} className="aspect-[4/3] w-full" />;

  const pad = { top: 12, right: 12, bottom: 24, left: 38 };
  const values = data.map((d) => d.value);
  const lo = Math.min(...values, 0);
  const hi = Math.max(...values, 0);
  const range = hi - lo || 1;

  const px = (s: number) => pad.left + ((s + 160) / 320) * (width - pad.left - pad.right);
  const py = (v: number) =>
    height - pad.bottom - ((v - lo) / range) * (height - pad.top - pad.bottom);

  const path = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'}${px(d.spin).toFixed(1)} ${py(d.value).toFixed(1)}`)
    .join('');

  // The contiguous span of incoming spins that grip rather than slide, drawn as a
  // single shaded band. Marking each transition with its own label put two "grips"
  // captions a few pixels apart on every chart.
  const gripping = data.filter((d) => d.regime === 'grip').map((d) => d.spin);
  const gripBand =
    gripping.length > 0
      ? { from: Math.min(...gripping), to: Math.max(...gripping) }
      : undefined;

  const current = data.reduce((best, d) =>
    Math.abs(d.spin - incoming.spin) < Math.abs(best.spin - incoming.spin) ? d : best,
  );

  return (
    <div ref={ref} className="aspect-[4/3] w-full">
      <svg width={width} height={height} role="img" aria-label="Outcome against incoming spin">
        <g className="viz-grid">
          {ticks({ min: lo, max: hi }, 4).map((v) => (
            <line key={v} x1={pad.left} y1={py(v)} x2={width - pad.right} y2={py(v)} />
          ))}
        </g>
        {ticks({ min: lo, max: hi }, 4).map((v) => (
          <text key={v} x={pad.left - 5} y={py(v) + 3} textAnchor="end" className="viz-label">
            {v.toFixed(Math.abs(v) < 10 ? 1 : 0)}
          </text>
        ))}

        {/* Zero line, where it exists in range. */}
        {lo < 0 && hi > 0 && (
          <line x1={pad.left} y1={py(0)} x2={width - pad.right} y2={py(0)} stroke="var(--line-strong)" strokeWidth={1} />
        )}

        {gripBand && (
          <g>
            <rect
              x={px(gripBand.from)}
              y={pad.top}
              width={Math.max(1, px(gripBand.to) - px(gripBand.from))}
              height={height - pad.top - pad.bottom}
              fill="var(--status-good)"
              opacity={0.12}
            />
            <text
              x={(px(gripBand.from) + px(gripBand.to)) / 2}
              y={pad.top + 9}
              textAnchor="middle"
              fill="var(--status-good)"
              style={{ fontSize: 9 }}
            >
              grips
            </text>
          </g>
        )}

        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.25} />
        <circle cx={px(current.spin)} cy={py(current.value)} r={5} fill="var(--accent)" stroke="var(--surface-1)" strokeWidth={2} />

        {[-160, -80, 0, 80, 160].map((s) => (
          <text key={s} x={px(s)} y={height - 8} textAnchor="middle" className="viz-label">
            {s}
          </text>
        ))}
      </svg>
    </div>
  );
}

const horizontalSpeed = (v: Vec3) => Math.hypot(v.x, v.z);

export function BounceLab() {
  const [incoming, setIncoming] = useState<Incoming>(DEFAULT);

  const before = useMemo(() => buildContact(incoming), [incoming]);
  const result = useMemo(() => bounceOffTable(before), [before]);

  const set = <K extends keyof Incoming>(key: K) => (value: number) =>
    setIncoming((previous) => ({ ...previous, [key]: value }));

  const u = contactPointVelocity(before.velocity, before.spin);
  const threshold = gripThreshold(before.velocity.y);
  const speedBefore = horizontalSpeed(before.velocity);
  const speedAfter = horizontalSpeed(result.velocity);
  const spinBefore = componentsFromSpin(before.velocity, before.spin).topspin;
  const spinAfter = componentsFromSpin(before.velocity, result.spin).topspin;

  return (
    <>
      <PageHeader title="Bounce Lab" question="What happens in the half-millisecond the ball touches the table?" />

      <div className="grid gap-4 p-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="lg:col-span-2">
          <Panel title="What this bounce does">
            <Note>
              The ball {result.regime === 'grip' ? 'grips the table' : 'skids across the table'}.
              Friction{' '}
              {result.velocity.z > 0
                ? 'reverses its direction'
                : speedAfter > speedBefore + 0.05
                  ? `adds ${(speedAfter - speedBefore).toFixed(1)} m/s of horizontal speed`
                  : speedAfter < speedBefore - 0.05
                    ? `removes ${(speedBefore - speedAfter).toFixed(1)} m/s of horizontal speed`
                    : 'leaves its horizontal speed almost unchanged'}
              {' '}and changes the spin from {spinBefore.toFixed(0)} to {spinAfter.toFixed(0)} rev/s.
            </Note>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="The incoming ball">
            <div className="flex flex-col gap-4">
              <Slider label="Speed" value={incoming.speed} min={1} max={22} step={0.5} unit="m/s" onChange={set('speed')} format={(v) => v.toFixed(1)} />
              <Slider label="Descent angle" value={incoming.descent} min={5} max={70} step={1} unit="°" onChange={set('descent')} />
              <Slider
                label="Spin"
                value={incoming.spin}
                min={-160}
                max={160}
                step={1}
                unit="rev/s"
                onChange={set('spin')}
                hint="positive topspin · negative backspin"
              />
            </div>
          </Panel>

          <Panel title="Does it grip or slide?">
            <div className="flex flex-col gap-3">
              <Chip tone={result.regime === 'grip' ? 'good' : 'warn'}>
                {result.regime === 'grip' ? 'GRIP — the table stops the slip' : 'SKID — the ball keeps sliding'}
              </Chip>

              <div className="grid grid-cols-2 gap-4">
                <Readout label="Bottom slip" value={Math.hypot(u.x, u.z).toFixed(2)} unit="m/s" tone="warn" />
                <Readout label="Friction limit" value={threshold.toFixed(2)} unit="m/s" tone="good" />
              </div>

              <Note>
                Compare the two speeds. If the slip is below the limit, friction stops it and
                the ball grips. Above the limit, the ball keeps skidding through contact.
              </Note>
            </div>
          </Panel>

          <Panel title="Model details">
            <div className="grid grid-cols-2 gap-4">
              <Readout label="Restitution" value={CONTACT.restitution.toFixed(2)} note="e — normal bounce" />
              <Readout label="Friction" value={CONTACT.friction.toFixed(2)} note="mu — ball on table" />
            </div>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <figure className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]">
            <figcaption className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] px-3 py-2">
              <span className="text-[length:var(--text-sm)] font-semibold text-[var(--ink-primary)]">
                The contact
              </span>
              <span className="text-[length:var(--text-xs)] text-[var(--ink-muted)]">
                vectors to scale · {PX_PER_MPS} px per m/s
              </span>
            </figcaption>
            <div className="p-2">
              <ContactDiagram velocity={before.velocity} spin={before.spin} result={result} />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--line)] px-3 py-2">
              <LegendItem color="var(--ink-secondary)" label="Velocity in" />
              <LegendItem color="var(--ink-primary)" label="Velocity out" />
              <LegendItem color="var(--status-warn)" label="Slip at the bottom (u)" />
              <LegendItem color="var(--force-drag)" label="Friction" />
            </div>
          </figure>

          <Panel title="What friction did">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Readout
                label="Horizontal speed"
                value={`${speedBefore.toFixed(1)} → ${speedAfter.toFixed(1)}`}
                unit="m/s"
                tone={speedAfter > speedBefore ? 'good' : 'default'}
              />
              <Readout
                label="Spin"
                value={`${spinBefore.toFixed(0)} → ${spinAfter.toFixed(0)}`}
                unit="rev/s"
              />
              <Readout label="Rebound angle" value={((Math.atan2(result.velocity.y, speedAfter) * 180) / Math.PI).toFixed(0)} unit="°" />
              <Readout
                label="Friction used"
                value={`${((Math.hypot(result.frictionImpulse.x, result.frictionImpulse.z) / result.frictionImpulseAvailable) * 100).toFixed(0)}`}
                unit="% of limit"
                tone={result.regime === 'slip' ? 'warn' : 'default'}
              />
            </div>

            <div className="mt-4 flex flex-col gap-3">
              <Note>{explainBounce(result)}</Note>
              {speedAfter > speedBefore && (
                <Chip tone="good">
                  The ball left the table faster than it arrived — r·ω exceeded v, so the patch
                  was moving backwards and friction pushed the ball forwards. This is the kick.
                </Chip>
              )}
              {result.velocity.z > 0 && (
                <Chip tone="accent">
                  The ball bounced backwards because friction removed all of its forward
                  speed and kept pushing.
                </Chip>
              )}
            </div>
          </Panel>

          <div className="grid gap-4 md:grid-cols-3">
            <Panel title="Exit speed" subtitle="horizontal, m/s · negative means it bounced back">
              <BounceSweep incoming={incoming} metric={(r) => horizontalSpeed(r.velocity) * Math.sign(-r.velocity.z || 1)} />
            </Panel>
            <Panel title="Exit spin" subtitle="topspin out, rev/s">
              <BounceSweep incoming={incoming} metric={(r, b) => componentsFromSpin(b.velocity, r.spin).topspin} />
            </Panel>
            <Panel title="Rebound angle" subtitle="degrees above horizontal">
              <BounceSweep incoming={incoming} metric={(r) => (Math.atan2(r.velocity.y, horizontalSpeed(r.velocity)) * 180) / Math.PI} />
            </Panel>
          </div>

          <Panel title="Try the spin sweep">
            <div className="flex flex-col gap-3">
              <Note>
                Start at −160 rev/s of backspin and move the spin slider to the right. The
                shaded band marks the spins that grip instead of skid. Watch each graph
                change slope at its edge.
              </Note>
              <Note>
                On the exit-speed graph, heavy backspin makes a flat section. Once the ball
                is skidding, extra backspin cannot make friction any stronger. The exit spin
                still changes, which is why the middle graph keeps moving.
              </Note>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
