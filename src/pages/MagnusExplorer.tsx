import { useMemo, useState } from 'react';

import {
  BALL,
  dragCoefficient,
  liftCoefficient,
  magnusForce,
  rpsToRadPerSec,
  spinFromComponents,
  spinRatio,
  v3,
} from '../physics';
import { PageHeader } from '../ui/AppShell';
import { Chip, LegendItem, Note, Panel, Readout, Slider } from '../ui/controls';
import { inWeights } from '../viz/forceScale';
import { circulationFor, streamlineField, streamlinePath } from '../viz/streamlines';
import { ticks } from '../viz/projection';
import { useSize } from '../viz/useSize';

/** Domain of the flow picture, in ball radii. */
const BOUNDS = { minX: -3.4, maxX: 4.6, minY: -2.2, maxY: 2.2 };

/**
 * The flow picture: air moving right-to-left past a stationary ball, which is the
 * same thing as a ball moving left-to-right through still air. Every other view
 * in the app draws the ball travelling to the right, so this one does too.
 */
function FlowField({ spinRatioValue, topspin }: { spinRatioValue: number; topspin: boolean }) {
  const { ref, width, height } = useSize();

  // Positive circulation for topspin puts the fast side underneath, which is what
  // pushes the ball down. Flipping the sign flips the whole picture.
  const gamma = circulationFor(1, 1, spinRatioValue * (topspin ? 1 : -1));

  const toPixel = useMemo(() => {
    const scale = Math.min(
      width / (BOUNDS.maxX - BOUNDS.minX),
      height / (BOUNDS.maxY - BOUNDS.minY),
    );
    const cx = width / 2 + ((BOUNDS.maxX + BOUNDS.minX) / 2) * scale;
    const cy = height / 2;
    return {
      // The x axis is mirrored on purpose. The flow solution is computed with the
      // air moving in +x past a stationary ball, which is a ball travelling in -x.
      // Every other view in this app draws the ball travelling to the right, so
      // the picture is mirrored to match: air flows left, ball travels right.
      // Mirroring leaves y untouched, so the fast side — and therefore the force —
      // stays exactly where the solution put it.
      fn: (p: { x: number; y: number }) => ({ x: cx - p.x * scale, y: cy - p.y * scale }),
      scale,
      cx,
      cy,
    };
  }, [width, height]);

  const lines = useMemo(
    () => streamlineField(1, 1, gamma, BOUNDS, 19),
    [gamma],
  );

  if (width === 0) {
    return <div ref={ref} className="aspect-[16/9] w-full" />;
  }

  const ballR = toPixel.scale;
  const { cx, cy } = toPixel;

  return (
    <div ref={ref} className="aspect-[16/9] w-full">
      <svg width={width} height={height} role="img" aria-label="Airflow around a spinning ball">
        <defs>
          <marker id="flow-tip" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="4" markerHeight="4" orient="auto">
            <path d="M0.5 1 L6.5 4 L0.5 7 z" fill="var(--ink-muted)" />
          </marker>
        </defs>

        {lines.map((line, i) => (
          <path
            key={i}
            d={streamlinePath(line, toPixel.fn)}
            fill="none"
            stroke="var(--ink-muted)"
            strokeWidth={1.25}
            opacity={0.75}
          />
        ))}

        {/*
          Direction markers on a few lines only. `markerMid` would put an arrowhead
          on every traced vertex — one every 0.035 radii — which renders the
          streamlines as dotted lines and hides the thing they exist to show.
        */}
        {lines.map((line, i) => {
          if (i % 4 !== 1 || line.length < 12) return null;
          const at = Math.floor(line.length * 0.12);
          const a = toPixel.fn(line[at]);
          const b = toPixel.fn(line[at + 6]);
          return (
            <line
              key={`dir${i}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--ink-secondary)"
              strokeWidth={1.5}
              markerEnd="url(#flow-tip)"
            />
          );
        })}

        {/* The ball, with its surface motion. */}
        <circle cx={cx} cy={cy} r={ballR} fill="var(--surface-2)" stroke="var(--line-strong)" strokeWidth={2} />

        {spinRatioValue > 0.02 && (
          <>
            <path
              d={describeArc(cx, cy, ballR * 0.62, topspin)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              markerEnd="url(#spin-arrow)"
            />
            <defs>
              <marker id="spin-arrow" viewBox="0 0 8 8" refX="5" refY="4" markerWidth="5" markerHeight="5" orient="auto">
                <path d="M0.5 0.8 L7 4 L0.5 7.2 z" fill="var(--accent)" />
              </marker>
            </defs>
          </>
        )}

        {/* Which way the surface moves at top and bottom — the thing that matters. */}
        <SurfaceLabel
          x={cx}
          y={cy - ballR - 26}
          fast={!topspin}
        />
        <SurfaceLabel
          x={cx}
          y={cy + ballR + 26}
          fast={topspin}
        />

        {/* The resulting force. */}
        {spinRatioValue > 0.02 && (
          <g>
            <line
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy + (topspin ? 1 : -1) * ballR * 2.1}
              stroke="var(--force-magnus)"
              strokeWidth={3}
              markerEnd="url(#magnus-tip)"
            />
            <defs>
              <marker id="magnus-tip" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="4.5" markerHeight="4.5" orient="auto">
                <path d="M0.5 0.8 L7 4 L0.5 7.2 z" fill="var(--force-magnus)" />
              </marker>
            </defs>
            <text
              x={cx + 10}
              y={cy + (topspin ? 1 : -1) * ballR * 1.7}
              fill="var(--force-magnus)"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              Magnus force
            </text>
          </g>
        )}

        <text x={16} y={height - 10} className="viz-label">
          ← air flow (the ball is travelling →)
        </text>
      </svg>
    </div>
  );
}

/**
 * Two short lines rather than one long one — a sentence stretched across the whole
 * diagram reads as a caption, not as a label attached to that side of the ball.
 */
function SurfaceLabel({ x, y, fast }: { x: number; y: number; fast: boolean }) {
  const color = fast ? 'var(--status-good)' : 'var(--status-warn)';
  const lines = fast
    ? ['surface moves WITH the flow', 'faster flow · lower pressure']
    : ['surface moves AGAINST the flow', 'early separation · higher pressure'];

  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      fill={color}
      stroke="var(--surface-1)"
      strokeWidth={3.5}
      paintOrder="stroke"
      style={{ fontSize: 11 }}
    >
      <tspan x={x} dy={0} style={{ fontWeight: 600 }}>
        {lines[0]}
      </tspan>
      <tspan x={x} dy={13} opacity={0.85}>
        {lines[1]}
      </tspan>
    </text>
  );
}

function describeArc(cx: number, cy: number, r: number, clockwise: boolean) {
  // Three-quarter arc, so the arrowhead reads as a rotation direction.
  const start = -Math.PI * 0.75;
  const end = start + (clockwise ? 1 : -1) * Math.PI * 1.5;
  const p = (angle: number) => `${cx + r * Math.cos(angle)} ${cy + r * Math.sin(angle)}`;
  return `M${p(start)} A ${r} ${r} 0 1 ${clockwise ? 1 : 0} ${p(end)}`;
}

/**
 * C_L against spin ratio, with the current operating point marked. Saturation is
 * the whole point: doubling the spin on an already-heavy ball buys almost nothing,
 * which is why elite players add spin by *slowing the ball down*, not by brushing
 * harder.
 */
function LiftCurve({ current }: { current: number }) {
  const { ref, width, height } = useSize();
  const maxS = 3;
  const maxCl = 0.4;

  if (width === 0) return <div ref={ref} className="aspect-[16/10] w-full" />;

  const pad = { top: 12, right: 14, bottom: 26, left: 34 };
  const px = (s: number) => pad.left + (s / maxS) * (width - pad.left - pad.right);
  const py = (cl: number) => height - pad.bottom - (cl / maxCl) * (height - pad.top - pad.bottom);

  const curve = Array.from({ length: 120 }, (_, i) => {
    const s = (i / 119) * maxS;
    return `${i === 0 ? 'M' : 'L'}${px(s).toFixed(1)} ${py(liftCoefficient(s)).toFixed(1)}`;
  }).join('');

  return (
    <div ref={ref} className="aspect-[16/10] w-full">
      <svg width={width} height={height} role="img" aria-label="Lift coefficient against spin ratio">
        <g className="viz-grid">
          {ticks({ min: 0, max: maxCl }, 4).map((cl) => (
            <line key={cl} x1={pad.left} y1={py(cl)} x2={width - pad.right} y2={py(cl)} />
          ))}
        </g>
        {ticks({ min: 0, max: maxCl }, 4).map((cl) => (
          <text key={cl} x={pad.left - 6} y={py(cl) + 3} textAnchor="end" className="viz-label">
            {cl.toFixed(1)}
          </text>
        ))}
        {ticks({ min: 0, max: maxS }, 6).map((s) => (
          <text key={s} x={px(s)} y={height - 9} textAnchor="middle" className="viz-label">
            {s.toFixed(0)}
          </text>
        ))}

        <path d={curve} fill="none" stroke="var(--force-magnus)" strokeWidth={2.5} />

        <line
          x1={px(Math.min(current, maxS))}
          y1={pad.top}
          x2={px(Math.min(current, maxS))}
          y2={height - pad.bottom}
          stroke="var(--accent)"
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <circle
          cx={px(Math.min(current, maxS))}
          cy={py(liftCoefficient(current))}
          r={5}
          fill="var(--accent)"
          stroke="var(--surface-1)"
          strokeWidth={2}
        />

        <text x={width - pad.right} y={py(maxCl) + 12} textAnchor="end" className="viz-label">
          C_L
        </text>
        <text x={width / 2} y={height - 9} textAnchor="middle" className="viz-label">
          spin ratio S = r·ω / v
        </text>
      </svg>
    </div>
  );
}

export function MagnusExplorer() {
  const [rate, setRate] = useState(80);
  const [speed, setSpeed] = useState(10);
  const [topspin, setTopspin] = useState(true);

  const velocity = v3(0, 0, -speed);
  const spin = spinFromComponents(velocity, {
    topspin: topspin ? rate : -rate,
    sidespin: 0,
    corkscrew: 0,
  });

  const S = spinRatio(velocity, spin);
  const force = magnusForce(velocity, spin);
  const surfaceSpeed = BALL.radius * rpsToRadPerSec(rate);

  return (
    <>
      <PageHeader title="Magnus Explorer" question="Why does spin bend the ball's flight?" />

      <div className="grid gap-4 p-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="lg:col-span-2">
          <Panel title="The short answer">
            <Note>
              {topspin
                ? 'Topspin makes the airflow faster under the ball, so the pressure difference pushes it down.'
                : 'Backspin makes the airflow faster above the ball, so the pressure difference pushes it up.'}{' '}
              At these settings, the Magnus force is {inWeights(force).toFixed(2)} times the
              ball's weight.
            </Note>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <Panel title="The ball">
            <div className="flex flex-col gap-4">
              <Slider label="Spin rate" value={rate} min={0} max={160} step={1} unit="rev/s" onChange={setRate} />
              <Slider label="Ball speed" value={speed} min={2} max={25} step={0.5} unit="m/s" onChange={setSpeed} format={(v) => v.toFixed(1)} />
              <label className="flex items-center justify-between text-[length:var(--text-sm)] text-[var(--ink-secondary)]">
                Direction
                <button
                  onClick={() => setTopspin((t) => !t)}
                  className="cursor-pointer rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-[var(--ink-primary)]"
                >
                  {topspin ? 'Topspin' : 'Backspin'}
                </button>
              </label>
            </div>
          </Panel>

          <Panel title="Spin compared with speed">
            <div className="grid grid-cols-2 gap-4">
              <Readout label="Ratio" value={S.toFixed(2)} tone="accent" note="S = r·ω / v" />
              <Readout label="Ball surface" value={surfaceSpeed.toFixed(1)} unit="m/s" note="r·ω" />
              <Readout label="Magnus force" value={inWeights(force).toFixed(2)} unit="g" tone="accent" />
            </div>
            <div className="mt-3">
              <Note>
                Keep spin at {rate.toFixed(0)} rev/s and move <strong>Ball speed</strong>.
                The ratio falls as the ball gets faster: the same spin matters less relative
                to the speed of the shot.
              </Note>
            </div>
          </Panel>

          <Panel title="Model details">
            <div className="grid grid-cols-2 gap-4">
              <Readout label="Lift coefficient" value={liftCoefficient(S).toFixed(3)} note="C_L(S)" />
              <Readout label="Drag coefficient" value={dragCoefficient(S).toFixed(3)} note="C_D(S)" />
            </div>
            <p className="mt-3 text-[length:var(--text-xs)] leading-relaxed text-[var(--ink-muted)]">
              Spin also raises drag slightly. At the same launch speed, a spinning ball
              loses a little more speed in the air than a no-spin ball.
            </p>
          </Panel>
        </div>

        <div className="flex flex-col gap-4">
          <figure className="rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)]">
            <figcaption className="flex items-baseline justify-between gap-3 border-b border-[var(--line)] px-3 py-2">
              <span className="text-[length:var(--text-sm)] font-semibold text-[var(--ink-primary)]">
                Airflow, seen from the ball
              </span>
              <span className="text-[length:var(--text-xs)] text-[var(--ink-muted)]">
                line spacing shows relative airflow speed
              </span>
            </figcaption>
            <div className="p-2">
              <FlowField spinRatioValue={S} topspin={topspin} />
            </div>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--line)] px-3 py-2">
              <LegendItem color="var(--ink-muted)" label="Streamline" detail="closer together = faster" />
              <LegendItem color="var(--force-magnus)" label="Net force" />
              <LegendItem color="var(--accent)" label="Rotation" />
            </div>
          </figure>

          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="How to read the airflow">
              <div className="flex flex-col gap-3">
                <Note>
                  The ball drags a thin layer of air around with it. On one side that layer
                  moves <em>with</em> the oncoming air and the flow stays attached and
                  speeds up; on the other it moves <em>against</em> it and separates early.
                  Faster flow means lower pressure, so the ball is pushed toward the fast
                  side. For topspin, that side is underneath.
                </Note>
                <p className="text-[length:var(--text-xs)] leading-relaxed text-[var(--ink-muted)]">
                  What this picture leaves out: the streamlines show the correct direction
                  and asymmetry, but not the force magnitude. The force readout uses measured
                  table-tennis-ball data.
                </p>
              </div>
            </Panel>

            <Panel title="Where extra spin stops helping" subtitle="The curve flattens as the ratio rises">
              <LiftCurve current={S} />
              <div className="mt-2 flex flex-wrap gap-2">
                <Chip tone="accent">S = {S.toFixed(2)}</Chip>
                <Chip>
                  {S < 0.3
                    ? 'Low ratio — spin has little effect'
                    : S < 1
                      ? 'Steep part — more spin still matters'
                      : 'Flat part — more spin adds little lift'}
                </Chip>
              </div>
              <div className="mt-3">
                <Note>
                  Because S compares surface speed with ball speed, you can raise it by
                  adding spin or by slowing the shot. Hold the spin steady and move the
                  speed slider to see the ratio change.
                </Note>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}
