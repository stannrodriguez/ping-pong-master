/**
 * Airflow around a spinning ball.
 *
 * These streamlines are traced through the analytic potential-flow solution for a
 * cylinder with circulation, not drawn by hand. That matters: the asymmetry a
 * reader sees — packed streamlines on one side, the stagnation points rotated
 * away from the horizontal, the wake deflected — is the actual solution to the
 * flow, so the picture cannot flatter the explanation.
 *
 * It is an idealization, and the UI says so. Real lift on a real ball comes from
 * asymmetric boundary-layer separation, not from ideal circulation. The
 * idealization gets the direction and the qualitative asymmetry exactly right and
 * the magnitude wrong, which is why the app takes its *numbers* from the measured
 * C_L fit in `physics/aero.ts` and takes only the *picture* from here.
 */

export interface FlowPoint {
  x: number;
  y: number;
}

/**
 * Complex velocity for uniform flow past a cylinder of radius `a` with
 * circulation `gamma`, from w(z) = U(z + a²/z) - i(Γ/2π)·ln z.
 *
 * Returns the physical velocity (u, v) at a point.
 */
export function flowVelocity(
  x: number,
  y: number,
  a: number,
  speed: number,
  gamma: number,
): FlowPoint {
  const r2 = x * x + y * y;
  if (r2 < 1e-9) return { x: 0, y: 0 };

  // U·(1 - a²/z²): with z² = (x²-y²) + i(2xy).
  const zr = x * x - y * y;
  const zi = 2 * x * y;
  const zAbs2 = zr * zr + zi * zi;
  const a2 = a * a;
  // a²/z² = a²·conj(z²)/|z²|²
  const invR = zAbs2 > 1e-12 ? a2 / zAbs2 : 0;
  const termR = speed * (1 - invR * zr);
  const termI = speed * (invR * zi);

  // -i·Γ/(2πz) = -i·Γ·conj(z)/(2π·r²)  =>  real: -Γ·y/(2πr²), imag: -Γ·x/(2πr²)
  const c = gamma / (2 * Math.PI * r2);
  const wr = termR - c * y;
  const wi = termI - c * x;

  // dw/dz = u - iv
  return { x: wr, y: -wi };
}

/**
 * Circulation implied by a spin ratio, from the no-slip condition on a rotating
 * cylinder: Γ = 2πa²ω = 2πa·U·S.
 */
export function circulationFor(a: number, speed: number, spinRatio: number): number {
  return 2 * Math.PI * a * speed * spinRatio;
}

/**
 * Trace one streamline forward from a starting point, stepping along the local
 * velocity with RK2 and stopping at the domain edge or on the cylinder.
 */
export function traceStreamline(
  start: FlowPoint,
  a: number,
  speed: number,
  gamma: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  step = 0.035,
  maxSteps = 900,
): FlowPoint[] {
  const points: FlowPoint[] = [start];
  let { x, y } = start;

  for (let i = 0; i < maxSteps; i++) {
    const v1 = flowVelocity(x, y, a, speed, gamma);
    const s1 = Math.hypot(v1.x, v1.y);
    if (s1 < 1e-6) break;

    // Midpoint step, normalised so arc length per step is constant regardless of
    // how fast the flow is locally — otherwise points bunch up near stagnation.
    const mx = x + (v1.x / s1) * step * 0.5;
    const my = y + (v1.y / s1) * step * 0.5;
    const v2 = flowVelocity(mx, my, a, speed, gamma);
    const s2 = Math.hypot(v2.x, v2.y);
    if (s2 < 1e-6) break;

    x += (v2.x / s2) * step;
    y += (v2.y / s2) * step;

    // Inside the cylinder is not part of the flow domain.
    if (x * x + y * y < a * a * 0.999) break;
    if (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY) break;

    points.push({ x, y });
  }

  return points;
}

/**
 * A full set of streamlines across the domain.
 *
 * Seeded on the inflow edge at even spacing. Where the flow accelerates the
 * traced lines crowd together on their own — the classic "closer streamlines mean
 * faster flow means lower pressure" reading is emergent here rather than drawn in.
 */
export function streamlineField(
  a: number,
  speed: number,
  gamma: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  count = 17,
): FlowPoint[][] {
  const lines: FlowPoint[][] = [];
  const span = bounds.maxY - bounds.minY;

  for (let i = 0; i < count; i++) {
    const y = bounds.minY + (span * (i + 0.5)) / count;
    // Seeding exactly on the centreline lands on the stagnation streamline, which
    // stalls the tracer; nudge it off.
    const seedY = Math.abs(y) < 1e-3 ? 1e-3 : y;
    lines.push(
      traceStreamline({ x: bounds.minX, y: seedY }, a, speed, gamma, bounds),
    );
  }

  return lines;
}

/**
 * Local flow speed relative to the free stream, sampled on a grid. Used to shade
 * the pressure field: by Bernoulli, faster flow is lower pressure.
 */
export function speedRatioAt(
  x: number,
  y: number,
  a: number,
  speed: number,
  gamma: number,
): number {
  if (x * x + y * y < a * a) return 1;
  const v = flowVelocity(x, y, a, speed, gamma);
  return Math.hypot(v.x, v.y) / speed;
}

/** Convert a traced streamline to an SVG path through a pixel transform. */
export function streamlinePath(
  line: FlowPoint[],
  toPixel: (p: FlowPoint) => { x: number; y: number },
): string {
  if (line.length < 2) return '';
  return line
    .map((p, i) => {
      const q = toPixel(p);
      return `${i === 0 ? 'M' : 'L'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
    })
    .join('');
}
