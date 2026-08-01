import type { ReactNode } from 'react';

/**
 * Shared UI primitives. Deliberately small: the app's job is to show physics, so
 * chrome stays quiet and every control is built to sit next to a live number.
 */

export function Panel({
  title,
  subtitle,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-lg)] border border-[var(--line)] bg-[var(--surface-1)] ${className}`}
    >
      {title && (
        <header className="border-b border-[var(--line)] px-4 py-3">
          <h2 className="text-[length:var(--text-sm)] font-semibold tracking-wide text-[var(--ink-primary)]">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-[length:var(--text-xs)] text-[var(--ink-muted)]">{subtitle}</p>
          )}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

/**
 * A labelled slider that always shows its current value with a unit. Continuous
 * controls matter here: the learner needs to be able to form a prediction, nudge
 * one quantity, and be right or wrong immediately.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  hint,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
  format?: (v: number) => string;
  onChange: (value: number) => void;
}) {
  const shown = format ? format(value) : value.toFixed(step < 1 ? 1 : 0);
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[length:var(--text-sm)] text-[var(--ink-secondary)]">{label}</span>
        <span className="tnum text-[length:var(--text-sm)] text-[var(--ink-primary)]">
          {shown}
          {unit && <span className="ml-1 text-[var(--ink-muted)]">{unit}</span>}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={`${label}${unit ? ` in ${unit}` : ''}`}
      />
      {hint && <span className="block text-[length:var(--text-xs)] text-[var(--ink-muted)]">{hint}</span>}
    </label>
  );
}

/** A row of mutually exclusive options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] p-0.5"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className="cursor-pointer rounded-[6px] px-3 py-1.5 text-[length:var(--text-sm)] font-medium transition-colors"
            style={{
              background: active ? 'var(--surface-3)' : 'transparent',
              color: active ? 'var(--ink-primary)' : 'var(--ink-muted)',
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A single measured quantity. Values are tabular so a column of them stays still
 * while the simulation runs, and the unit is always present — an unlabelled
 * number is exactly the thing the old app was made of.
 */
export function Readout({
  label,
  value,
  unit,
  tone = 'default',
  note,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'accent';
  note?: string;
}) {
  const color = {
    default: 'var(--ink-primary)',
    good: 'var(--status-good)',
    warn: 'var(--status-warn)',
    bad: 'var(--status-bad)',
    accent: 'var(--accent)',
  }[tone];

  return (
    <div className="min-w-0">
      <div className="truncate text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--ink-muted)]">
        {label}
      </div>
      <div className="tnum mt-0.5 text-[length:var(--text-lg)] leading-tight" style={{ color }}>
        {value}
        {unit && (
          <span className="ml-1 text-[length:var(--text-sm)] text-[var(--ink-muted)]">{unit}</span>
        )}
      </div>
      {note && <div className="mt-0.5 text-[length:var(--text-xs)] text-[var(--ink-muted)]">{note}</div>}
    </div>
  );
}

/**
 * Identity is never carried by colour alone — every swatch ships with its label,
 * and the swatch shape doubles as a secondary encoding (solid vs dashed).
 */
export function LegendItem({
  color,
  label,
  dashed = false,
  area = false,
  detail,
  onClick,
  active = true,
}: {
  color: string;
  label: string;
  dashed?: boolean;
  /** Draw a filled swatch instead of a line, for shaded regions. */
  area?: boolean;
  detail?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const content = (
    <>
      <svg width="18" height="10" aria-hidden className="shrink-0">
        {area ? (
          <rect x="1" y="1" width="16" height="8" fill={color} opacity={0.28} rx="2" />
        ) : (
          <line
            x1="1"
            y1="5"
            x2="17"
            y2="5"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={dashed ? '3 3' : undefined}
          />
        )}
      </svg>
      <span className="text-[length:var(--text-sm)] text-[var(--ink-primary)]">{label}</span>
      {detail && <span className="text-[length:var(--text-xs)] text-[var(--ink-muted)]">{detail}</span>}
    </>
  );

  if (!onClick) {
    return <span className="inline-flex items-center gap-2">{content}</span>;
  }

  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius)] px-2 py-1 transition-opacity hover:bg-[var(--surface-2)]"
      style={{ opacity: active ? 1 : 0.4 }}
    >
      {content}
    </button>
  );
}

/** A short status chip. Always carries a word, never colour alone. */
export function Chip({
  children,
  tone = 'default',
}: {
  children: ReactNode;
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'accent';
}) {
  const color = {
    default: 'var(--ink-secondary)',
    good: 'var(--status-good)',
    warn: 'var(--status-warn)',
    bad: 'var(--status-bad)',
    accent: 'var(--accent)',
  }[tone];

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[length:var(--text-xs)] font-medium"
      style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
    >
      {children}
    </span>
  );
}

/**
 * A claim the engine is asked to back up. Used to attach the "why" to a number
 * without turning the page into an essay.
 */
export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-[var(--line-strong)] pl-3 text-[length:var(--text-sm)] leading-relaxed text-[var(--ink-secondary)]">
      {children}
    </p>
  );
}
