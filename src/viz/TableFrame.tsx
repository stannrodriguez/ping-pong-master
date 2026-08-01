import { BALL, TABLE, TABLE_HALF_LENGTH, TABLE_HALF_WIDTH } from '../physics';
import { TABLE_GEOMETRY, ticks, type Projection, type ViewPlane } from './projection';

/**
 * The table, drawn to scale, with a metre grid.
 *
 * Shared by every view in the app so that a distance measured on one chart means
 * the same thing on the next. The grid is deliberately recessive — it exists so a
 * reader can measure the ball's path against something real, not to be looked at.
 */
export function TableFrame({
  projection,
  plane,
  showGrid = true,
  showNet = true,
}: {
  projection: Projection;
  plane: ViewPlane;
  showGrid?: boolean;
  showNet?: boolean;
}) {
  const { x, y, horizontal, vertical } = projection;

  return (
    <g aria-hidden>
      {showGrid && (
        <g className="viz-grid">
          {ticks(horizontal, 8).map((h) => (
            <line key={`h${h}`} x1={x(h)} y1={y(vertical.max)} x2={x(h)} y2={y(vertical.min)} />
          ))}
          {ticks(vertical, plane === 'side' ? 5 : 4).map((v) => (
            <line key={`v${v}`} x1={x(horizontal.min)} y1={y(v)} x2={x(horizontal.max)} y2={y(v)} />
          ))}
        </g>
      )}

      {plane === 'side' ? <SideTable projection={projection} showNet={showNet} /> : null}
      {plane === 'plan' ? <PlanTable projection={projection} showNet={showNet} /> : null}
    </g>
  );
}

function SideTable({ projection, showNet }: { projection: Projection; showNet: boolean }) {
  const { x, y } = projection;
  const { surface, net } = TABLE_GEOMETRY.side;
  // Views negate z so the shot reads left-to-right, so the near end (+z) is at
  // the *left* of the drawing and appears as -h.
  const left = x(-surface.to);
  const right = x(-surface.from);
  const surfaceY = y(0);

  return (
    <g>
      {/* Playing surface, with the table's own thickness suggested beneath it. */}
      <rect
        x={left}
        y={surfaceY}
        width={right - left}
        height={Math.max(3, projection.len(0.025))}
        fill="var(--surface-3)"
      />
      <line x1={left} y1={surfaceY} x2={right} y2={surfaceY} stroke="var(--line-strong)" strokeWidth={2} />

      {showNet && (
        <line
          x1={x(net.h)}
          y1={surfaceY}
          x2={x(net.h)}
          y2={y(TABLE.netHeight)}
          stroke="var(--ink-muted)"
          strokeWidth={2}
        />
      )}
    </g>
  );
}

function PlanTable({ projection, showNet }: { projection: Projection; showNet: boolean }) {
  const { x, y } = projection;
  const left = x(-TABLE_HALF_LENGTH);
  const right = x(TABLE_HALF_LENGTH);
  const top = y(TABLE_HALF_WIDTH);
  const bottom = y(-TABLE_HALF_WIDTH);

  return (
    <g>
      <rect
        x={left}
        y={top}
        width={right - left}
        height={bottom - top}
        fill="var(--surface-2)"
        stroke="var(--line-strong)"
        strokeWidth={1.5}
        rx={2}
      />
      {/* Centre service line. */}
      <line x1={left} y1={y(0)} x2={right} y2={y(0)} stroke="var(--line)" strokeWidth={1} />
      {showNet && (
        <line
          x1={x(0)}
          y1={y(TABLE_HALF_WIDTH + TABLE.netOverhang)}
          x2={x(0)}
          y2={y(-TABLE_HALF_WIDTH - TABLE.netOverhang)}
          stroke="var(--ink-muted)"
          strokeWidth={2}
        />
      )}
    </g>
  );
}

/**
 * Axis labels in metres. Kept separate from the frame so a dense view can drop
 * them without losing the grid it measures against.
 */
export function ScaleLabels({
  projection,
  plane,
}: {
  projection: Projection;
  plane: ViewPlane;
}) {
  const { x, y, horizontal, vertical } = projection;

  return (
    <g aria-hidden>
      {ticks(horizontal, 8).map((h) => (
        <text key={`hl${h}`} x={x(h)} y={y(vertical.min) + 14} textAnchor="middle" className="viz-label">
          {h === 0 ? 'net' : `${h > 0 ? '' : ''}${h.toFixed(1)}`}
        </text>
      ))}
      {plane === 'side' &&
        ticks(vertical, 5)
          .filter((v) => v >= 0)
          .map((v) => (
            <text key={`vl${v}`} x={x(horizontal.min) - 6} y={y(v) + 3} textAnchor="end" className="viz-label">
              {v.toFixed(1)}
            </text>
          ))}
    </g>
  );
}

/** The ball, drawn at its true 40 mm diameter. */
export function Ball({
  cx,
  cy,
  projection,
  color = 'var(--ink-primary)',
  emphasis = false,
}: {
  cx: number;
  cy: number;
  projection: Projection;
  color?: string;
  emphasis?: boolean;
}) {
  // Never smaller than 3px or it stops reading as a ball on a zoomed-out view.
  const r = Math.max(3, projection.len(BALL.radius));
  return (
    <g>
      {emphasis && <circle cx={cx} cy={cy} r={r * 2.6} fill={color} opacity={0.14} />}
      <circle cx={cx} cy={cy} r={r} fill={color} stroke="var(--surface-1)" strokeWidth={1.5} />
    </g>
  );
}
