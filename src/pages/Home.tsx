import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Difficulty } from '../engine/types';

const difficulties: {
  value: Difficulty;
  label: string;
  desc: string;
  activeClass: string;
}[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    desc: 'Slow AI, more time to react',
    activeClass: 'bg-emerald-500/15 text-emerald-300 ring-2 ring-emerald-400/60 shadow-[0_0_0_1px_rgba(52,211,153,0.2)]',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    desc: 'Faster reactions, varied spins',
    activeClass: 'bg-amber-500/15 text-amber-200 ring-2 ring-amber-400/55 shadow-[0_0_0_1px_rgba(251,191,36,0.15)]',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    desc: 'Quick, accurate, tough to beat',
    activeClass: 'bg-red-500/15 text-red-200 ring-2 ring-red-400/50 shadow-[0_0_0_1px_rgba(248,113,113,0.15)]',
  },
];

export function Home() {
  const navigate = useNavigate();
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');

  const activeDesc = difficulties.find((d) => d.value === difficulty)?.desc ?? '';

  return (
    <div className="min-h-full w-full overflow-auto bg-gradient-to-b from-[#0a1628] via-[#0c1b30] to-[#0d2137]">
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col px-5 py-10 sm:px-6 sm:py-14">
        <header className="fade-in text-center">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.35em] text-cyan-400/80">
            Interactive trainer
          </p>
          <h1 className="text-5xl font-black tracking-tight text-white sm:text-6xl">
            <span className="text-cyan-400">SPIN</span>
            <span className="text-white"> PONG</span>
          </h1>
          <p className="mx-auto mt-4 max-w-sm text-pretty text-base leading-relaxed text-slate-400 sm:text-lg">
            Master the art of ping pong spin
          </p>
        </header>

        <div className="fade-in mt-10 flex flex-col gap-4 sm:mt-12 sm:gap-5">
          {/* Play vs AI */}
          <section
            className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_-24px_rgba(0,0,0,0.55)] backdrop-blur-md ring-1 ring-white/[0.04] sm:p-7"
            aria-labelledby="mode-ai-heading"
          >
            <h2 id="mode-ai-heading" className="text-lg font-bold tracking-tight text-white sm:text-xl">
              Play vs AI
            </h2>
            <p className="mt-1 text-sm text-slate-500">Choose a difficulty, then start a match.</p>

            <div
              className="mt-5 flex rounded-2xl bg-black/25 p-1 ring-1 ring-white/[0.06]"
              role="group"
              aria-label="AI difficulty"
            >
              {difficulties.map((d) => {
                const selected = difficulty === d.value;
                return (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setDifficulty(d.value)}
                    className={`relative min-h-[44px] flex-1 rounded-xl px-2 py-2.5 text-center text-xs font-semibold transition-[color,background-color,box-shadow,transform] duration-150 sm:text-sm ${
                      selected
                        ? d.activeClass
                        : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
                    }`}
                  >
                    {d.label}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 min-h-[2.5rem] text-sm leading-relaxed text-slate-400">{activeDesc}</p>

            <button
              type="button"
              onClick={() => navigate(`/play?difficulty=${difficulty}`)}
              className="mt-5 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-5 text-base font-bold text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08)_inset,0_12px_40px_-8px_rgba(34,211,238,0.45)] transition-[transform,background-color,box-shadow] duration-150 hover:bg-cyan-300 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset,0_16px_48px_-8px_rgba(34,211,238,0.55)] active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              Start match
            </button>
          </section>

          {/* Multiplayer */}
          <button
            type="button"
            onClick={() => navigate('/multiplayer')}
            className="group rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left shadow-[0_20px_60px_-28px_rgba(0,0,0,0.5)] backdrop-blur-md ring-1 ring-white/[0.04] transition-[border-color,background-color,transform,box-shadow] duration-200 hover:border-violet-400/25 hover:bg-white/[0.06] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300/80 sm:p-6"
          >
            <div className="flex items-center gap-4">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 text-xl ring-1 ring-violet-400/20"
                aria-hidden
              >
                👥
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">Play with a friend</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  Share a link and play in real time over the browser.
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-violet-300/90 transition-colors group-hover:text-violet-200">
                Open
                <span aria-hidden className="ml-0.5 inline-block transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </div>
          </button>

          {/* Spin Lab */}
          <button
            type="button"
            onClick={() => navigate('/lab')}
            className="group rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-left shadow-[0_20px_60px_-28px_rgba(0,0,0,0.5)] backdrop-blur-md ring-1 ring-white/[0.04] transition-[border-color,background-color,transform,box-shadow] duration-200 hover:border-amber-400/25 hover:bg-white/[0.06] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300/80 sm:p-6"
          >
            <div className="flex items-center gap-4">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-xl ring-1 ring-amber-400/20"
                aria-hidden
              >
                🔬
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold tracking-tight text-white sm:text-xl">Spin Lab</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  Visualize spin physics, practice recognition, and take the spin quiz.
                </p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-amber-200/90 transition-colors group-hover:text-amber-100">
                Open
                <span aria-hidden className="ml-0.5 inline-block transition-transform group-hover:translate-x-0.5">
                  →
                </span>
              </span>
            </div>
          </button>
        </div>

        <footer className="fade-in mt-auto border-t border-white/[0.06] pt-8 text-center">
          <p className="mx-auto max-w-sm text-pretty text-xs leading-relaxed text-slate-500 sm:text-[13px]">
            Move mouse to aim · Click to hit · Number keys <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">1</kbd>–
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">5</kbd> to select spin
          </p>
        </footer>
      </div>
    </div>
  );
}
