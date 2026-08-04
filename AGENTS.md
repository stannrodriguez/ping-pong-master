# Agents

## What this project is

An interactive explainer for the physics of table tennis spin. **Not a game** — the game
modes, AI opponent and multiplayer were removed deliberately. See [`SPEC.md`](SPEC.md) for
the reasoning; read it before adding anything. The Return Trainer (`/trainer`) is decision
practice graded by the simulator, not a game mode: no rally, no AI, no points.

## Commands

- `npm run dev` — Vite on port 5173 (`--host 0.0.0.0` is set in `vite.config.ts`)
- `npm run build` — `tsc -b && vite build`, output to `dist/`
- `npm test` — Vitest over the physics engine
- `npm run lint` — ESLint on `.ts`/`.tsx`

No backend or database. Fully client-side SPA, React Router v7 with `BrowserRouter`.
Routes: `/`, `/trajectory`, `/magnus`, `/bounce`, `/shots`, `/predict`, `/trainer`.

## Layout

| Path | What lives there |
| --- | --- |
| `src/physics/` | The engine. SI units only. Pure functions, no React. |
| `src/viz/` | Drawing primitives: projections, table frames, force arrows, streamlines. |
| `src/trainer/` | Return Trainer: serve generation, stroke grading, the R3F scene, audio. |
| `src/ui/` | Chrome: shell, nav, panels, sliders, readouts. |
| `src/pages/` | One file per route. |

## Rules that are not negotiable

These are load-bearing. Breaking one silently makes the app dishonest rather than merely
ugly.

1. **`src/physics/` never branches on a "spin type."** Topspin, backspin and sidespin are
   one Magnus term with different axes, and one friction impulse with different contact
   velocities. If you find yourself writing `if (topspin)` in the engine, the model is
   wrong, not the case you are trying to handle.

2. **SI units inside the engine.** Metres, seconds, kilograms, rad/s, newtons. Conversion
   to rev/s and centimetres happens at the UI edge, nowhere else.

3. **Prose claims must be backed by a test.** If the UI says something about the physics,
   `src/physics/physics.test.ts` asserts it. Two claims have already been caught wrong this
   way; that is the mechanism working, not a nuisance.

4. **Every trajectory view draws the no-spin baseline.** A single curve teaches nothing.

5. **Uniform metres-per-pixel.** Use `src/viz/projection.ts`. Never scale the two axes
   independently — it turns a 20 cm dip into a 40 cm dip.

6. **Force arrows are scaled at 1 g per fixed pixel length** (`src/viz/forceScale.ts`).
   Do not auto-fit them to the available space; the fixed scale is what makes the ball's
   weight readable as a ruler.

7. **At most three categorical hues per view.** Past three, no ordering clears the
   colour-vision separation floor. This is why the spin channel and the force channel are
   never both live in one view.

## Gotchas that have already cost time

- **Tailwind v4 arbitrary values need `[var(--x)]`, not `[--x]`.** The `[--x]` form silently
  generates no CSS and the build still reports success.
- **Never add an unlayered `* { margin: 0; padding: 0 }` reset.** Tailwind's utilities live
  in `@layer utilities`, and unlayered rules beat layered ones regardless of specificity, so
  it zeroes out spacing across the whole app. Preflight already handles the reset.
- **Container aspect ratios must match the view's world box.** With a uniform-scale
  projection, a mismatched container shrinks the drawing into the middle of an empty panel
  instead of stretching to fill it.
- **`text-transform: uppercase` mangles Greek letters** — "μ" becomes a capital Mu that
  reads as "M". Keep symbols out of uppercased labels.
- **Gravity and Magnus are exactly collinear for pure topspin or backspin**, and which is
  longer flips as spin passes 1 g. Anything drawing both needs a dynamic z-order.
- **`markerMid` on a traced path** puts an arrowhead on every vertex. On streamlines that is
  one every 0.035 radii, and the line renders as dots.
- **Shot presets are tuned against the simulator**, not hand-written. If you change a
  constant in `src/physics/`, re-check that every preset in `shots.ts` still lands legally.
- **Stroke and serve constants in `src/trainer/` are tuned the same way.** The coaching
  truths the trainer teaches are asserted in `src/trainer/trainer.test.ts`; if a constant
  changes anywhere in the engine, those tests decide whether the trainer still tells the
  truth. `/trainer` is the only WebGL view and is lazy-loaded so three.js stays out of
  every other page's bundle. Scene colours are literal copies of the CSS tokens — CSS
  variables cannot reach WebGL materials.

## Verifying UI work

Screenshot the page and look at it. Every visual bug listed above passed typecheck, lint and
build. Chromium is at `/opt/pw-browsers/chromium` with Playwright preconfigured
(`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`) — do not run `playwright install`.
