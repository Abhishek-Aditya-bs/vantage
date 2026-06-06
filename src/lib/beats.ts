/**
 * Procedural beat machine — a fully *synthesized* (royalty-free, copyright-clear)
 * groove built from WebAudio primitives. No samples, no copyrighted audio.
 *
 * Four kits, picked at random each run so no two reels sound the same:
 *   • house   — four-on-the-floor kick, offbeat open hats, claps (energetic)
 *   • trap    — syncopated kick, half-time snare, rolling hi-hats + 808 sub
 *   • boombap — punchy swung kick/snare, jazzy chord, walking bass
 *   • lofi    — chilled kick/snare, warm pad (the calm option)
 *
 * A DynamicsCompressor glues + loudens the mix so it actually hits. It renders to
 * ANY destination node, so the same engine powers the live preview (via an
 * <audio> element, which keeps it audible on iOS even with the silent switch on)
 * and the exported video's audio track (via a MediaStreamDestination).
 */

export type BeatStyle = "house" | "trap" | "boombap" | "lofi";

export interface BeatHandle {
  /** the kit that was chosen this run */
  style: BeatStyle;
  /** Fade out, stop scheduling, release nodes. Safe to call once. */
  stop: () => void;
}

export interface BeatOptions {
  /** force a specific kit; omit to pick at random */
  style?: BeatStyle;
  /** deterministic-ish nudge for key selection */
  seed?: number;
  /** master loudness 0..1. Default 0.85. */
  gain?: number;
}

const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

/** Small fast PRNG so fills/variation are varied but self-consistent per run. */
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STYLE_POOL: BeatStyle[] = ["house", "trap", "boombap", "house", "boombap", "lofi"];

// bpm range, tone-filter cutoff, whether to use the delay send
const KITS: Record<BeatStyle, { bpm: [number, number]; tone: number; delay: boolean }> = {
  house: { bpm: [121, 126], tone: 12000, delay: false },
  trap: { bpm: [136, 148], tone: 9500, delay: false },
  boombap: { bpm: [86, 94], tone: 8500, delay: true },
  lofi: { bpm: [76, 86], tone: 6500, delay: true },
};

const KEYS = [45, 43, 41, 48, 50, 38]; // root MIDI choices (A2/G2/F2/C3/D3/D2)
// i – VI – III – VII in natural minor
const PROG: Array<{ root: number; minor: boolean }> = [
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
  const rnd = mulberry32((opts.seed ?? 1) * 2654435761 + Math.floor(Math.random() * 1e9));
  const style = opts.style ?? STYLE_POOL[Math.floor(rnd() * STYLE_POOL.length)];
  const kit = KITS[style];
  const bpm = kit.bpm[0] + rnd() * (kit.bpm[1] - kit.bpm[0]);
  const stepDur = 60 / bpm / 4; // 16th-note duration
  const swing = style === "boombap" || style === "lofi" ? 0.14 : 0.0;
  const baseRoot = KEYS[Math.floor(rnd() * KEYS.length)];
  const targetGain = opts.gain ?? 0.85;

  // ---- master chain: buses → compressor → makeup gain → out ----------------
  const master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 28;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.22;
  comp.connect(master);
  master.connect(out);
  master.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 1.0);

  const punch = ctx.createGain(); // kick / snare / 808 — straight through (impact)
  punch.gain.value = 1;
  punch.connect(comp);

  const tone = ctx.createBiquadFilter(); // warmth for hats / chords
  tone.type = "lowpass";
  tone.frequency.value = kit.tone;
  tone.connect(comp);
  const air = ctx.createGain();
  air.gain.value = 1;
  air.connect(tone);

  // optional feedback delay send (boombap / lofi)
  if (kit.delay) {
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = stepDur * 3;
    const fb = ctx.createGain();
    fb.gain.value = 0.24;
    const wet = ctx.createGain();
    wet.gain.value = 0.18;
    air.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(comp);
  }

  // shared noise buffer (hats / snare / clap)
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noise = (): AudioBufferSourceNode => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    return s;
  };

  // ---- voices --------------------------------------------------------------
  const kick = (t: number, vel = 1) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(185, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1.15 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g).connect(punch);
    o.start(t);
    o.stop(t + 0.4);
    // click transient for attack
    const n = noise();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1600;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.5 * vel, t);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    n.connect(hp).connect(cg).connect(punch);
    n.start(t);
    n.stop(t + 0.03);
  };

  const snare = (t: number, vel = 1) => {
    const n = noise();
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1900;
    bp.Q.value = 0.7;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(0.75 * vel, t + 0.003);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.19);
    n.connect(bp).connect(ng).connect(punch);
    n.start(t);
    n.stop(t + 0.21);
    const o = ctx.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(195, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.1);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.42 * vel, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(og).connect(punch);
    o.start(t);
    o.stop(t + 0.14);
  };

  const hat = (t: number, vel = 0.22, open = false) => {
    const n = noise();
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 8200;
    const g = ctx.createGain();
    const dur = open ? 0.2 : 0.045;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(hp).connect(g).connect(air);
    n.start(t);
    n.stop(t + dur + 0.02);
  };

  const clap = (t: number, vel = 0.6) => {
    for (const off of [0, 0.011, 0.022]) {
      const n = noise();
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass";
      bp.frequency.value = 1650;
      bp.Q.value = 1.0;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t + off);
      g.gain.linearRampToValueAtTime(vel, t + off + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.13);
      n.connect(bp).connect(g).connect(air);
      n.start(t + off);
      n.stop(t + off + 0.15);
    }
  };

  const sub808 = (t: number, midi: number, dur: number, glideFrom?: number) => {
    const o = ctx.createOscillator();
    o.type = "sine";
    if (glideFrom != null) {
      o.frequency.setValueAtTime(midiToFreq(glideFrom), t);
      o.frequency.exponentialRampToValueAtTime(midiToFreq(midi), t + 0.08);
    } else {
      o.frequency.setValueAtTime(midiToFreq(midi), t);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.95, t + 0.01);
    g.gain.setValueAtTime(0.95, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(punch);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  const bass = (t: number, midi: number, dur: number, type: OscillatorType = "sawtooth") => {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = midiToFreq(midi);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(1300, t);
    lp.frequency.exponentialRampToValueAtTime(420, t + dur * 0.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(punch);
    o.start(t);
    o.stop(t + dur + 0.05);
  };

  const chord = (
    t: number,
    midis: number[],
    dur: number,
    type: OscillatorType,
    level: number,
  ) => {
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0.0001, t);
    vg.gain.linearRampToValueAtTime(level, t + Math.min(0.25, dur * 0.2));
    vg.gain.setValueAtTime(level, t + dur * 0.7);
    vg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    vg.connect(air);
    for (const m of midis) {
      for (const detune of [-5, 5]) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = midiToFreq(m);
        o.detune.value = detune;
        o.connect(vg);
        o.start(t);
        o.stop(t + dur + 0.1);
      }
    }
  };

  // ---- patterns ------------------------------------------------------------
  let prevRoot = baseRoot;

  const scheduleStep = (s: number, t: number) => {
    const bar = Math.floor(s / 16);
    const inBar = s % 16;
    const phraseBar = bar % 4;
    const fillBar = phraseBar === 3;
    const ch = PROG[bar % PROG.length];
    const rootMidi = baseRoot + ch.root;
    const sw = inBar % 2 === 1 ? t + swing * stepDur : t; // swung offbeats

    if (style === "house") {
      if (inBar % 4 === 0) kick(t, 1.05); // four-on-the-floor
      if (inBar === 4 || inBar === 12) {
        clap(t, 0.7);
        snare(t, 0.45);
      }
      if (inBar % 2 === 0) hat(t, 0.16);
      if (inBar === 2 || inBar === 6 || inBar === 10 || inBar === 14) hat(sw, 0.26, true);
      // offbeat house bass + a root anchor
      if (inBar % 4 === 2) bass(t, rootMidi + 12, stepDur * 1.6);
      if (inBar === 0) bass(t, rootMidi, stepDur * 1.2);
      if (inBar === 2 || inBar === 10)
        chord(t, triad(ch.minor).map((iv) => rootMidi + 12 + iv), stepDur * 1.6, "sawtooth", 0.1);
      if (fillBar && inBar === 14) kick(t, 0.9);
    } else if (style === "trap") {
      if (inBar === 0 || inBar === 6 || inBar === 10) kick(t, 1.1);
      if (fillBar && inBar === 3 && rnd() < 0.6) kick(t, 0.8);
      if (inBar === 8) {
        snare(t, 0.95);
        clap(t, 0.4);
      }
      // rolling 16th hats with occasional rolls
      hat(sw, inBar % 4 === 0 ? 0.24 : 0.15);
      if ((inBar === 14 || (fillBar && inBar === 15)) && rnd() < 0.8) {
        hat(t + stepDur / 3, 0.16);
        hat(t + (2 * stepDur) / 3, 0.16);
      }
      if (inBar === 0) {
        sub808(t, rootMidi - 12, stepDur * 8, prevRoot - 12);
        prevRoot = rootMidi;
      }
      if (inBar === 8) sub808(t, rootMidi - 12, stepDur * 6);
    } else if (style === "boombap") {
      if (inBar === 0 || inBar === 7 || inBar === 10) kick(t, 1.05);
      if (fillBar && inBar === 14 && rnd() < 0.6) kick(t, 0.8);
      if (inBar === 4 || inBar === 12) snare(t, 0.95);
      if (fillBar && inBar === 15) snare(t, 0.7);
      if (inBar % 2 === 0) hat(sw, 0.2);
      if (inBar === 14) hat(sw, 0.24, true);
      if (inBar === 0) {
        bass(t, rootMidi, stepDur * 3.2, "triangle");
        chord(t, triad(ch.minor).map((iv) => rootMidi + 12 + iv), stepDur * 15, "triangle", 0.13);
      }
      if (inBar === 8) bass(t, rootMidi + 7, stepDur * 3.2, "triangle");
    } else {
      // lofi
      if (inBar === 0 || inBar === 8) kick(t, 0.92);
      if (inBar === 4 || inBar === 12) snare(t, 0.55);
      if (inBar % 2 === 0) hat(sw, 0.12);
      if (inBar === 0) {
        bass(t, rootMidi, stepDur * 7, "triangle");
        chord(t, triad(ch.minor).map((iv) => rootMidi + 12 + iv), stepDur * 16, "sine", 0.16);
      }
      if (inBar === 8) bass(t, rootMidi, stepDur * 6, "triangle");
    }
  };

  // ---- lookahead scheduler -------------------------------------------------
  let step = 0;
  let nextTime = ctx.currentTime + 0.1;
  const LOOKAHEAD = 0.12;
  const timer = window.setInterval(() => {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      scheduleStep(step, nextTime);
      nextTime += stepDur;
      step += 1;
    }
  }, 25);

  let stopped = false;
  return {
    style,
    stop() {
      if (stopped) return;
      stopped = true;
      window.clearInterval(timer);
      const now = ctx.currentTime;
      try {
        master.gain.cancelScheduledValues(now);
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0.0001, now + 0.35);
      } catch {
        /* context may be closing */
      }
      window.setTimeout(() => {
        try {
          master.disconnect();
          comp.disconnect();
          tone.disconnect();
          air.disconnect();
          punch.disconnect();
        } catch {
          /* already gone */
        }
      }, 550);
    },
  };
}
