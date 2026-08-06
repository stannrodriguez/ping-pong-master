import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  BALL,
  describeSpin,
  length,
  simulate,
  spinRateRps,
  withoutSpin,
  type Trajectory,
} from '../physics';
import { PageHeader } from '../ui/AppShell';
import { Chip, Note, Panel, Readout, Segmented } from '../ui/controls';
import { TrainerScene, type ScenePhase } from '../trainer/Scene';
import {
  generateServe,
  pickFamily,
  SERVE_FAMILIES,
  type ServeFamilyId,
  type ServeRep,
} from '../trainer/serves';
import {
  AIMS,
  gradeAllChoices,
  playReturn,
  OUTCOME_LABELS,
  STROKES,
  explainReturn,
  type ReturnResult,
  type StrokeChoice,
} from '../trainer/strokes';
import { setMuted, unlockAudio } from '../trainer/audio';

/**
 * The Return Trainer: first-person serve receive, as decision practice.
 *
 * A rep is: watch the serve → commit to a stroke and an aim before the ball is on
 * you → the racket contact model and the simulator play your actual return. There
 * is no answer key. Whether a choice was right is whatever the physics does with
 * it, and the full 3×3 decision space is graded the same way for the reveal.
 */

type Timing = 'untimed' | 'match';

type FamilyRecord = Record<ServeFamilyId, { right: number; total: number }>;

const EMPTY_RECORD: FamilyRecord = Object.fromEntries(
  SERVE_FAMILIES.map((f) => [f.id, { right: 0, total: 0 }]),
) as FamilyRecord;

const KEY_HINTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Cell-sized outcome words; the HUD and explanation carry the full sentence. */
const OUTCOME_SHORT: Record<ReturnResult['outcome'], string> = {
  landed: 'On',
  popped: 'Popped up',
  net: 'Net',
  long: 'Long',
  wide: 'Wide',
  'own-half': 'Your side',
};

export function Trainer() {
  const [rep, setRep] = useState<ServeRep | null>(null);
  const [phase, setPhase] = useState<ScenePhase>('idle');
  const [choice, setChoice] = useState<StrokeChoice | null>(null);
  const [preview, setPreview] = useState<StrokeChoice | null>(null);
  const [returnResult, setReturnResult] = useState<ReturnResult | null>(null);
  const [grid, setGrid] = useState<ReturnResult[][] | null>(null);
  const [late, setLate] = useState(false);
  const [deadlinePassed, setDeadlinePassed] = useState(false);

  const [record, setRecord] = useState<FamilyRecord>(EMPTY_RECORD);
  const [streak, setStreak] = useState(0);

  const [rate, setRate] = useState(0.65);
  const [cueMode, setCueMode] = useState<'learn' | 'match'>('learn');
  const [timing, setTiming] = useState<Timing>('untimed');
  const [sound, setSound] = useState(true);

  // useFrame-driven callbacks fire from the render loop; refs keep them off stale state.
  const repRef = useRef<ServeRep | null>(null);
  const phaseRef = useRef<ScenePhase>('idle');
  const choiceRef = useRef<StrokeChoice | null>(null);
  const returnRef = useRef<ReturnResult | null>(null);
  const timingRef = useRef<Timing>('untimed');
  const deadlineRef = useRef(false);
  const recordRef = useRef<FamilyRecord>(record);
  const scoredRef = useRef(false);
  repRef.current = rep;
  phaseRef.current = phase;
  choiceRef.current = choice;
  returnRef.current = returnResult;
  timingRef.current = timing;
  deadlineRef.current = deadlinePassed;
  recordRef.current = record;

  useEffect(() => setMuted(!sound), [sound]);

  const ghost: Trajectory | null = useMemo(
    () => (rep ? simulate(withoutSpin(rep.launch), { maxBounces: 4, maxTime: 3 }) : null),
    [rep],
  );

  const scoreRep = useCallback((family: ServeFamilyId, correct: boolean) => {
    if (scoredRef.current) return;
    scoredRef.current = true;
    setRecord((r) => ({
      ...r,
      [family]: { right: r[family].right + (correct ? 1 : 0), total: r[family].total + 1 },
    }));
    setStreak((s) => (correct ? s + 1 : 0));
  }, []);

  const nextRep = useCallback(() => {
    const family = pickFamily(recordRef.current);
    setRep(generateServe(family));
    setChoice(null);
    setPreview(null);
    setReturnResult(null);
    setGrid(null);
    setLate(false);
    setDeadlinePassed(false);
    scoredRef.current = false;
    setPhase('toss');
  }, []);

  const start = useCallback(() => {
    unlockAudio();
    nextRep();
  }, [nextRep]);

  const playChoice = useCallback((picked: StrokeChoice) => {
    const current = repRef.current;
    if (!current) return;
    setReturnResult(playReturn(current.contact, picked));
    setGrid(gradeAllChoices(current.contact));
    setPhase('return');
  }, []);

  const lock = useCallback(
    (picked: StrokeChoice) => {
      if (choiceRef.current) return;
      const current = phaseRef.current;
      if (current !== 'flight' && current !== 'hold') return;
      if (current === 'flight' && timingRef.current === 'match' && deadlineRef.current) {
        return; // Committed after the bounce — at match timing that's a miss.
      }
      setChoice(picked);
      setPreview(picked);
      if (current === 'hold') playChoice(picked);
    },
    [playChoice],
  );

  const onTossDone = useCallback(() => setPhase('flight'), []);
  const onBounce = useCallback(() => setDeadlinePassed(true), []);

  const onBallArrived = useCallback(() => {
    const current = repRef.current;
    if (!current) return;
    const picked = choiceRef.current;
    if (picked) {
      playChoice(picked);
    } else if (timingRef.current === 'untimed') {
      setPhase('hold');
    } else {
      // Match timing, no commitment: the serve wins the point outright.
      setLate(true);
      setGrid(gradeAllChoices(current.contact));
      scoreRep(current.family.id, false);
      setPhase('return');
    }
  }, [playChoice, scoreRep]);

  const onReturnDone = useCallback(() => {
    const current = repRef.current;
    if (current) scoreRep(current.family.id, returnRef.current?.outcome === 'landed');
    setPhase('done');
  }, [scoreRep]);

  // Keyboard: 1–9 picks a cell of the decision pad, Enter advances.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        if (phase === 'done') nextRep();
        else if (phase === 'idle') start();
        return;
      }
      const digit = Number(event.key);
      if (digit >= 1 && digit <= 9) {
        const stroke = STROKES[Math.floor((digit - 1) / 3)].id;
        const aim = AIMS[(digit - 1) % 3].id;
        lock({ stroke, aim });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, lock, nextRep, start]);

  const totals = SERVE_FAMILIES.reduce(
    (sum, f) => ({
      right: sum.right + record[f.id].right,
      total: sum.total + record[f.id].total,
    }),
    { right: 0, total: 0 },
  );

  const decisionOpen =
    (phase === 'flight' || phase === 'hold') &&
    !choice &&
    !(timing === 'match' && deadlinePassed);

  const hud = (() => {
    switch (phase) {
      case 'toss':
        return 'Watch the racket contact…';
      case 'flight':
        if (choice) return `Locked: ${describeChoice(choice)}`;
        if (timing === 'match') {
          return deadlinePassed ? 'Too late — it already bounced' : 'Commit before the bounce';
        }
        return 'Read the ball — pick your return';
      case 'hold':
        return 'Ball on you. Pick your return.';
      case 'return':
        return choice ? describeChoice(choice) : '';
      case 'done':
        return late
          ? 'Too late. At match speed the read has to happen before the bounce.'
          : returnResult
            ? OUTCOME_LABELS[returnResult.outcome]
            : '';
      default:
        return '';
    }
  })();

  const correct = returnResult?.outcome === 'landed';

  return (
    <>
      <PageHeader
        title="Return Trainer"
        question="Can you read the spin and choose a return in time?"
      >
        <div className="flex items-center gap-3">
          {streak > 1 && <Chip tone="accent">{streak} in a row</Chip>}
          <span className="tnum text-[length:var(--text-sm)] text-[var(--ink-secondary)]">
            {totals.right} / {totals.total}
          </span>
          {phase === 'done' && (
            <button
              onClick={nextRep}
              className="cursor-pointer rounded-[var(--radius)] bg-[var(--accent)] px-3 py-1.5 text-[length:var(--text-sm)] font-semibold text-[var(--accent-ink)]"
            >
              Next serve ↵
            </button>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--line)]">
            <TrainerScene
              rep={rep}
              phase={phase}
              playbackRate={rate}
              cues={cueMode === 'learn'}
              preview={preview ?? choice}
              returnResult={returnResult}
              ghost={ghost}
              onTossDone={onTossDone}
              onBounce={onBounce}
              onBallArrived={onBallArrived}
              onReturnDone={onReturnDone}
            />

            {phase === 'idle' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[rgb(15_17_20/0.55)] p-6 text-center">
                <p className="max-w-md text-[length:var(--text-base)] text-[var(--ink-primary)]">
                  Watch the racket contact, then check the flight and bounce. Choose a stroke
                  and aim before the ball reaches you.
                </p>
                <button
                  onClick={start}
                  className="cursor-pointer rounded-[var(--radius)] bg-[var(--accent)] px-6 py-2.5 text-[length:var(--text-base)] font-semibold text-[var(--accent-ink)]"
                >
                  Start serve ↵
                </button>
              </div>
            )}

            {hud && phase !== 'idle' && (
              <div className="pointer-events-none absolute bottom-3 left-3 rounded-[var(--radius)] bg-[rgb(15_17_20/0.78)] px-3 py-1.5 text-[length:var(--text-sm)] text-[var(--ink-primary)]">
                {phase === 'done' && !late && returnResult ? (
                  <span style={{ color: correct ? 'var(--status-good)' : 'var(--status-bad)' }}>
                    {hud}
                  </span>
                ) : (
                  hud
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Panel
            title="Your return"
            subtitle="Push = open face · Drive = lift through · Block = closed face"
          >
            <div className="grid grid-cols-[minmax(0,auto)_1fr_1fr_1fr] items-stretch gap-1.5">
              <div />
              {AIMS.map((aim) => (
                <div
                  key={aim.id}
                  className="pb-0.5 text-center text-[length:var(--text-xs)] uppercase tracking-wider text-[var(--ink-muted)]"
                >
                  {aim.id === 'straight' ? 'straight' : aim.id}
                </div>
              ))}
              {STROKES.map((stroke, row) => (
                <StrokeRow
                  key={stroke.id}
                  row={row}
                  stroke={stroke}
                  grid={grid}
                  choice={choice}
                  open={decisionOpen}
                  onHover={(c) => !choice && setPreview(c)}
                  onLeave={() => !choice && setPreview(null)}
                  onPick={lock}
                />
              ))}
            </div>
            {grid == null && (
              <p className="mt-2.5 text-[length:var(--text-xs)] text-[var(--ink-muted)]">
                Keys 1–9. Hover previews the racket face in the scene.
              </p>
            )}
          </Panel>

          {phase === 'done' && rep ? (
            <ServeReveal rep={rep} returnResult={returnResult} late={late} />
          ) : (
            <Panel title="Session">
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-3">
                  <Readout
                    label="Safe returns"
                    value={totals.total === 0 ? '—' : `${totals.right}/${totals.total}`}
                  />
                  <Readout label="Streak" value={streak} />
                </div>
                {totals.total > 0 && <FamilyBars record={record} />}
                <Note>
                  The trainer sends more of the serves you miss, then eases off when you
                  return them safely.
                </Note>
              </div>
            </Panel>
          )}

          <Panel title="Drill settings">
            <div className="flex flex-col gap-3">
              <label className="flex items-center justify-between gap-3">
                <span className="text-[length:var(--text-sm)] text-[var(--ink-secondary)]">
                  Ball speed
                </span>
                <Segmented
                  label="Playback speed"
                  options={[
                    { value: '0.4', label: 'Slow' },
                    { value: '0.65', label: 'Medium' },
                    { value: '1', label: 'Full' },
                  ]}
                  value={String(rate)}
                  onChange={(v) => setRate(Number(v))}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-[length:var(--text-sm)] text-[var(--ink-secondary)]">
                  Cues
                </span>
                <Segmented
                  label="Cues"
                  options={[
                    { value: 'learn', label: 'Learning' },
                    { value: 'match', label: 'Match' },
                  ]}
                  value={cueMode}
                  onChange={(v) => setCueMode(v)}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-[length:var(--text-sm)] text-[var(--ink-secondary)]">
                  Decision window
                </span>
                <Segmented
                  label="Decision window"
                  options={[
                    { value: 'untimed', label: 'Untimed' },
                    { value: 'match', label: 'Before bounce' },
                  ]}
                  value={timing}
                  onChange={(v) => setTiming(v)}
                />
              </label>
              <label className="flex items-center justify-between gap-3">
                <span className="text-[length:var(--text-sm)] text-[var(--ink-secondary)]">
                  Sound
                </span>
                <Segmented
                  label="Sound"
                  options={[
                    { value: 'on', label: 'On' },
                    { value: 'off', label: 'Off' },
                  ]}
                  value={sound ? 'on' : 'off'}
                  onChange={(v) => setSound(v === 'on')}
                />
              </label>
              <Note>
                Learning mode shows the flight trail, the spin axis and the strike zone.
                Match mode removes those aids. Turn on <strong>Before bounce</strong> when
                you are ready to commit before the ball lands on your side.
              </Note>
            </div>
          </Panel>

          <Panel title="Read the result grid">
            <Note>
              After each serve, every cell shows where that stroke-and-aim choice would have
              gone. Read across a row to compare aim; read down a column to compare racket
              face and swing.
            </Note>
          </Panel>
        </div>
      </div>
    </>
  );
}

function describeChoice(choice: StrokeChoice): string {
  const stroke = STROKES.find((s) => s.id === choice.stroke)!;
  const aim = AIMS.find((a) => a.id === choice.aim)!;
  return `${stroke.name} · ${aim.name.toLowerCase()}`;
}

function StrokeRow({
  row,
  stroke,
  grid,
  choice,
  open,
  onHover,
  onLeave,
  onPick,
}: {
  row: number;
  stroke: (typeof STROKES)[number];
  grid: ReturnResult[][] | null;
  choice: StrokeChoice | null;
  open: boolean;
  onHover: (choice: StrokeChoice) => void;
  onLeave: () => void;
  onPick: (choice: StrokeChoice) => void;
}) {
  return (
    <>
      <div className="flex flex-col justify-center pr-1.5" title={stroke.face}>
        <span className="text-[length:var(--text-sm)] font-semibold text-[var(--ink-primary)]">
          {stroke.name}
        </span>
      </div>
      {AIMS.map((aim, col) => {
        const cell: StrokeChoice = { stroke: stroke.id, aim: aim.id };
        const result = grid?.[row][col];
        const isChosen = choice?.stroke === stroke.id && choice?.aim === aim.id;

        let tone = { border: 'var(--line)', bg: 'var(--surface-2)', color: 'var(--ink-primary)' };
        if (result) {
          const color =
            result.outcome === 'landed'
              ? 'var(--status-good)'
              : result.outcome === 'popped'
                ? 'var(--status-warn)'
                : 'var(--status-bad)';
          tone = {
            border: isChosen ? color : 'var(--line)',
            bg: `color-mix(in srgb, ${color} ${isChosen ? 22 : 10}%, transparent)`,
            color,
          };
        } else if (isChosen) {
          tone = { border: 'var(--accent)', bg: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent)' };
        }

        return (
          <button
            key={aim.id}
            onClick={() => onPick(cell)}
            onMouseEnter={() => onHover(cell)}
            onMouseLeave={onLeave}
            disabled={!open && !result}
            className="min-h-[44px] rounded-[var(--radius)] border-2 px-1 py-1 text-[length:var(--text-sm)] font-medium transition-colors"
            style={{
              borderColor: tone.border,
              background: tone.bg,
              color: tone.color,
              cursor: open ? 'pointer' : 'default',
              opacity: !open && !result && !isChosen ? 0.55 : 1,
            }}
          >
            {result ? (
              <span className="flex flex-col items-center gap-0 leading-tight">
                <span className="text-[length:var(--text-xs)]">
                  {OUTCOME_SHORT[result.outcome]}
                </span>
                {isChosen && <span className="text-[length:var(--text-xs)] opacity-75">your pick</span>}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <kbd className="rounded border border-[var(--line)] px-1 text-[length:var(--text-xs)] text-[var(--ink-muted)]">
                  {KEY_HINTS[row * 3 + col]}
                </kbd>
              </span>
            )}
          </button>
        );
      })}
    </>
  );
}

function FamilyBars({ record }: { record: FamilyRecord }) {
  return (
    <div className="flex flex-col gap-1.5">
      {SERVE_FAMILIES.map((family) => {
        const r = record[family.id];
        const share = r.total === 0 ? 0 : r.right / r.total;
        return (
          <div key={family.id} className="grid grid-cols-[1fr_auto] items-center gap-2">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[length:var(--text-xs)] text-[var(--ink-secondary)]">
                  {family.name}
                </span>
                <span className="tnum text-[length:var(--text-xs)] text-[var(--ink-muted)]">
                  {r.total === 0 ? '—' : `${r.right}/${r.total}`}
                </span>
              </div>
              <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-[var(--surface-3)]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${share * 100}%`,
                    background: r.total === 0 ? 'transparent' : share >= 0.5 ? 'var(--status-good)' : 'var(--status-bad)',
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ServeReveal({
  rep,
  returnResult,
  late,
}: {
  rep: ServeRep;
  returnResult: ReturnResult | null;
  late: boolean;
}) {
  const launchSpeed = length(rep.launch.velocity);
  const spinRate = spinRateRps(rep.launch.spin);
  const spinLabel = describeSpin(rep.launch.velocity, rep.launch.spin);

  // What the bounce on the receiver's half actually did — the kick they had to read.
  const kick = useMemo(() => {
    const event = rep.trajectory.events.find(
      (e) => e.kind === 'bounce' && e.position.z > 0 && e.bounce,
    );
    if (!event?.bounce) return null;
    const out = event.bounce.velocity;
    const inV = {
      x: out.x - event.bounce.frictionImpulse.x / BALL.mass,
      z: out.z - event.bounce.frictionImpulse.z / BALL.mass,
    };
    return {
      before: Math.hypot(inV.x, inV.z),
      after: Math.hypot(out.x, out.z),
      lateral: out.x - inV.x,
    };
  }, [rep]);

  return (
    <Panel title="What happened">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Chip tone="accent">{rep.family.name}</Chip>
          <span className="text-[length:var(--text-sm)] text-[var(--ink-secondary)]">
            {spinLabel}
          </span>
        </div>
        <Note>{rep.family.read}</Note>
        <div className="grid grid-cols-3 gap-3">
          <Readout label="Launch" value={launchSpeed.toFixed(1)} unit="m/s" />
          <Readout label="Spin" value={spinRate.toFixed(0)} unit="rev/s" />
          {kick && (
            <Readout
              label="Bounce"
              value={`${kick.before.toFixed(1)}→${kick.after.toFixed(1)}`}
              unit="m/s"
              note={
                Math.abs(kick.lateral) > 0.15
                  ? `kicked ${Math.abs(kick.lateral).toFixed(1)} m/s ${kick.lateral < 0 ? 'left' : 'right'}`
                  : 'no sideways kick'
              }
            />
          )}
        </div>
        {late ? (
          <Note>
            No stroke was played. The dashed line in the scene is this serve with its spin
            deleted — the gap between the two paths is what you had to read.
          </Note>
        ) : (
          returnResult && <Note>{explainReturn(rep.contact, returnResult)}</Note>
        )}
      </div>
    </Panel>
  );
}
