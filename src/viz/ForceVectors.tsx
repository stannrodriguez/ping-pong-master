import { type ForceBreakdown, type Vec3 } from '../physics';
import { PIXELS_PER_GRAVITY, WEIGHT, forceArrows, inWeights } from './forceScale';
import { project, type Projection, type ViewPlane } from './projection';

/**
 * Force vectors drawn on the ball, at the fixed 1-g-per-arrow-length scale
 * defined in `forceScale.ts`.
 */
export function ForceVectors({
  at,
  forces,
  projection,
  plane,
  showLabels = true,
}: {
  at: Vec3;
  forces: ForceBreakdown;
  projection: Projection;
  plane: ViewPlane;
  showLabels?: boolean;
}) {
  const origin = project(at, plane);
  const ox = projection.x(origin.h);
  const oy = projection.y(origin.v);

  return (
    <g>
      <defs>
        {forceArrows(forces).map((arrow) => (
          <marker
            key={`head-${arrow.key}`}
            id={`arrowhead-${arrow.key}`}
            viewBox="0 0 8 8"
            refX="6.5"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M0.5 0.8 L7 4 L0.5 7.2 z" fill={arrow.color} />
          </marker>
        ))}
      </defs>

      {/*
        Longest first, so a shorter arrow is never buried under a longer collinear
        one. Gravity and Magnus point along exactly the same line for pure topspin
        or backspin, and which of the two is longer flips as spin rises past 1 g.
      */}
      {forceArrows(forces)
        .map((arrow, index) => ({ arrow, index }))
        .sort((a, b) => inWeights(b.arrow.force) - inWeights(a.arrow.force))
        .map(({ arrow, index }) => {
        // Project the force the same way the position is projected, so an arrow
        // drawn on the side view really is the in-plane part of that force.
        const tip = project(arrow.force, plane);
        const scale = PIXELS_PER_GRAVITY / WEIGHT;
        // Side view: +v is up in world, and projection.y already flips it.
        const dx = tip.h * scale;
        const dy = -tip.v * scale;
        const length = Math.hypot(dx, dy);

        // Below a few pixels an arrow is noise, not information.
        if (length < 3) return null;

        const magnitude = inWeights(arrow.force);

        return (
          <g key={arrow.key}>
            <line
              x1={ox}
              y1={oy}
              x2={ox + dx}
              y2={oy + dy}
              stroke={arrow.color}
              strokeWidth={2.5}
              strokeLinecap="butt"
              markerEnd={`url(#arrowhead-${arrow.key})`}
            />
            {showLabels && length > 20 && (() => {
              // Labels sit beside the arrow's midpoint, offset along its normal and
              // flipped side by side. Gravity and Magnus are exactly collinear
              // whenever the spin is pure topspin, so an end-of-arrow label would
              // put two numbers on top of each other precisely when the diagram
              // matters most.
              const nx = -dy / length;
              const ny = dx / length;
              // Gravity goes on one side, the aerodynamic pair on the other.
              // Gravity and Magnus are exactly collinear for pure topspin or
              // backspin, and drag is perpendicular to Magnus by construction, so
              // this split is the one that never lets two labels stack.
              // Wide enough that two ~30px labels on opposite sides of a vertical
              // arrow clear each other completely.
              const offset = 26 * (index === 0 ? -1 : 1);
              return (
                <text
                  x={ox + dx * 0.55 + nx * offset}
                  y={oy + dy * 0.55 + ny * offset + 3.5}
                  textAnchor="middle"
                  fill={arrow.color}
                  className="tnum"
                  // A halo in the surface colour keeps the number legible where it
                  // crosses a trajectory or a grid line.
                  stroke="var(--surface-1)"
                  strokeWidth={3}
                  paintOrder="stroke"
                  style={{ fontSize: 10 }}
                >
                  {magnitude.toFixed(2)}g
                </text>
              );
            })()}
          </g>
        );
      })}
    </g>
  );
}

/**
 * The scale bar for the arrows above. Present on every view that draws forces,
 * because an arrow without a scale is decoration.
 */
export function ForceScaleKey() {
  return (
    <span className="inline-flex items-center gap-2 text-[length:var(--text-xs)] text-[var(--ink-muted)]">
      <svg width={PIXELS_PER_GRAVITY + 2} height="10" aria-hidden>
        <line
          x1="1"
          y1="5"
          x2={PIXELS_PER_GRAVITY}
          y2="5"
          stroke="var(--ink-muted)"
          strokeWidth="2"
        />
        <line x1="1" y1="1" x2="1" y2="9" stroke="var(--ink-muted)" strokeWidth="1.5" />
        <line
          x1={PIXELS_PER_GRAVITY}
          y1="1"
          x2={PIXELS_PER_GRAVITY}
          y2="9"
          stroke="var(--ink-muted)"
          strokeWidth="1.5"
        />
      </svg>
      = 1 g (the ball&rsquo;s own weight)
    </span>
  );
}

/**
 * A compact picture of the spin axis: the ball seen from the side, with the
 * rotation direction marked. Answers "which way is this thing actually turning",
 * which no amount of rev/s in a readout ever does.
 */
export function SpinDial({
  topspinRps,
  sidespinRps,
  size = 64,
}: {
  topspinRps: number;
  sidespinRps: number;
  size?: number;
}) {
  const r = size / 2 - 9;
  const cx = size / 2;
  const cy = size / 2;
  const rate = Math.hypot(topspinRps, sidespinRps);
  // Pure topspin turns about a *horizontal* axis running across the table; pure
  // sidespin turns about a vertical one. The rake sweeps between them.
  const rake = Math.atan2(sidespinRps, topspinRps);
  const ax = Math.cos(rake) * r * 1.25;
  const ay = -Math.sin(rake) * r * 1.25;

  return (
    <svg width={size} height={size} role="img" aria-label={`Spin axis, ${rate.toFixed(0)} rev/s`}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--line-strong)" strokeWidth="1.5" />
      {rate > 0.5 && (
        <>
          <defs>
            <marker
              id="spin-tip"
              viewBox="0 0 8 8"
              refX="6"
              refY="4"
              markerWidth="4.5"
              markerHeight="4.5"
              orient="auto"
            >
              <path d="M0.5 0.8 L7 4 L0.5 7.2 z" fill="var(--ink-primary)" />
            </marker>
          </defs>

          {/* The rotation axis. */}
          <line
            x1={cx - ax}
            y1={cy - ay}
            x2={cx + ax}
            y2={cy + ay}
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/*
            Which way the surface is moving, drawn as two short arrows tangent to
            the ball on opposite sides. This is the quantity that matters for both
            the Magnus force and the bounce, and no number of rev/s conveys it.
          */}
          {[1, -1].map((sign) => {
            // Point on the rim, perpendicular to the axis.
            const px = cx + -Math.sin(rake) * r * sign;
            const py = cy + -Math.cos(rake) * r * sign;
            // Tangent = along the axis direction, reversed on the far side.
            const dir = Math.sign(topspinRps || sidespinRps) * sign;
            const tx = Math.cos(rake) * 9 * dir;
            const ty = -Math.sin(rake) * 9 * dir;
            return (
              <line
                key={sign}
                x1={px - tx}
                y1={py - ty}
                x2={px + tx}
                y2={py + ty}
                stroke="var(--ink-primary)"
                strokeWidth="1.5"
                markerEnd="url(#spin-tip)"
              />
            );
          })}
        </>
      )}
    </svg>
  );
}
