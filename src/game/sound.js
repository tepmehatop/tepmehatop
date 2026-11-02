// Tiny WebAudio blips — no audio files needed.
let ctx;
const SOUNDS = {
  catch: [[880, 0.05], [1320, 0.08]],
  coffee: [[523, 0.06], [659, 0.06], [784, 0.1]],
  spawn: [[220, 0.03]],
  escape: [[196, 0.12], [147, 0.2]],
  over: [[392, 0.15], [330, 0.15], [262, 0.3]],
};

export function play(name, muted) {
  if (muted || !SOUNDS[name]) return;
  try {
    ctx ??= new AudioContext();
    let t = ctx.currentTime;
    for (const [freq, dur] of SOUNDS[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(name === 'spawn' ? 0.02 : 0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur);
      t += dur;
    }
  } catch {
    /* audio not available */
  }
}
