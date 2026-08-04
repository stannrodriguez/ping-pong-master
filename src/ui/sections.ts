/**
 * The app is a set of views, each answering one question. Kept separate from the
 * shell component so both the nav and the home page can import it without
 * tripping fast-refresh's component-only-exports rule.
 */
export const SECTIONS = [
  { to: '/trajectory', label: 'Trajectory', question: 'What shape does this shot make?' },
  { to: '/magnus', label: 'Magnus', question: 'Why does spin push the ball sideways?' },
  { to: '/bounce', label: 'Bounce', question: 'What happens in the 0.5 ms of contact?' },
  { to: '/shots', label: 'Shots', question: 'How do the real strokes compare?' },
  { to: '/predict', label: 'Predict', question: 'Can I predict what happens now?' },
  { to: '/trainer', label: 'Trainer', question: 'Can I choose the right return in time?' },
] as const;
