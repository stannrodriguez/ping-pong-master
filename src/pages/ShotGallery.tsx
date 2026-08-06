import { useMemo, useState } from 'react';

import {
  SHOTS,
  componentsFromSpin,
  launchOf,
  measure,
  simulate,
  spinRatio,
  withoutSpin,
  type ShotPreset,
} from '../physics';
import { PageHeader } from '../ui/AppShell';
import { Chip, Note, Panel } from '../ui/controls';
import { Ball, TableFrame } from '../viz/TableFrame';
import { fitProjection, formatLength, pathFrom, sideViewExtents } from '../viz/projection';
import { useSize } from '../viz/useSize';

/**
 * One shot, drawn small, against its own no-spin baseline. Small multiples on a
 * shared scale: the shots can be compared by eye precisely because none of them
 * has been individually framed to look its best.
 */
function ShotCard({
  shot,
  selected,
  onSelect,
}: {
  shot: ShotPreset;
  selected: boolean;
  onSelect: () => void;
}) {
  const { ref, width, height } = useSize();

  const { spun, plain } = useMemo(() => {
    const launch = launchOf(shot);
    return {
      spun: simulate(launch, { maxBounces: 2 }),
      plain: simulate(withoutSpin(launch), { maxBounces: 2 }),
    };
  }, [shot]);

  const projection = useMemo(() => {
    const { horizontal, vertical } = sideViewExtents(0.3, 0.9);
    return fitProjection(
      { width, height, padding: { top: 8, right: 8, bottom: 8, left: 8 } },
      horizontal,
      vertical,
    );
  }, [width, height]);

  return (
    <button
      onClick={onSelect}
      className="rounded-[var(--radius-lg)] border bg-[var(--surface-1)] p-2 text-left transition-colors"
      style={{
        borderColor: selected ? 'var(--accent)' : 'var(--line)',
        background: selected ? 'var(--surface-2)' : 'var(--surface-1)',
      }}
    >
      <div className="flex items-baseline justify-between gap-2 px-1 pb-1">
        <span className="text-[length:var(--text-sm)] font-semibold text-[var(--ink-primary)]">
          {shot.name}
        </span>
        <span className="tnum text-[length:var(--text-xs)] text-[var(--ink-muted)]">
          {shot.speed} m/s
        </span>
      </div>

      <div ref={ref} className="aspect-[22/7] w-full">
        {width > 0 && (
          <svg width={width} height={height} aria-hidden>
            <defs>
              <clipPath id={`sc-${shot.id}`}>
                <rect x="0" y="0" width={width} height={height} />
              </clipPath>
            </defs>
            <TableFrame projection={projection} plane="side" showGrid={false} />
            <g clipPath={`url(#sc-${shot.id})`}>
              <path
                d={pathFrom(plain.samples.map((s) => s.position), 'side', projection)}
                fill="none"
                stroke="var(--spin-none)"
                strokeWidth={1.25}
                strokeDasharray="3 3"
                opacity={0.7}
              />
              <path
                d={pathFrom(spun.samples.map((s) => s.position), 'side', projection)}
                fill="none"
                stroke={shot.color}
                strokeWidth={2}
                strokeLinecap="round"
              />
              {spun.landing && (
                <Ball
                  cx={projection.x(-spun.landing.z)}
                  cy={projection.y(spun.landing.y)}
                  projection={projection}
                  color={shot.color}
                />
              )}
            </g>
          </svg>
        )}
      </div>
    </button>
  );
}

interface Row {
  shot: ShotPreset;
  spinRps: number;
  S: number;
  netClearance?: number;
  apex: number;
  duration: number;
  landing?: number;
  shiftAlong?: number;
  bounceRegime?: string;
  kick?: number;
}

type SortKey = 'name' | 'speed' | 'spin' | 'S' | 'net' | 'apex' | 'time' | 'shift' | 'kick';

export function ShotGallery() {
  const [selectedId, setSelectedId] = useState(SHOTS[0].id);
  const [sortKey, setSortKey] = useState<SortKey>('name');

  /** Everything in the table is measured by running the shot, never written down. */
  const rows: Row[] = useMemo(
    () =>
      SHOTS.map((shot) => {
        const launch = launchOf(shot);
        const metrics = measure(launch, { maxBounces: 2 });
        const trajectory = simulate(launch, { maxBounces: 2 });
        const bounce = trajectory.events.find((e) => e.kind === 'bounce')?.bounce;

        let kick: number | undefined;
        if (bounce) {
          const before = Math.hypot(
            bounce.velocity.x - bounce.frictionImpulse.x / 0.0027,
            bounce.velocity.z - bounce.frictionImpulse.z / 0.0027,
          );
          kick = Math.hypot(bounce.velocity.x, bounce.velocity.z) - before;
        }

        return {
          shot,
          spinRps: componentsFromSpin(launch.velocity, launch.spin).topspin,
          S: spinRatio(launch.velocity, launch.spin),
          netClearance: metrics.netClearance,
          apex: metrics.apex,
          duration: metrics.duration,
          landing: metrics.landing?.z,
          shiftAlong: metrics.landingShift?.alongTable,
          bounceRegime: bounce?.regime,
          kick,
        };
      }),
    [],
  );

  const sorted = useMemo(() => {
    const value = (row: Row): number | string => {
      switch (sortKey) {
        case 'speed': return -row.shot.speed;
        case 'spin': return -Math.abs(row.spinRps);
        case 'S': return -row.S;
        case 'net': return -(row.netClearance ?? -1);
        case 'apex': return -row.apex;
        case 'time': return row.duration;
        case 'shift': return -Math.abs(row.shiftAlong ?? 0);
        case 'kick': return -(row.kick ?? -99);
        default: return row.shot.name;
      }
    };
    return [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      return typeof va === 'string' ? String(va).localeCompare(String(vb)) : (va as number) - (vb as number);
    });
  }, [rows, sortKey]);

  const selected = rows.find((row) => row.shot.id === selectedId)!;

  const columns: Array<{ key: SortKey; label: string; render: (row: Row) => string; title: string }> = [
    { key: 'name', label: 'Shot', title: 'Stroke name', render: (r) => r.shot.name },
    { key: 'speed', label: 'Speed', title: 'Launch speed, m/s', render: (r) => `${r.shot.speed.toFixed(1)}` },
    { key: 'spin', label: 'Spin', title: 'Topspin at launch, rev/s (negative is backspin)', render: (r) => r.spinRps.toFixed(0) },
    { key: 'S', label: 'S', title: 'Spin ratio r·ω/v at launch', render: (r) => r.S.toFixed(2) },
    { key: 'net', label: 'Net', title: 'Clearance over the net', render: (r) => (r.netClearance == null ? '—' : `${(r.netClearance * 100).toFixed(0)} cm`) },
    { key: 'apex', label: 'Apex', title: 'Highest point above the surface', render: (r) => `${(r.apex * 100).toFixed(0)} cm` },
    { key: 'time', label: 'Time', title: 'Flight time to the far bounce, s', render: (r) => r.duration.toFixed(2) },
    { key: 'shift', label: 'Spin moved it', title: 'How far the touchdown point moved compared with the same shot with no spin', render: (r) =>
      // Spelled out rather than signed: +z is toward the net, so a positive shift
      // means the ball landed *shorter*, and a bare "+43 cm" reads as the opposite.
      r.shiftAlong == null
        ? 'never lands'
        : `${formatLength(Math.abs(r.shiftAlong))} ${r.shiftAlong > 0 ? 'shorter' : 'longer'}` },
    { key: 'kick', label: 'Bounce', title: 'Change in horizontal speed across the bounce', render: (r) => (r.kick == null ? '—' : `${r.kick > 0 ? '+' : ''}${r.kick.toFixed(1)} m/s`) },
  ];

  return (
    <>
      <PageHeader title="Shot Gallery" question="How do familiar strokes differ in speed, spin and bounce?" />

      <div className="flex flex-col gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SHOTS.map((shot) => (
            <ShotCard
              key={shot.id}
              shot={shot}
              selected={shot.id === selectedId}
              onSelect={() => setSelectedId(shot.id)}
            />
          ))}
        </div>

        <Panel title={selected.shot.name} subtitle={selected.shot.summary}>
          <div className="flex flex-col gap-3">
            <Note>{selected.shot.mechanism}</Note>
            <div className="flex flex-wrap gap-2">
              <Chip tone="accent">S = {selected.S.toFixed(2)}</Chip>
              <Chip>{selected.spinRps >= 0 ? 'Topspin' : 'Backspin'} {Math.abs(selected.spinRps).toFixed(0)} rev/s</Chip>
              {selected.bounceRegime && (
                <Chip tone={selected.bounceRegime === 'grip' ? 'good' : 'warn'}>
                  Bounce {selected.bounceRegime === 'grip' ? 'grips' : 'slides'}
                </Chip>
              )}
              {selected.kick != null && selected.kick > 0 && (
                <Chip tone="good">Speeds up {selected.kick.toFixed(1)} m/s off the table</Chip>
              )}
              {selected.shiftAlong == null && (
                <Chip tone="warn">Without its spin this shot never reaches the table</Chip>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title="Measured outcomes"
          subtitle="Click a column heading to compare the shots by that measurement."
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[length:var(--text-sm)]">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      title={column.title}
                      onClick={() => setSortKey(column.key)}
                      className="cursor-pointer whitespace-nowrap border-b border-[var(--line-strong)] px-2 py-2 text-left text-[length:var(--text-xs)] font-semibold uppercase tracking-wider"
                      style={{ color: sortKey === column.key ? 'var(--accent)' : 'var(--ink-muted)' }}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row) => (
                  <tr
                    key={row.shot.id}
                    onClick={() => setSelectedId(row.shot.id)}
                    className="cursor-pointer border-b border-[var(--line)] hover:bg-[var(--surface-2)]"
                    style={{ background: row.shot.id === selectedId ? 'var(--surface-2)' : undefined }}
                  >
                    {columns.map((column) => (
                      <td
                        key={column.key}
                        className={`whitespace-nowrap px-2 py-2 ${column.key === 'name' ? '' : 'tnum'}`}
                        style={{
                          color: column.key === 'name' ? 'var(--ink-primary)' : 'var(--ink-secondary)',
                        }}
                      >
                        {column.key === 'name' && (
                          <span
                            className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                            style={{ background: row.shot.color }}
                          />
                        )}
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <Note>
              Sort by <strong>S</strong>, then by <strong>Speed</strong>. In these presets,
              the high-ratio shots are mostly the slower ones. S compares the ball's surface
              speed with its travel speed, so slowing the shot raises S even when rev/s stays
              fixed.
            </Note>
            <Note>
              The <strong>Bounce</strong> column is the only positive number in the table
              for the loop. It is the only shot here whose contact patch is moving backwards
              on impact, so it is the only one friction pushes forwards.
            </Note>
          </div>
        </Panel>
      </div>
    </>
  );
}
