# SPIN — Spec

**Goal: help someone understand the physics of table tennis spin.**

Not "play a game that happens to have spin in it." The success criterion is that a
curious person leaves the app able to explain *why* a topspin ball dips, *why* a heavy
chop can bounce backwards, and *why* the same spin behaves differently at different
speeds.

---

## 1. Why the current app fails the goal

| Problem | Consequence |
| --- | --- |
| Arbitrary units (table is `5 × 9`, spin is a raw "rpm" number fed straight into a made-up coefficient) | Nothing on screen maps to a real quantity. A learner can't check any claim against reality. |
| Bounce is a lookup of fudge factors (`if topspin: vz *= 1.15`) | The single most interesting event in the sport is *asserted*, not simulated. The app can't explain the mechanism because it doesn't model it. |
| Visualization is a coloured tube through a dark 3D scene | Shows *that* paths differ. Never shows *why*: no forces, no scale, no numbers, no comparison baseline. |
| Learning content is a static text panel + trivia quiz | Facts to memorise, disconnected from the simulation. |

## 2. Design principles

1. **Real units, everywhere.** SI throughout the engine. Metres, m/s, rev/s, newtons.
   Every number on screen has a unit and is checkable against a real table.
2. **Simulate the mechanism, never the outcome.** No per-spin-type special cases
   anywhere in the engine. Topspin dipping and backspin floating must both *fall out of*
   one Magnus term. The forward kick and the backspin stall must both fall out of one
   friction-impulse contact model. If a phenomenon can't be reproduced from the
   mechanism, we say so rather than faking it.
3. **Always show a baseline.** A trajectory alone teaches nothing. Every spin path is
   drawn against the same shot with zero spin, so the *deviation* is the visible object.
4. **Forces are first-class visuals.** Gravity, drag and Magnus are drawn as scaled,
   labelled vectors on the moving ball, with live magnitudes. The force diagram *is* the
   explanation.
5. **Let the learner falsify.** Controls are continuous and the readouts update live, so
   a learner can form a prediction, move a slider, and be right or wrong immediately.

## 3. Physics model

Coordinate frame: `x` across the table (+ = right), `y` up, `z` along the length.
Origin at table centre, on the playing surface.

### 3.1 Constants (ITTF regulation)

| Quantity | Value |
| --- | --- |
| Ball diameter / mass | 40 mm / 2.7 g |
| Table | 2.74 m × 1.525 m, 0.76 m high |
| Net height | 15.25 cm |
| Air density | 1.20 kg/m³ |
| Moment of inertia | `(2/3)mr²` (hollow sphere) |

### 3.2 Flight

Two aerodynamic forces plus gravity:

```
F_drag   = -½ ρ A C_D(S) |v|  v
F_magnus =  ½ ρ A C_L(S) |v|² · normalise(ω × v)
```

where the **spin ratio** `S = r·|ω⊥| / |v|` (only the component of ω perpendicular to v
produces a Magnus force). Coefficients are smooth saturating fits to published table
tennis wind-tunnel data:

```
C_L(S) = 0.45 · S / (S + 0.5)      # ≈0.15 at S=0.25, ≈0.30 at S=1.0
C_D(S) = 0.40 + 0.12 · S / (S + 0.5)
```

`S` is the reason the app exists: it says spin only matters *relative to speed*. A
slow heavy loop and a fast heavy loop have the same rev/s and completely different
shapes, and the app should make that inescapable.

Spin decays in flight with a ~4 s time constant (a documented simplification — the real
aerodynamic moment is speed-dependent, and the difference is invisible over one flight).

### 3.3 Bounce — the important part

Modelled as a single impulse at the contact point, not a table of outcomes.

Normal: `v_y' = -e·v_y` with `e = 0.90`.

Tangential: the **contact-point velocity** `u = v_t + ω × (-r ŷ)` decides everything. It
is the velocity of the patch of ball actually touching the table, and it is what friction
acts on.

- Rolling impulse required to kill slip: `J_roll = -0.4·m·u` (the `0.4` is
  `1/(1+1/α)` with `α = 2/3`).
- Available friction impulse: `μ·J_n` with `J_n = m(1+e)|v_y|`, `μ = 0.25`.
- **Grip** if `|u| ≤ 2.5·μ·(1+e)·|v_y|` → contact point is brought to rest.
- **Slip** otherwise → `J_t = -μ·J_n·û`, the ball slides through the whole contact.

Everything a player knows falls out of this one rule:

- **Topspin** — `u` is small (the surface is already moving backwards under the ball,
  cancelling most of the travel), so friction is small. The ball keeps its horizontal
  speed and leaves at a shallower angle: the "kick". With `rω > v` friction points
  *forwards* and the ball genuinely accelerates off the bounce — the tuned loop preset
  leaves the table at 10.3 m/s having arrived at 8.9 m/s.
- **Backspin** — `u` is huge (surface motion and travel add), friction saturates, and the
  ball is scrubbed of spin. Heavy chop at low speed reverses and bounces backwards.
- **The threshold is visible.** There is a specific incoming spin at which the ball stops
  sliding and starts gripping, and the outgoing behaviour changes character there. This
  is a real, chartable discontinuity in slope, and no fudge-factor model has it.

Two results here fall out of the model rather than being designed in, and both
contradict common coaching folklore. The app leads with them, because being able to
surprise someone with a correct prediction is the strongest evidence that the model is
doing real work:

- **A purely vertical spin axis produces no sideways kick at all.** The contact point
  lies *on* the axis, so the surface there isn't moving and friction has nothing lateral
  to bite on — the ball pivots and bounces straight. The kick off a real sidespin serve
  comes from the part of the axis raked toward the direction of travel, which is
  precisely the part that produces *no* curve in the air. Curve and kick come from
  perpendicular halves of the same axis.
- **Extra backspin does not take extra speed off the bounce.** Once friction saturates,
  the impulse is capped at `μ·J_n` whatever the slip speed. What more backspin buys is a
  change in outgoing *spin*, not outgoing speed. Chops feel slow off the table because
  they arrive slow and steep, not because the bounce is doing something extra to them.

Both are asserted in `physics.test.ts`, so the app's prose cannot drift away from what
the engine actually does.

### 3.4 Integration

RK4 at fixed `dt`, with bisection to land exactly on the table-plane and net-plane
crossings so contact events are resolved at the true crossing time rather than smeared
across a step.

## 4. The app

Six routes, each answering one question.

| Route | Question it answers |
| --- | --- |
| `/` | What is this, and what does spin actually look like? |
| `/trajectory` | What shape does *this* shot make, and what forces make that shape? |
| `/magnus` | Why does spinning air push a ball sideways at all? |
| `/bounce` | What happens in the 0.5 ms the ball touches the table? |
| `/shots` | How do the real named shots compare, measurably? |
| `/predict` | Can I actually predict what happens now? |

### 4.1 `/trajectory` — Trajectory Lab (flagship)

Real-scale table. Continuous controls for speed, launch angle, launch height, spin rate
and spin axis (rake from pure topspin through pure sidespin).

Three linked views of the same simulation:
- **Side elevation** (SVG, metre gridlines) — the dip/float axis.
- **Plan view** (SVG) — the curve axis.
- **3D** (R3F) — spatial intuition, especially for a raked axis.

Always overlaid: the same shot with zero spin, as a dashed ghost. The shaded area
between the two *is* the Magnus effect.

On the ball, live scaled force vectors (gravity / drag / Magnus) with magnitudes in mN
and in g. Readout panel: spin ratio S, apex, net clearance, landing distance, flight
time, and deviation from the no-spin baseline. Timeline scrubber with play/pause/step.

### 4.2 `/magnus` — Magnus Explorer

Cross-section of the ball in its own airflow. Streamlines deflect around the ball;
the surface velocity adds to the flow on one side and opposes it on the other; the
asymmetry is drawn as a pressure field, and the net force follows. Drag the spin axis
and watch the force rotate with it. A `C_L` vs spin-ratio curve with the current
operating point marked, so the saturation is visible rather than asserted.

### 4.3 `/bounce` — Bounce Lab

The contact event, slowed down. Incoming velocity and spin vectors, the contact-point
velocity `u` drawn at the bottom of the ball, the friction impulse opposing it, and the
outgoing state. A grip/slip regime badge. Charts sweeping incoming spin against exit
speed, exit angle and exit spin, with the grip threshold marked on each.

### 4.4 `/shots` — Shot Gallery

Canonical shots (loop drive, counter-hit, chop, block, smash, float serve, pendulum
sidespin serve) with their real parameters, as small-multiple trajectories plus a
sortable comparison table of measured outcomes.

### 4.5 `/predict` — Predict It

Grounded in the simulator, not trivia: given a setup, predict the landing point or pick
which of three paths belongs to which spin. Reveal runs the actual sim and explains the
result with the same force diagram used in the Trajectory Lab.

## 5. Non-goals

- Gameplay, AI opponents, multiplayer, scoring. The old game modes are removed; they
  competed for attention with the goal and none of them taught the mechanism.
- Photoreal rendering. Clarity beats spectacle: legible scale, labelled axes and honest
  numbers are the point.

## 6. Delivery

Merged in sequence, each under 2000 lines:

1. Physics engine in SI units + unit tests (this PR)
2. App shell, design system, home page; remove the old game
3. Trajectory Lab
4. Magnus Explorer
5. Bounce Lab
6. Shot Gallery + Predict It
