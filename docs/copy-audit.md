# Copy Audit: ping-pong-master (SPIN)

## Issues found and changes made

- **Metadata and README (`index.html`, `README.md`)**: Replaced em dashes, tightened the meta description, added Open Graph and Twitter metadata, and updated the README stack line to reflect lazy-loaded Three.js.
- **Loading and accessibility (`src/App.tsx`, `src/ui/AppShell.tsx`, `src/pages/Home.tsx`, `src/pages/TrajectoryLab.tsx`, `src/pages/Trainer.tsx`)**: Added a loading message for the lazy-loaded Return Trainer, `aria-label`s on navigation landmarks, Trajectory Lab SVGs, and the 3x3 return grid buttons, plus clearer hero SVG alt text.
- **Misleading labels (`src/pages/Home.tsx`, `src/pages/Trainer.tsx`, `src/pages/MagnusExplorer.tsx`, `src/pages/TrajectoryLab.tsx`)**: Removed "Use the controls" on the control-free home page, renamed `Ball speed` to `Playback speed` in Trainer (it slows animation, not ball velocity), renamed `Direction`/`Ratio`/`Ball surface` to `Spin direction`/`Spin ratio`/`Surface speed`, and aligned `Spin / speed` to `Spin ratio`.
- **Factual and edge-case accuracy (`src/physics/shots.ts`, `src/pages/TrajectoryLab.tsx`, `src/pages/ShotGallery.tsx`)**: Fixed the Smash preset text claiming zero spin when its preset carries 12 rev/s, broadened the missing-touchdown note when either shot fails to reach table height, fixed the plan-view hint when Axis rake is 180 deg or spin is 0, and changed `Long` fallback to `Off the table`.
- **Terminology consistency (`src/ui/sections.ts`, `src/pages/BounceLab.tsx`, `src/physics/bounce.ts`, `src/pages/Predict.tsx`)**: Standardized bounce regime wording on "grip" and "slide" (removing mixed "skid"/"SKID"/"slide" labels) and unified "airflow" spelling in Magnus Explorer.
- **Units, empty states, and punctuation (`src/pages/ShotGallery.tsx`, `src/pages/Predict.tsx`, `src/pages/Trainer.tsx`, `src/trainer/strokes.ts`, `src/trainer/serves.ts`)**: Added visible units (`m/s`, `rev/s`, `s`) to Shot Gallery table cells, replaced bare em-dash placeholders with `N/A` or `0/0`, added context words to score counters (`correct`, `safe`), changed `Skip` to `Skip question`, renamed `On` to `Safe` and `On the table` to `Safe return` in Trainer, added the matching slow-push cue to `side-right` serves, fixed a double-space edge case in `explainReturn`, and removed all em dashes and prose en dashes.

## Left alone on purpose

- **Hero headline and page headers (`Home.tsx`, page `PageHeader` titles/questions)**: Already clear, direct, and consistent with the site's voice.
- **Physics claims and `describeSpin` outputs (`src/physics/spin.ts`, `src/physics/physics.test.ts`, `src/trainer/trainer.test.ts`)**: Backed by unit tests and left untouched to keep prose and tests aligned.
- **British spelling (`metres`, `travelling`, `forwards`, `backwards`, `visualisations`)**: Existing site convention preserved throughout.
- **Internal specs and agent docs (`SPEC.md`, `AGENTS.md`, code comments)**: Developer documentation rather than user-facing copy.
- **Short top-nav labels (`Trajectory`, `Magnus`, `Bounce`, `Shots`, `Predict`, `Trainer`)**: Deliberately terse to fit a single horizontal nav row.

## Not done (next pass)

- **`explainReturn` for `popped` outcomes (`src/trainer/strokes.ts`)**: Currently `outcome === 'popped'` falls into the final `else` branch meant for `'own-half'`, stating the ball bounced downward on the receiver's half. Fixing this requires adding a logic branch, which was out of scope for a string-only pass.
- **Social preview image (`index.html`)**: No static `og:image` asset exists in `public/`; add one alongside `og:image` and `twitter:image` tags in a future pass.
