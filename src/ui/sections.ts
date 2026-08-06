/**
 * The app is a set of views, each answering one question. Kept separate from the
 * shell component so both the nav and the home page can import it without
 * tripping fast-refresh's component-only-exports rule.
 */
export const SECTIONS = [
  { to: '/trajectory', label: 'Trajectory', question: 'See how spin changes a shot.' },
  { to: '/magnus', label: 'Magnus', question: 'Learn why spin bends the flight.' },
  { to: '/bounce', label: 'Bounce', question: 'See why the ball grips, skids or kicks.' },
  { to: '/shots', label: 'Shots', question: 'Compare the strokes you already know.' },
  { to: '/predict', label: 'Predict', question: 'Call the flight and bounce before the reveal.' },
  { to: '/trainer', label: 'Trainer', question: 'Choose a return before the ball arrives.' },
] as const;
