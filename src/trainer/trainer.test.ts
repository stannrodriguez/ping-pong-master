/**
 * The trainer's guarantee: the decision structure it teaches is real.
 *
 * Every "coaching truth" the trainer states — open the racket against backspin,
 * close it and block against fast topspin, hit through sidespin and aim against the
 * throw — is asserted here by actually playing the returns through the racket
 * contact model and the simulator. Nothing is looked up. If a stroke constant or a
 * physics constant changes, these tests decide whether the trainer still teaches
 * the truth; if they fail, either the constants or the trainer's copy must change.
 *
 * The serves graded here are the deterministic mid-range serve of each family
 * (`canonicalServe`), so the assertions are exact, not statistical.
 */

import { describe, expect, it } from 'vitest';

import { canonicalServe, generateServe, pickFamily, SERVE_FAMILIES } from './serves';
import { playReturn, type StrokeChoice } from './strokes';

const play = (family: Parameters<typeof canonicalServe>[0], choice: StrokeChoice) =>
  playReturn(canonicalServe(family).contact, choice);

describe('serve generation', () => {
  it('produces a playable canonical serve for every family', () => {
    for (const family of SERVE_FAMILIES) {
      const rep = canonicalServe(family.id);
      expect(rep.trajectory.isLegal).toBe(true);
      // First bounce on the server's own half — a legal serve, not just a legal shot.
      const first = rep.trajectory.events.find((e) => e.kind === 'bounce');
      expect(first!.position.z).toBeLessThan(0);
      // The receiver takes the ball after its bounce on their half, at a hittable height.
      expect(rep.contactT).toBeGreaterThan(rep.receiverBounceT);
      expect(rep.contact.position.z).toBeGreaterThan(0);
    }
  });

  it('produces playable randomised serves for every family', () => {
    // A fixed pseudo-random sequence, so a pathological draw can't flake the suite.
    let seed = 42;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    for (const family of SERVE_FAMILIES) {
      for (let i = 0; i < 5; i++) {
        const rep = generateServe(family.id, rng);
        expect(rep.trajectory.isLegal).toBe(true);
        expect(rep.contact.position.z).toBeGreaterThan(0);
      }
    }
  });

  it('serves more of what the player keeps missing', () => {
    const record = {
      backspin: { right: 10, total: 10 },
      float: { right: 10, total: 10 },
      topspin: { right: 0, total: 10 },
      'side-left': { right: 10, total: 10 },
      'side-right': { right: 10, total: 10 },
    };
    let count = 0;
    for (let i = 0; i < 2000; i++) {
      if (pickFamily(record) === 'topspin') count += 1;
    }
    // Weight 3 against four weights of 1 → expected share 3/7 ≈ 43%.
    expect(count / 2000).toBeGreaterThan(0.3);
    expect(count / 2000).toBeLessThan(0.6);
  });
});

describe('coaching truths', () => {
  it('open push returns heavy backspin; a flat or closed face buries it', () => {
    expect(play('backspin', { stroke: 'push', aim: 'straight' }).outcome).toBe('landed');
    expect(play('backspin', { stroke: 'drive', aim: 'straight' }).outcome).toBe('own-half');
    expect(play('backspin', { stroke: 'block', aim: 'straight' }).outcome).toBe('own-half');
  });

  it('flat drive punishes the no-spin float; pushing it is an error', () => {
    expect(play('float', { stroke: 'drive', aim: 'straight' }).outcome).toBe('landed');
    // The push that was correct against backspin now pops up or sails — the two
    // serves look identical in flight, and this asymmetry is the whole reason
    // float serves exist.
    const pushed = play('float', { stroke: 'push', aim: 'straight' }).outcome;
    expect(['popped', 'long']).toContain(pushed);
  });

  it('closed block beats the fast topspin serve; the open push balloons it', () => {
    expect(play('topspin', { stroke: 'block', aim: 'straight' }).outcome).toBe('landed');
    const pushed = play('topspin', { stroke: 'push', aim: 'straight' }).outcome;
    expect(['popped', 'own-half', 'long']).toContain(pushed);
  });

  it('sidespin throws the return toward its own kick side, and aiming against it compensates', () => {
    // Serve kicking left: a straight drive comes off the rubber thrown left...
    const straight = play('side-left', { stroke: 'drive', aim: 'straight' });
    expect((straight.trajectory.touchdown ?? straight.trajectory.landing)!.x).toBeLessThan(-0.2);
    // ...aiming right brings it back onto the table, aiming left doubles the error.
    expect(play('side-left', { stroke: 'drive', aim: 'right' }).outcome).toBe('landed');
    // Doubling down on the throw misses — wide of the sideline, or into the net
    // band on the way (the net overhangs the table, so a hard-thrown ball can
    // clip it before it ever reaches the sideline).
    expect(['wide', 'net']).toContain(play('side-left', { stroke: 'drive', aim: 'left' }).outcome);
    // Mirror serve, mirror answer.
    expect(play('side-right', { stroke: 'drive', aim: 'left' }).outcome).toBe('landed');
    expect(['wide', 'net']).toContain(play('side-right', { stroke: 'drive', aim: 'right' }).outcome);
  });

  it('a slow push against heavy sidespin is thrown too far to save with aim', () => {
    // The lateral throw scales with how long the spin has to bite relative to the
    // exit speed — a soft touch gives the rubber the ball for "longer" in the
    // sense that matters, the exit is slow, and the same sideways impulse moves a
    // slow ball further off line. Attack sidespin; don't poke at it.
    for (const aim of ['left', 'straight', 'right'] as const) {
      expect(play('side-left', { stroke: 'push', aim }).outcome).not.toBe('landed');
    }
  });

  it('every canonical serve has at least one winning choice — the trainer never deals a dead rep', () => {
    for (const family of SERVE_FAMILIES) {
      const contact = canonicalServe(family.id).contact;
      const strokes = ['push', 'drive', 'block'] as const;
      const aims = ['left', 'straight', 'right'] as const;
      const anyLanded = strokes.some((stroke) =>
        aims.some((aim) => playReturn(contact, { stroke, aim }).outcome === 'landed'),
      );
      expect(anyLanded).toBe(true);
    }
  });
});
