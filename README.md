# SPIN — the physics of table tennis

An interactive explainer for one question: **why does a spinning ping pong ball do what it does?**

Not a game. Every view exists to make one mechanism visible, in real units, with the working shown.

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # physics engine tests
```

## The views

| Route | Question it answers |
| --- | --- |
| `/` | What does spin actually look like? |
| `/trajectory` | What shape does this shot make, and what forces make that shape? |
| `/magnus` | Why does spinning air push a ball sideways at all? |
| `/bounce` | What happens in the half-millisecond the ball touches the table? |
| `/shots` | How do the real named strokes compare, measurably? |
| `/predict` | Can you predict what the physics will do? |

## How it works

**One engine, no special cases.** `src/physics/` is SI throughout — metres, m/s, rad/s,
newtons — with ITTF constants (40 mm / 2.7 g ball, 2.74 m table, 15.25 cm net). Nothing in
it branches on a "spin type". Topspin, backspin and sidespin are one Magnus term with three
different axes:

```
F_magnus = ½ρA·C_L(S)·|v|²·normalise(ω × v)
```

**The bounce is derived, not tabulated.** Friction acts on the *contact-point velocity*
`u = v + ω × (-rŷ)` — the velocity of the patch of ball actually touching the table, which
differs from the ball's own velocity whenever it is spinning. Grip and slip fall out of
comparing the impulse gripping would need against the `μ·J_n` the surface can supply.
Every phenomenon a player knows comes out of that one rule.

**Every claim is tested.** `src/physics/physics.test.ts` asserts the things the UI says in
prose. If a test fails, the app's copy has become a lie and one of the two has to change.

## Things the model produces that it was never told to

None of these are coded as special cases. They emerge from the two mechanisms above, which
is the whole reason for building it this way.

- **The topspin kick.** The tuned loop preset arrives at the table at 8.9 m/s and leaves at
  **10.3 m/s**. Because `rω > v`, the contact patch is moving backwards under the ball and
  friction points forwards.
- **A hard chop never comes down.** At S ≈ 1 the Magnus force exceeds the ball's weight, so
  a hard-hit backspin ball climbs. That is why backspin is a slow stroke.
- **Drag beats gravity.** Above about 11 m/s the air decelerates the ball harder than
  gravity accelerates it.
- **A purely vertical spin axis produces no sideways kick at all.** The contact point sits
  *on* the axis, so the surface there isn't moving and friction has nothing lateral to bite
  on. Pure sidespin curves in the air and then bounces dead straight. The kick off a real
  sidespin serve comes from the part of the axis raked toward the direction of travel —
  which is exactly the part that produces *no* curve in the air.
- **Extra backspin doesn't take extra speed off the bounce.** Once friction saturates the
  impulse is capped at `μ·J_n` whatever the slip speed. More backspin changes the outgoing
  *spin*, not the outgoing speed. It shows up as a visible plateau on the Bounce Lab charts.

The last two contradict common coaching folklore. Both were found by writing the prose
first, then having the tests disagree with it.

## Design rules

- **Always show the baseline.** Every spin path is drawn against the identical shot with
  zero spin. A lone curve teaches nothing; the gap is the Magnus effect.
- **Real units on every number**, with the unit visible. Tabular figures so live readouts
  don't jitter.
- **Gravity is the ruler.** Force arrows are scaled so one "gravity length" is always
  exactly 1 g. An arrow twice as long as the gravity arrow *is* 2 g.
- **Uniform metres-per-pixel.** Everything is drawn to scale through one projection layer,
  so a distance measured on one chart means the same on the next.
- **Simulate the mechanism, never the outcome.** If a behaviour can't be produced from the
  mechanism, the app says so rather than faking it.
- **Colour is computed, not chosen.** Categorical hues are validated with OKLab ΔE under
  simulated colour-vision deficiency. At most three share a view, which is why the spin
  channel and the force channel are never both live.

Full rationale in [`SPEC.md`](SPEC.md).

## Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Vitest. No backend and no runtime
dependencies beyond the framework — the physics and the drawing are all local.
