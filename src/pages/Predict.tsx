import { useCallback, useMemo, useState } from 'react';

import {
  bounceOffTable,
  componentsFromSpin,
  contactPointVelocity,
  gripThreshold,
  launchFrom,
  simulate,
  spinFromComponents,
  v3,
  withoutSpin,
  type LaunchSpec,
  type Trajectory,
} from '../physics';
import { PageHeader } from '../ui/AppShell';
import { Chip, Note, Panel } from '../ui/controls';
import { Ball, TableFrame } from '../viz/TableFrame';
import { fitProjection, pathFrom, sideViewExtents } from '../viz/projection';
import { useSize } from '../viz/useSize';

/**
 * Questions are generated from randomised parameters and answered by running the
 * simulator, never from a written-down answer key.
 *
 * That is the difference between this and the trivia quiz it replaces. A fixed
 * list of questions can be memorised, and worse, it can drift out of agreement
 * with the model as the model changes. Here the correct answer is whatever the
 * physics does, so the page cannot teach something the engine disagrees with.
 */

interface Question {
  kind: string;
  prompt: string;
  options: string[];
  correct: number;
  explanation: string;
  paths?: Array<{ trajectory: Trajectory; label: string; color: string }>;
  highlight?: string;
}

const between = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pick = <T,>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

function shotWith(topspinRps: number, speed: number, elevation: number): LaunchSpec {
  const base = launchFrom({ position: v3(0, 0.28, 1.42), speed, elevation });
  return {
    ...base,
    spin: spinFromComponents(base.velocity, { topspin: topspinRps, sidespin: 0, corkscrew: 0 }),
  };
}

/** "Which of these three paths is the topspin one?" */
function identifyPath(): Question {
  const speed = between(9, 13);
  const elevation = between(6, 12);
  const rates = [between(80, 130), 0, -between(40, 80)];
  const labels = ['Topspin', 'No spin', 'Backspin'];
  const colors = ['var(--spin-topspin)', 'var(--spin-none)', 'var(--spin-backspin)'];

  // Shuffle which path gets which letter, so position carries no information.
  const order = [0, 1, 2].sort(() => Math.random() - 0.5);
  const target = Math.floor(Math.random() * 3);
  const targetLabel = labels[target];

  const paths = order.map((index) => ({
    trajectory: simulate(shotWith(rates[index], speed, elevation), { maxBounces: 1 }),
    label: labels[index],
    color: colors[index],
  }));

  return {
    kind: 'Read the path',
    prompt: `Three shots left the racket at the same speed, height and angle. Only the spin differed. Which path is the ${targetLabel.toLowerCase()} one?`,
    options: ['A', 'B', 'C'],
    correct: paths.findIndex((p) => p.label === targetLabel),
    explanation:
      target === 0
        ? 'Topspin puts the Magnus force straight down, so its path is the one that peaks earliest and falls hardest — it is always the shortest of the three.'
        : target === 1
          ? 'With no spin there is no Magnus force at all, so this path is a plain drag-damped parabola. It always sits between the other two.'
          : 'Backspin puts the Magnus force up, so this is the path that hangs and carries furthest. At high enough spin it never comes down at all.',
    paths,
    highlight: targetLabel,
  };
}

/** "Does this shot stay on the table?" */
function willItLand(): Question {
  const speed = between(10, 17);
  const elevation = between(1, 11);
  const spin = pick([between(90, 140), between(-10, 25), between(-90, -50)]);
  const launch = shotWith(spin, speed, elevation);
  const result = simulate(launch, { maxBounces: 1 });
  const plain = simulate(withoutSpin(launch), { maxBounces: 1 });

  const outcome = result.isLegal
    ? 'Lands on the table'
    : result.events.some((e) => e.kind === 'net')
      ? 'Hits the net'
      : 'Flies long';

  const options = ['Lands on the table', 'Hits the net', 'Flies long'];

  const spinNote = result.isLegal && !plain.isLegal
    ? ' Without its spin, the identical shot does not stay on — the Magnus force is doing all the work here.'
    : !result.isLegal && plain.isLegal
      ? ' The same shot with no spin would have landed. The spin is what took it off the table.'
      : '';

  return {
    kind: 'Predict the outcome',
    prompt: `A ball leaves at ${speed.toFixed(1)} m/s, ${elevation.toFixed(0)}° above horizontal, from 28 cm, with ${Math.abs(spin).toFixed(0)} rev/s of ${spin >= 0 ? 'topspin' : 'backspin'}. What happens?`,
    options,
    correct: options.indexOf(outcome),
    explanation:
      `It ${outcome.toLowerCase()}. Net clearance ${
        result.netClearance == null ? 'n/a' : `${(result.netClearance * 100).toFixed(0)} cm`
      }, apex ${(result.apex * 100).toFixed(0)} cm.` + spinNote,
    paths: [
      { trajectory: result, label: 'This shot', color: 'var(--accent)' },
      { trajectory: plain, label: 'Same shot, no spin', color: 'var(--spin-none)' },
    ],
  };
}

/** "What does the bounce do to this ball?" */
function bounceOutcome(): Question {
  const speed = between(4, 14);
  const descent = between(12, 55);
  const spin = pick([between(90, 150), between(-20, 40), between(-150, -90)]);

  const rad = (descent * Math.PI) / 180;
  const velocity = v3(0, -speed * Math.sin(rad), -speed * Math.cos(rad));
  const spinVec = spinFromComponents(velocity, { topspin: spin, sidespin: 0, corkscrew: 0 });
  const result = bounceOffTable({ velocity, spin: spinVec });

  const before = Math.hypot(velocity.x, velocity.z);
  const after = Math.hypot(result.velocity.x, result.velocity.z);
  const reversed = result.velocity.z > 0;

  const outcome = reversed
    ? 'Bounces backwards'
    : after > before + 0.05
      ? 'Leaves faster than it arrived'
      : 'Leaves slower than it arrived';

  const options = [
    'Leaves faster than it arrived',
    'Leaves slower than it arrived',
    'Bounces backwards',
  ];

  const u = contactPointVelocity(velocity, spinVec);
  const patch = Math.hypot(u.x, u.z);

  return {
    kind: 'Predict the bounce',
    prompt: `A ball hits the table at ${speed.toFixed(1)} m/s, descending at ${descent.toFixed(0)}°, carrying ${Math.abs(spin).toFixed(0)} rev/s of ${spin >= 0 ? 'topspin' : 'backspin'}. What does the bounce do to its horizontal speed?`,
    options,
    correct: options.indexOf(outcome),
    explanation:
      `The contact patch was moving at ${patch.toFixed(1)} m/s against a grip limit of ${gripThreshold(velocity.y).toFixed(1)} m/s, so the ball ${
        result.regime === 'grip' ? 'gripped' : 'slid'
      }. Horizontal speed went ${before.toFixed(1)} → ${after.toFixed(1)} m/s and the spin went ${spin.toFixed(0)} → ${componentsFromSpin(velocity, result.spin).topspin.toFixed(0)} rev/s. ` +
      (outcome === 'Leaves faster than it arrived'
        ? 'r·ω was larger than v, so the patch was moving backwards under the ball and friction pushed it forwards.'
        : 'Friction acted against the direction of travel, because the patch was moving forwards.'),
  };
}

const GENERATORS = [identifyPath, willItLand, bounceOutcome];

function PathPlot({
  paths,
  reveal,
}: {
  paths: Array<{ trajectory: Trajectory; label: string; color: string }>;
  reveal: boolean;
}) {
  const { ref, width, height } = useSize();

  const projection = useMemo(() => {
    const { horizontal, vertical } = sideViewExtents(0.35, 1.1);
    return fitProjection(
      { width, height, padding: { top: 14, right: 14, bottom: 20, left: 14 } },
      horizontal,
      vertical,
    );
  }, [width, height]);

  const letters = ['A', 'B', 'C', 'D'];

  return (
    <div ref={ref} className="aspect-[22/6] w-full">
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Candidate trajectories">
          <defs>
            <clipPath id="predict-clip">
              <rect x="0" y="0" width={width} height={height} />
            </clipPath>
          </defs>
          <TableFrame projection={projection} plane="side" />
          <g clipPath="url(#predict-clip)">
            {paths.map((path, i) => {
              const points = path.trajectory.samples.map((s) => s.position);
              const mid = points[Math.floor(points.length * 0.45)];
              return (
                <g key={i}>
                  <path
                    d={pathFrom(points, 'side', projection)}
                    fill="none"
                    // Before the reveal every path is neutral: colouring them by
                    // spin type would answer the question in the picture.
                    stroke={reveal ? path.color : 'var(--ink-secondary)'}
                    strokeWidth={2.25}
                    strokeLinecap="round"
                  />
                  {mid && (
                    <text
                      x={projection.x(-mid.z)}
                      y={projection.y(mid.y) - 10}
                      textAnchor="middle"
                      fill={reveal ? path.color : 'var(--ink-primary)'}
                      stroke="var(--surface-1)"
                      strokeWidth={3.5}
                      paintOrder="stroke"
                      style={{ fontSize: 12, fontWeight: 700 }}
                    >
                      {reveal ? path.label : letters[i]}
                    </text>
                  )}
                  {path.trajectory.landing && (
                    <Ball
                      cx={projection.x(-path.trajectory.landing.z)}
                      cy={projection.y(path.trajectory.landing.y)}
                      projection={projection}
                      color={reveal ? path.color : 'var(--ink-secondary)'}
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

export function Predict() {
  const [question, setQuestion] = useState<Question>(() => pick(GENERATORS)());
  const [answer, setAnswer] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const next = useCallback(() => {
    setQuestion(pick(GENERATORS)());
    setAnswer(null);
  }, []);

  const choose = (index: number) => {
    if (answer !== null) return;
    setAnswer(index);
    setScore((s) => ({ right: s.right + (index === question.correct ? 1 : 0), total: s.total + 1 }));
  };

  const revealed = answer !== null;
  const correct = answer === question.correct;

  return (
    <>
      <PageHeader title="Predict It" question="Can you predict what the physics will do?">
        <div className="flex items-center gap-3">
          <span className="tnum text-[length:var(--text-sm)] text-[var(--ink-secondary)]">
            {score.right} / {score.total}
          </span>
          <button
            onClick={next}
            className="cursor-pointer rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] px-3 py-1.5 text-[length:var(--text-sm)] text-[var(--ink-primary)]"
          >
            {revealed ? 'Next question' : 'Skip'}
          </button>
        </div>
      </PageHeader>

      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4">
        <Panel title={question.kind}>
          <p className="text-[length:var(--text-base)] leading-relaxed text-[var(--ink-primary)]">
            {question.prompt}
          </p>

          {question.paths && (
            <div className="mt-3 rounded-[var(--radius)] border border-[var(--line)] bg-[var(--surface-2)] p-1">
              <PathPlot paths={question.paths} reveal={revealed} />
            </div>
          )}

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {question.options.map((option, index) => {
              const isCorrect = index === question.correct;
              const isChosen = index === answer;
              const tone = !revealed
                ? { border: 'var(--line)', bg: 'var(--surface-2)', color: 'var(--ink-primary)' }
                : isCorrect
                  ? { border: 'var(--status-good)', bg: 'color-mix(in srgb, var(--status-good) 14%, transparent)', color: 'var(--status-good)' }
                  : isChosen
                    ? { border: 'var(--status-bad)', bg: 'color-mix(in srgb, var(--status-bad) 14%, transparent)', color: 'var(--status-bad)' }
                    : { border: 'var(--line)', bg: 'transparent', color: 'var(--ink-muted)' };

              return (
                <button
                  key={option}
                  onClick={() => choose(index)}
                  disabled={revealed}
                  className="rounded-[var(--radius)] border-2 px-3 py-2.5 text-[length:var(--text-sm)] font-medium transition-colors"
                  style={{
                    borderColor: tone.border,
                    background: tone.bg,
                    color: tone.color,
                    cursor: revealed ? 'default' : 'pointer',
                  }}
                >
                  {option}
                  {revealed && isCorrect && ' ✓'}
                </button>
              );
            })}
          </div>

          {revealed && (
            <div className="mt-4 flex flex-col gap-3 fade-in">
              <Chip tone={correct ? 'good' : 'bad'}>
                {correct ? 'Correct' : 'Not this time'}
              </Chip>
              <Note>{question.explanation}</Note>
              <button
                onClick={next}
                className="self-start cursor-pointer rounded-[var(--radius)] bg-[var(--accent)] px-4 py-2 text-[length:var(--text-sm)] font-semibold text-[var(--accent-ink)]"
              >
                Next question →
              </button>
            </div>
          )}
        </Panel>

        <Panel title="How this works">
          <Note>
            Every question here is generated from randomised parameters and answered by
            running the simulator, not from a written-down answer key. The correct answer is
            whatever the physics actually does — which means this page cannot drift out of
            agreement with the rest of the app, and cannot be beaten by memorising it.
          </Note>
        </Panel>
      </div>
    </>
  );
}
