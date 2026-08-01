import { NavLink, Outlet } from 'react-router-dom';

/**
 * The app is six views, each answering one question. The nav names the questions
 * rather than the features, because "what shape does this shot make" is what a
 * learner is actually looking for.
 */
export const SECTIONS = [
  { to: '/trajectory', label: 'Trajectory', question: 'What shape does this shot make?' },
  { to: '/magnus', label: 'Magnus', question: 'Why does spin push the ball sideways?' },
  { to: '/bounce', label: 'Bounce', question: 'What happens in the 0.5 ms of contact?' },
  { to: '/shots', label: 'Shots', question: 'How do the real strokes compare?' },
  { to: '/predict', label: 'Predict', question: 'Can I predict what happens now?' },
] as const;

export function AppShell() {
  return (
    <div className="flex h-full flex-col bg-[var(--surface-page)]">
      <header className="flex shrink-0 items-center gap-6 border-b border-[var(--line)] px-5 py-3">
        <NavLink to="/" className="flex items-baseline gap-2">
          <span className="text-[length:var(--text-lg)] font-black tracking-tight text-[var(--ink-primary)]">
            SPIN
          </span>
          <span className="hidden text-[length:var(--text-xs)] text-[var(--ink-muted)] sm:inline">
            the physics of table tennis
          </span>
        </NavLink>

        <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              title={section.question}
              className="whitespace-nowrap rounded-[var(--radius)] px-3 py-1.5 text-[length:var(--text-sm)] font-medium transition-colors"
              style={({ isActive }) => ({
                color: isActive ? 'var(--ink-primary)' : 'var(--ink-muted)',
                background: isActive ? 'var(--surface-2)' : 'transparent',
              })}
            >
              {section.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}

/** A page heading with the question the page exists to answer. */
export function PageHeader({
  title,
  question,
  children,
}: {
  title: string;
  question: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
      <div>
        <h1 className="text-[length:var(--text-xl)] font-bold tracking-tight text-[var(--ink-primary)]">
          {title}
        </h1>
        <p className="mt-0.5 text-[length:var(--text-sm)] text-[var(--ink-secondary)]">{question}</p>
      </div>
      {children}
    </div>
  );
}
