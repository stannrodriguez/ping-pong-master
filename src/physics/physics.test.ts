/**
 * These tests are the app's guarantee that its explanations are true.
 *
 * Every claim the UI makes in prose ("topspin dips", "heavy chop can bounce backwards",
 * "Magnus never changes the ball's speed") is asserted here against the engine. If a
 * test fails, the copy in the app has become a lie and one of the two has to change.
 */

import { describe, expect, it } from 'vitest';

import {
  BALL,
  CONTACT,
  GRAVITY,
  TABLE,
  RUBBER,
  bounceOffTable,
  componentsFromSpin,
  contactPointVelocity,
  contactWithRacket,
  cross,
  dot,
  dragForce,
  gripThreshold,
  launchFrom,
  liftCoefficient,
  magnusDecomposition,
  magnusForce,
  measure,
  rpsToRadPerSec,
  simulate,
  spinFromComponents,
  spinFromRake,
  spinRatio,
  length,
  v3,
  type Vec3,
} from './index';

/** A representative attacking shot: down the table toward -z. */
function shot(topspinRps: number, speed = 12) {
  const base = launchFrom({
    position: v3(0, 0.28, 1.4),
    speed,
    elevation: 5,
  });
  return {
    ...base,
    spin: spinFromComponents(base.velocity, {
      topspin: topspinRps,
      sidespin: 0,
      corkscrew: 0,
    }),
  };
}

describe('spin conventions', () => {
  it('builds topspin as a vector whose top surface moves along the travel direction', () => {
    const velocity = v3(0, 0, -10);
    const spin = spinFromComponents(velocity, { topspin: 50, sidespin: 0, corkscrew: 0 });
    // Velocity of the point at the top of the ball, relative to the centre: ω × rŷ.
    const topSurface = cross(spin, v3(0, BALL.radius, 0));
    expect(topSurface.z).toBeLessThan(0); // same sign as travel (-z)
    expect(Math.abs(topSurface.x)).toBeLessThan(1e-9);
  });

  it('round-trips components through the spin vector', () => {
    const velocity = v3(0, 2, -10);
    const components = { topspin: 40, sidespin: -25, corkscrew: 8 };
    const back = componentsFromSpin(velocity, spinFromComponents(velocity, components));
    expect(back.topspin).toBeCloseTo(components.topspin, 6);
    expect(back.sidespin).toBeCloseTo(components.sidespin, 6);
    expect(back.corkscrew).toBeCloseTo(components.corkscrew, 6);
  });

  it('sweeps rake from pure topspin to pure sidespin to pure backspin', () => {
    const velocity = v3(0, 0, -10);
    const rate = 60;
    expect(componentsFromSpin(velocity, spinFromRake(velocity, rate, 0)).topspin).toBeCloseTo(rate, 6);
    expect(componentsFromSpin(velocity, spinFromRake(velocity, rate, 90)).sidespin).toBeCloseTo(rate, 6);
    expect(componentsFromSpin(velocity, spinFromRake(velocity, rate, 180)).topspin).toBeCloseTo(-rate, 6);
  });
});

describe('aerodynamics', () => {
  it('points the Magnus force downward for topspin and upward for backspin', () => {
    const velocity = v3(0, 0, -12);
    const top = magnusForce(velocity, spinFromComponents(velocity, { topspin: 90, sidespin: 0, corkscrew: 0 }));
    const back = magnusForce(velocity, spinFromComponents(velocity, { topspin: -90, sidespin: 0, corkscrew: 0 }));

    expect(top.y).toBeLessThan(0);
    expect(back.y).toBeGreaterThan(0);
    expect(top.y).toBeCloseTo(-back.y, 9);
  });

  it('points the Magnus force sideways for sidespin, with no vertical component', () => {
    const velocity = v3(0, 0, -12);
    const side = magnusForce(velocity, spinFromComponents(velocity, { topspin: 0, sidespin: 60, corkscrew: 0 }));
    expect(Math.abs(side.y)).toBeLessThan(1e-12);
    expect(side.x).toBeLessThan(0); // positive sidespin curves toward -x
  });

  it('produces no Magnus force from spin about the direction of travel', () => {
    const velocity = v3(0, 0, -12);
    const drill = spinFromComponents(velocity, { topspin: 0, sidespin: 0, corkscrew: 120 });
    expect(length(magnusForce(velocity, drill))).toBeLessThan(1e-12);
    expect(spinRatio(velocity, drill)).toBeLessThan(1e-12);
  });

  it('never changes the ball\'s speed — Magnus is always perpendicular to velocity', () => {
    const velocity = v3(1.5, 2, -11);
    for (const rake of [0, 30, 60, 90, 145, 180]) {
      const spin = spinFromRake(velocity, 80, rake);
      const { along, perpendicularMagnitude } = magnusDecomposition(velocity, spin);
      expect(Math.abs(along)).toBeLessThan(1e-12);
      expect(perpendicularMagnitude).toBeGreaterThan(0);
    }
  });

  it('scales spin ratio with spin and inversely with speed', () => {
    const spin = v3(0, 0, 0);
    expect(spinRatio(v3(0, 0, -10), spin)).toBe(0);

    const omega = rpsToRadPerSec(80);
    // S = rω/v with ω ⊥ v
    expect(spinRatio(v3(0, 0, -10), v3(omega, 0, 0))).toBeCloseTo((BALL.radius * omega) / 10, 9);
    expect(spinRatio(v3(0, 0, -5), v3(omega, 0, 0))).toBeCloseTo((BALL.radius * omega) / 5, 9);
  });

  it('saturates the lift coefficient at high spin ratio', () => {
    expect(liftCoefficient(0)).toBe(0);
    expect(liftCoefficient(0.25)).toBeCloseTo(0.15, 2);
    expect(liftCoefficient(1)).toBeCloseTo(0.3, 2);
    // Doubling S well past saturation gains far less than double the lift.
    expect(liftCoefficient(8) / liftCoefficient(4)).toBeLessThan(1.1);
    expect(liftCoefficient(1000)).toBeLessThan(0.45);
  });

  it('opposes drag to the velocity and grows with the square of speed', () => {
    const slow = dragForce(v3(0, 0, -5), v3());
    const fast = dragForce(v3(0, 0, -10), v3());
    expect(slow.z).toBeGreaterThan(0); // opposes travel toward -z
    expect(length(fast) / length(slow)).toBeCloseTo(4, 6);
  });

  it('makes drag comparable to gravity at rally speeds', () => {
    // A well-known and counter-intuitive fact about table tennis: at 12 m/s the air
    // decelerates the ball harder than gravity accelerates it.
    const drag = length(dragForce(v3(0, 0, -12), v3()));
    expect(drag / (BALL.mass * GRAVITY)).toBeGreaterThan(1);
  });
});

describe('bounce', () => {
  const incoming = (topspinRps: number, vz = -10, vy = -3): { velocity: Vec3; spin: Vec3 } => {
    const velocity = v3(0, vy, vz);
    return {
      velocity,
      spin: spinFromComponents(velocity, { topspin: topspinRps, sidespin: 0, corkscrew: 0 }),
    };
  };

  it('applies restitution on the normal axis', () => {
    const result = bounceOffTable(incoming(0));
    expect(result.velocity.y).toBeCloseTo(3 * CONTACT.restitution, 9);
  });

  it('computes contact-point velocity as v + ω × (-rŷ)', () => {
    const { velocity, spin } = incoming(0);
    // With no spin, the contact patch simply moves with the ball.
    expect(contactPointVelocity(velocity, spin).z).toBeCloseTo(velocity.z, 9);

    // With topspin the surface moves backwards under the ball, cancelling some travel.
    const spun = incoming(80);
    expect(Math.abs(contactPointVelocity(spun.velocity, spun.spin).z)).toBeLessThan(
      Math.abs(velocity.z),
    );
  });

  it('grips when the contact patch is nearly at rest and slips when it is not', () => {
    // Rolling: rω = v means the contact patch is stationary.
    const rollingRps = 10 / BALL.radius / (2 * Math.PI);
    expect(bounceOffTable(incoming(rollingRps)).regime).toBe('grip');
    // Heavy backspin: surface motion and travel add, so the patch races forwards.
    expect(bounceOffTable(incoming(-80)).regime).toBe('slip');
  });

  it('brings the contact point to rest exactly when it grips', () => {
    const result = bounceOffTable(incoming(70, -8, -3));
    expect(result.regime).toBe('grip');
    expect(length(result.contactVelocityAfter)).toBeLessThan(1e-9);
  });

  it('caps the friction impulse at μ·J_n when it slips', () => {
    const result = bounceOffTable(incoming(-80));
    expect(result.regime).toBe('slip');
    expect(length(result.frictionImpulse)).toBeCloseTo(result.frictionImpulseAvailable, 12);
    expect(result.frictionImpulseRequired).toBeGreaterThan(result.frictionImpulseAvailable);
    expect(result.frictionImpulseAvailable).toBeCloseTo(
      CONTACT.friction * result.normalImpulse,
      12,
    );
  });

  it('keeps more horizontal speed with topspin than without spin — the kick', () => {
    const flat = bounceOffTable(incoming(0));
    const top = bounceOffTable(incoming(90));
    expect(Math.abs(top.velocity.z)).toBeGreaterThan(Math.abs(flat.velocity.z));
    expect(top.regime).toBe('grip');
    expect(flat.regime).toBe('slip');
  });

  it('strips the same speed from backspin as from no spin at equal impact velocity', () => {
    // Worth stating plainly because the folk explanation ("backspin slows the ball
    // down at the bounce") is not what this model says. Once friction has saturated,
    // the impulse is capped at μ·J_n and pointed against the slip, and adding more
    // backspin makes the patch slip faster without making friction any larger.
    // What backspin really changes at the bounce is the outgoing *spin*.
    // Chops feel slow off the table because they arrive slow and steep, not because
    // the bounce takes more speed off them than it would off a nothing-ball.
    const flat = bounceOffTable(incoming(0));
    const back = bounceOffTable(incoming(-90));
    expect(back.regime).toBe('slip');
    expect(Math.abs(back.velocity.z)).toBeCloseTo(Math.abs(flat.velocity.z), 9);
  });

  it('accelerates the ball off the bounce when rω exceeds v', () => {
    // A slow, very heavy loop: the surface is moving backwards faster than the ball is
    // travelling forwards, so friction drives the ball forwards.
    const state = incoming(140, -6, -3);
    const result = bounceOffTable(state);
    expect(Math.abs(result.velocity.z)).toBeGreaterThan(Math.abs(state.velocity.z));
  });

  it('can send a heavy slow chop backwards', () => {
    // The signature defensive phenomenon, produced here purely by friction.
    const state = incoming(-95, -1.2, -4.2);
    const result = bounceOffTable(state);
    expect(result.velocity.z).toBeGreaterThan(0); // reversed relative to travel toward -z
  });

  it('reduces backspin at the bounce, and can reverse it', () => {
    const state = incoming(-90, -6, -3);
    const before = componentsFromSpin(state.velocity, state.spin).topspin;
    const after = componentsFromSpin(state.velocity, bounceOffTable(state).spin).topspin;
    expect(before).toBeLessThan(0);
    expect(after).toBeGreaterThan(before); // friction always drives spin toward rolling
  });

  it('does NOT kick sideways for a purely vertical spin axis', () => {
    // The contact point sits on the spin axis, so the surface there has no velocity
    // from the spin and friction has nothing lateral to bite on. The ball pivots.
    // Pure sidespin curves in the air and then bounces perfectly straight — which
    // contradicts a lot of coaching folklore, and is why the app draws the axis.
    const velocity = v3(0, -3, -10);
    const spin = spinFromComponents(velocity, { topspin: 0, sidespin: 90, corkscrew: 0 });
    const result = bounceOffTable({ velocity, spin });
    expect(Math.abs(result.velocity.x)).toBeLessThan(1e-12);
  });

  it('kicks sideways for corkscrew spin, which curves not at all in flight', () => {
    // The complementary half: an axis along the direction of travel produces zero
    // Magnus force, but puts the contact point well off the axis, so it produces the
    // largest lateral kick of any spin. The sideways kick players see off a serve
    // comes from the raked part of the axis, not from the "sidespin" part.
    const velocity = v3(0, -3, -10);
    const spin = spinFromComponents(velocity, { topspin: 0, sidespin: 0, corkscrew: 90 });
    const result = bounceOffTable({ velocity, spin });
    expect(Math.abs(result.velocity.x)).toBeGreaterThan(0.5);

    // Corkscrew is defined about the *horizontal* direction of travel — the axis a
    // player aims for — so a descending ball still presents a little of it to the
    // airflow. Magnus sees less than a third of the spin it would see from the same
    // rate applied as sidespin, and none at all on a level ball.
    const sidespin = spinFromComponents(velocity, { topspin: 0, sidespin: 90, corkscrew: 0 });
    expect(spinRatio(velocity, spin)).toBeLessThan(0.35 * spinRatio(velocity, sidespin));
    expect(spinRatio(v3(0, 0, -10), spinFromComponents(v3(0, 0, -10), {
      topspin: 0,
      sidespin: 0,
      corkscrew: 90,
    }))).toBeLessThan(1e-12);
  });

  it('raises the grip threshold with impact speed', () => {
    expect(gripThreshold(6)).toBeCloseTo(2 * gripThreshold(3), 9);
    // A ball dropping harder can grip a faster-moving contact patch.
    expect(gripThreshold(3)).toBeGreaterThan(0);
  });

  it('drives spin toward rolling in every regime', () => {
    for (const rps of [-120, -60, -20, 0, 20, 60, 120]) {
      const state = incoming(rps);
      const result = bounceOffTable(state);
      const before = length(contactPointVelocity(state.velocity, state.spin));
      const after = length(result.contactVelocityAfter);
      expect(after).toBeLessThanOrEqual(before + 1e-9);
    }
  });

  it('conserves energy — a bounce never adds kinetic energy', () => {
    for (const rps of [-120, -40, 0, 40, 120]) {
      const state = incoming(rps);
      const result = bounceOffTable(state);
      const energy = (v: Vec3, w: Vec3) =>
        0.5 * BALL.mass * length(v) ** 2 +
        0.5 * BALL.inertiaFactor * BALL.mass * BALL.radius ** 2 * length(w) ** 2;
      expect(energy(result.velocity, result.spin)).toBeLessThanOrEqual(
        energy(state.velocity, state.spin) + 1e-12,
      );
    }
  });
});

describe('racket contact', () => {
  // A blade held vertically, facing a ball that arrives travelling +z.
  const blade = (velocity: Vec3 = v3()): { normal: Vec3; velocity: Vec3 } => ({
    normal: v3(0, 0, -1),
    velocity,
  });
  const ball = (topspinRps: number, speed = 5): { velocity: Vec3; spin: Vec3 } => {
    const velocity = v3(0, 0, speed);
    return {
      velocity,
      spin: spinFromComponents(velocity, { topspin: topspinRps, sidespin: 0, corkscrew: 0 }),
    };
  };

  it('reflects a spinless ball off a stationary blade with the rubber restitution', () => {
    const result = contactWithRacket(ball(0), blade());
    expect(result.velocity.z).toBeCloseTo(-5 * RUBBER.restitution, 9);
    expect(Math.abs(result.velocity.x)).toBeLessThan(1e-12);
    expect(Math.abs(result.velocity.y)).toBeLessThan(1e-12);
    expect(length(result.spin)).toBeLessThan(1e-12);
  });

  it('kicks an incoming topspin ball upward off the blade, and backspin downward', () => {
    // The receiver's whole problem in one assertion: the server's spin decides
    // which way the ball leaves *your* racket. Topspin makes the contact patch
    // slide down the rubber, so friction throws the ball up; backspin the reverse.
    // This is why a face angle that returns one serve buries the other.
    expect(contactWithRacket(ball(60), blade()).velocity.y).toBeGreaterThan(0.5);
    expect(contactWithRacket(ball(-60), blade()).velocity.y).toBeLessThan(-0.5);
  });

  it('throws a sidespin ball laterally off the blade', () => {
    const velocity = v3(0, 0, 5);
    const spun = {
      velocity,
      spin: spinFromComponents(velocity, { topspin: 0, sidespin: 60, corkscrew: 0 }),
    };
    const result = contactWithRacket(spun, blade());
    expect(Math.abs(result.velocity.x)).toBeGreaterThan(0.5);
  });

  it('caps the friction impulse at μ·J_n when the ball slides', () => {
    // Slip needs heavy spin AND a soft approach: the normal impulse scales with
    // approach speed, so a fast ball hands friction a big enough budget to grip
    // almost anything. A slow touch against heavy spin is where the rubber slides.
    const result = contactWithRacket(ball(-140, 3), blade());
    expect(result.regime).toBe('slip');
    expect(length(result.frictionImpulse)).toBeCloseTo(result.frictionImpulseAvailable, 12);
    expect(result.frictionImpulseAvailable).toBeCloseTo(
      RUBBER.friction * result.normalImpulse,
      12,
    );
  });

  it('grips at spin levels the slicker table would let slide', () => {
    const incoming = ball(-60, 5);
    const offRacket = contactWithRacket(incoming, blade());
    const offTable = bounceOffTable({
      velocity: v3(0, -5, 0.001),
      spin: incoming.spin,
    });
    expect(offRacket.regime).toBe('grip');
    expect(offTable.regime).toBe('slip');
  });

  it('imparts the stroke: a moving blade sends the ball back faster than a still one', () => {
    const still = contactWithRacket(ball(0), blade());
    const swung = contactWithRacket(ball(0), blade(v3(0, 0, -4)));
    expect(Math.abs(swung.velocity.z)).toBeGreaterThan(Math.abs(still.velocity.z) + 4);
  });

  it('passes the ball through untouched when it is not approaching the blade', () => {
    const receding = { velocity: v3(0, 0, -3), spin: v3(10, 0, 0) };
    const result = contactWithRacket(receding, blade());
    expect(result.velocity).toEqual(receding.velocity);
    expect(result.spin).toEqual(receding.spin);
    expect(result.normalImpulse).toBe(0);
  });

  it('never adds energy at a stationary blade', () => {
    const energy = (v: Vec3, w: Vec3) =>
      0.5 * BALL.mass * length(v) ** 2 +
      0.5 * BALL.inertiaFactor * BALL.mass * BALL.radius ** 2 * length(w) ** 2;
    for (const rps of [-120, -40, 0, 40, 120]) {
      const state = ball(rps, 6);
      const result = contactWithRacket(state, blade());
      expect(energy(result.velocity, result.spin)).toBeLessThanOrEqual(
        energy(state.velocity, state.spin) + 1e-12,
      );
    }
  });
});

describe('trajectories', () => {
  it('makes topspin land shorter and backspin land longer than the same shot with no spin', () => {
    const top = measure(shot(110));
    const flat = measure(shot(0));
    const back = measure(shot(-40, 8));

    expect(top.landingShift!.alongTable).toBeGreaterThan(0); // toward the net, i.e. shorter
    expect(back.landingShift!.alongTable).toBeLessThan(0);
    expect(flat.landingShift!.total).toBeCloseTo(0, 9);
  });

  it('can lift a heavy backspin ball more than its own weight, so it never comes down', () => {
    // Not a bug, and a hard limit real players run into: at S ≈ 1 the Magnus force
    // exceeds mg, so a hard-hit chop climbs instead of falling. It is the reason
    // backspin is a slow stroke — you cannot hit one hard and keep it on the table.
    const hard = simulate(shot(-110));
    expect(hard.touchdown).toBeUndefined();
    expect(hard.samples[hard.samples.length - 1].position.y).toBeGreaterThan(
      hard.samples[0].position.y,
    );
  });

  it('lowers the apex with topspin and raises it with backspin', () => {
    expect(measure(shot(110)).apex).toBeLessThan(measure(shot(0)).apex);
    expect(measure(shot(-110)).apex).toBeGreaterThan(measure(shot(0)).apex);
  });

  it('keeps a hard topspin loop on the table where the same shot without spin flies long', () => {
    // The single most important consequence of the Magnus effect in the sport.
    expect(simulate(shot(120)).isLegal).toBe(true);
    expect(simulate({ ...shot(120), spin: v3() }).isLegal).toBe(false);
  });

  it('curves sidespin laterally in flight', () => {
    const base = launchFrom({ position: v3(0, 0.25, 1.4), speed: 8, elevation: 10 });
    const spun = simulate({
      ...base,
      spin: spinFromComponents(base.velocity, { topspin: 0, sidespin: 80, corkscrew: 0 }),
    });
    const plain = simulate({ ...base, spin: v3() });
    expect(spun.landing!.x).toBeLessThan(plain.landing!.x - 0.05);
  });

  it('detects a ball that hits the net', () => {
    const low = launchFrom({ position: v3(0, 0.1, 1.3), speed: 6, elevation: -2 });
    const result = simulate(low);
    expect(result.events.some((e) => e.kind === 'net')).toBe(true);
    expect(result.isLegal).toBe(false);
  });

  it('measures net clearance from the top of the net', () => {
    const result = simulate(shot(90));
    expect(result.netClearance).toBeDefined();
    expect(result.netClearance!).toBeGreaterThan(0);
    // Cross-check against the raw sample nearest z = 0.
    const nearNet = result.samples.reduce((best, s) =>
      Math.abs(s.position.z) < Math.abs(best.position.z) ? s : best,
    );
    expect(result.netClearance!).toBeCloseTo(
      nearNet.position.y - TABLE.netHeight - BALL.radius,
      2,
    );
  });

  it('records a bounce event with its full contact analysis', () => {
    const bounce = simulate(shot(90)).events.find((e) => e.kind === 'bounce');
    expect(bounce?.bounce).toBeDefined();
    expect(bounce!.bounce!.regime).toMatch(/grip|slip/);
    expect(Math.abs(bounce!.position.z)).toBeLessThanOrEqual(TABLE.length / 2 + 1e-6);
  });

  it('integrates accurately enough that halving the step barely moves the landing point', () => {
    const coarse = simulate(shot(100), { dt: 1 / 240 });
    const fine = simulate(shot(100), { dt: 1 / 960 });
    expect(Math.abs(coarse.landing!.z - fine.landing!.z)).toBeLessThan(0.005);
  });

  it('reproduces free fall when the ball has no spin and barely moves', () => {
    // Drag is negligible at very low speed, so this should be textbook kinematics.
    const drop = simulate(
      { position: v3(0, 0.5, 1.0), velocity: v3(0, 0, 0), spin: v3() },
      { maxBounces: 1 },
    );
    const fall = 0.5 - BALL.radius;
    const expected = Math.sqrt((2 * fall) / GRAVITY);
    const bounce = drop.events.find((e) => e.kind === 'bounce')!;
    expect(bounce.t).toBeCloseTo(expected, 2);
  });

  it('samples monotonically in time', () => {
    const { samples } = simulate(shot(100));
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i].t).toBeGreaterThanOrEqual(samples[i - 1].t);
    }
  });

  it('decays spin during flight but keeps it the same sign', () => {
    const launch = shot(110);
    const { samples } = simulate(launch);
    const first = samples[0];
    const last = samples[samples.length - 1];
    expect(length(last.spin)).toBeLessThan(length(first.spin));
    expect(dot(last.spin, first.spin)).toBeGreaterThan(0);
  });
});
