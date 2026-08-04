/**
 * Three tiny synthesized sounds — bounce, racket, and a dull miss — because the
 * rhythm of a serve is a real cue: short serves double-tap quickly, long serves
 * leave a beat before the ball is on you. No assets; everything is an oscillator.
 *
 * The AudioContext is created lazily on the first user gesture (autoplay policy),
 * and every call is a no-op when muted or before that first gesture.
 */

let context: AudioContext | undefined;
let muted = false;

export function setMuted(value: boolean) {
  muted = value;
}

/** Call from a real user gesture (the Start button) to unlock audio. */
export function unlockAudio() {
  if (!context) {
    try {
      context = new AudioContext();
    } catch {
      return; // No audio available — the trainer works silently.
    }
  }
  if (context.state === 'suspended') void context.resume();
}

function blip(frequency: number, duration: number, volume: number, type: OscillatorType) {
  if (muted || !context || context.state !== 'running') return;
  const t0 = context.currentTime;
  const osc = context.createOscillator();
  const gain = context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, t0);
  osc.frequency.exponentialRampToValueAtTime(frequency * 0.75, t0 + duration);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(1e-4, t0 + duration);
  osc.connect(gain).connect(context.destination);
  osc.start(t0);
  osc.stop(t0 + duration);
}

/** The ball hitting the table. */
export function bounceSound() {
  blip(210, 0.07, 0.12, 'triangle');
}

/** The ball leaving a racket. */
export function racketSound() {
  blip(340, 0.05, 0.14, 'square');
}

/** Net, floor, or a dead rep. */
export function missSound() {
  blip(110, 0.16, 0.12, 'sine');
}
