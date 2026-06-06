/**
 * Procedural beat machine — a fully *synthesized* (and therefore royalty-free,
 * copyright-clear) lo-fi loop built from WebAudio primitives: soft kick, hats,
 * a brushed clap, a warm sub bass, and a sustained triad pad, glued with a
 * gentle low-pass and a short feedback delay for air.
 *
 * It can render to ANY destination node, so the same engine powers:
 *   • the live reel preview  →  out = audioCtx.destination
 *   • the exported video     →  out = MediaStreamAudioDestinationNode
 *
 * Usage:
 *   const ctx = new AudioContext();
 *   await ctx.resume();                       // must be inside a user gesture
 *   const beat = createBeats(ctx, ctx.destination, { seed: 7 });
 *   ...later...
 *   beat.stop();
 */

export interface BeatHandle {
  /** Fade out, stop scheduling, and release nodes. Safe to call once. */
  stop: () => void;
}

export interface BeatOptions {
  /** Deterministic variation (key + tempo). Default 0. */
  seed?: number;
  /** Master loudness 0..1. Default 0.5. */
  gain?: number;
}

const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

// A handful of calm minor "vibes": base bass note (MIDI) + tempo.
const VIBES: Array<{ root: number; bpm: number }> = [
  { root: 45, bpm: 82 }, // A2
  { root: 43, bpm: 76 }, // G2
  { root: 41, bpm: 88 }, // F2
  { root: 48, bpm: 80 }, // C3
  { root: 44, bpm: 84 }, // G#2
];

// i – VI – III – VII in natural minor (root offset in semitones + chord quality).
const PROGRESSION: Array<{ root: number; minor: boolean }> = [
  { root: 0, minor: true },
  { root: 8, minor: false },
  { root: 3, minor: false },
  { root: 10, minor: false },
];

const triad = (minor: boolean): number[] => (minor ? [0, 3, 7] : [0, 4, 7]);

export function createBeats(
  ctx: AudioContext,
  out: AudioNode,
  opts: BeatOptions = {},
): BeatHandle {
  const vibe = VIBES[(opts.seed ?? 0) % VIBES.length];
  const targetGain = opts.gain ?? 0.5;
  const stepDur = 60 / vibe.bpm / 4; // 16th-note duration (seconds)

  // ---- bus: noise softener (lowpass) + feedback delay for air, into master --
  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(out);
  master.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 1.4);

  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 4800;
  tone.Q.value = 0.4;
  tone.connect(master);

  const delay = ctx.createDelay(1.0);
  delay.delayTime.value = stepDur * 3; // dotted-ish echo
  const fb = ctx.createGain();
  fb.gain.value = 0.22;
  const wet = ctx.createGain();
  wet.gain.value = 0.16;
  delay.connect(fb).connect(delay);
  delay.connect(wet).connect(master);

  // shared noise buffer (hats / clap)
  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.4, ctx.sampleRate);
  const nd = noise.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

  // ---- voices --------------------------------------------------------------
  const kick = (t: number, vel = 1) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.95 * vel, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    o.connect(g).connect(tone);
    o.start(t);
    o.stop(t + 0.3);
  };

  const hat = (t: number, vel = 0.18) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    s.connect(hp).connect(g).connect(tone);
    s.start(t);
    s.stop(t + 0.07);
  };

  const clap = (t: number) => {
    const s = ctx.createBufferSource();
    s.buffer = noise;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    bp.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    s.connect(bp).connect(g).connect(delay); // feed the echo for space
    s.connect(bp).connect(g).connect(tone);
    s.start(t);
    s.stop(t + 0.2);
  };

  const bass = (t: number, midi: number, dur: number) => {
    const o = ctx.createOscillator();
    o.type = "triangle";
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    const g = ctx.createGain();
    o.frequency.value = midiToFreq(midi);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.02);
    g.gain.setValueAtTime(0.5, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(master);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  const pad = (t: number, midis: number[], dur: number) => {
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0.0001, t);
    vg.gain.linearRampToValueAtTime(0.16, t + 0.25);
    vg.gain.setValueAtTime(0.16, t + dur * 0.7);
    vg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    vg.connect(tone);
    vg.connect(delay);
    for (const m of midis) {
      for (const detune of [-4, 4]) {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = midiToFreq(m);
        o.detune.value = detune;
        o.connect(vg);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
  };

  // ---- scheduler (lookahead) ----------------------------------------------
  let step = 0; // 16th-note counter
  let nextTime = ctx.currentTime + 0.12;
  const LOOKAHEAD = 0.12;

  const scheduleStep = (s: number, t: number) => {
    const bar = Math.floor(s / 16) % PROGRESSION.length;
    const chord = PROGRESSION[bar];
    const inBar = s % 16;

    // pad + bass at the top of each bar
    if (inBar === 0) {
      const rootMidi = vibe.root + chord.root;
      const padMidis = triad(chord.minor).map((iv) => rootMidi + 12 + iv);
      pad(t, padMidis, stepDur * 16);
      bass(t, rootMidi, stepDur * 7);
      bass(t + stepDur * 8, rootMidi, stepDur * 6); // beat 3 reinforce
    }

    // kick on beats 1 and 3, soft ghost before the turnaround
    if (inBar === 0 || inBar === 8) kick(t, 1);
    if (inBar === 14 && bar === PROGRESSION.length - 1) kick(t, 0.5);

    // clap/snare on 2 and 4
    if (inBar === 4 || inBar === 12) clap(t);

    // hats on every 8th, accent the offbeats
    if (inBar % 2 === 0) hat(t, inBar % 4 === 2 ? 0.22 : 0.13);
  };

  const timer = window.setInterval(() => {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(step, nextTime);
      nextTime += stepDur;
      step += 1;
    }
  }, 25);

  let stopped = false;
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      const now = ctx.currentTime;
      try {
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0.0001, now + 0.4);
      } catch {
        /* context may be closing */
      }
      window.setTimeout(() => {
        try {
          master.disconnect();
          tone.disconnect();
          delay.disconnect();
          wet.disconnect();
          fb.disconnect();
        } catch {
          /* already gone */
        }
      }, 600);
    },
  };
}
