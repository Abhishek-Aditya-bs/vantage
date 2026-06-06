/**
 * Procedural beat machine — fully *synthesized* (royalty-free, copyright-clear)
 * grooves built from WebAudio primitives. No samples, no copyrighted audio.
 *
 * Six families, trap-forward, each with many randomized arrangements (kick/hat/
 * snare/808 pattern banks × tempo × key) → 100+ named variations in BEAT_CATALOG.
 * Pick one by id for a reproducible groove, or omit for a random pick.
 *
 *   trap / drill / phonk — punchy 808s, rolling hats (the exciting ones)
 *   house               — four-on-the-floor, offbeat open hats, claps
 *   boombap / lofi      — swung, jazzy chords, the chill options
 *
 * A DynamicsCompressor glues + loudens the mix. Renders to ANY destination node,
 * so the same engine powers the live preview (via an <audio> element, audible on
 * iOS even with the silent switch on) and the exported video's audio track.
 */

export type BeatStyle =
  | "trap"
  | "drill"
  | "phonk"
  | "house"
  | "boombap"
  | "lofi";

export interface BeatHandle {
  style: BeatStyle;
  variation: number;
  name: string;
  stop: () => void;
}

export interface BeatOptions {
  style?: BeatStyle;
  /** index into the family's variation space (with style → fully reproducible) */
  variation?: number;
  /** legacy nudge; only used when style/variation are omitted */
  seed?: number;
  /** master loudness 0..1. Default 0.85. */
  gain?: number;
}

/* ------------------------------------------------------------------ catalog */

export interface BeatVariation {
  id: string; // `${style}-${variation}`
  style: BeatStyle;
  variation: number;
  name: string;
  label: string; // family label for grouping
}

const STYLE_LABEL: Record<BeatStyle, string> = {
  trap: "Trap",
  drill: "Drill",
  phonk: "Phonk",
  house: "House",
  boombap: "Boom-bap",
  lofi: "Lo-fi",
};

const STYLE_INDEX: Record<BeatStyle, number> = {
  trap: 0, drill: 1, phonk: 2, house: 3, boombap: 4, lofi: 5,
};

// trap-forward counts → 114 total variations
const VARIATION_COUNTS: Record<BeatStyle, number> = {
  trap: 40,
  drill: 24,
  phonk: 20,
  house: 12,
  boombap: 10,
  lofi: 8,
};

const ADJ = [
  "Midnight", "Neon", "Crystal", "Velvet", "Shadow", "Golden", "Electric",
  "Frost", "Crimson", "Lunar", "Static", "Amber", "Obsidian", "Mirror",
  "Phantom", "Cobalt", "Ember", "Hollow", "Saffron", "Onyx",
];
const NOUN = [
  "Drive", "Bloom", "Pulse", "Haze", "Rush", "Tide", "Echo", "Mirage",
  "Bounce", "Drift", "Flux", "Ritual", "Vapor", "Circuit", "Motion",
  "Gravity", "Signal", "Current", "Horizon", "Tempo",
];

function variationName(style: BeatStyle, v: number): string {
  // Map (style, v) to a unique adj×noun pair. 37 is coprime to ADJ×NOUN (400),
  // so a family's variations (≤40) never repeat a name.
  const span = ADJ.length * NOUN.length;
  const combo = (STYLE_INDEX[style] * 89 + v * 37) % span;
  const adj = ADJ[Math.floor(combo / NOUN.length) % ADJ.length];
  const noun = NOUN[combo % NOUN.length];
  return `${adj} ${noun}`;
}

export const BEAT_CATALOG: BeatVariation[] = (
  ["trap", "drill", "phonk", "house", "boombap", "lofi"] as BeatStyle[]
).flatMap((style) =>
  Array.from({ length: VARIATION_COUNTS[style] }, (_, v) => ({
    id: `${style}-${v}`,
    style,
    variation: v,
    name: variationName(style, v),
    label: STYLE_LABEL[style],
  })),
);

export function findVariation(id: string): BeatVariation | undefined {
  return BEAT_CATALOG.find((b) => b.id === id);
}

/* ------------------------------------------------------------------ helpers */

const midiToFreq = (m: number): number => 440 * Math.pow(2, (m - 69) / 12);

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const KEYS = [45, 43, 41, 48, 50, 38, 40]; // root MIDI (A2/G2/F2/C3/D3/D2/E2)
const PROG: Array<{ root: number; minor: boolean }> = [
  { root: 0, minor: true },
  { root: 8, minor: false },
  { root: 3, minor: false },
  { root: 10, minor: false },
];
const triad = (minor: boolean): number[] => (minor ? [0, 3, 7] : [0, 4, 7]);
const pick = <T,>(rnd: () => number, arr: T[]): T => arr[Math.floor(rnd() * arr.length)];

/* ------------------------------------------------------- arrangement model */

interface Arrangement {
  style: BeatStyle;
  bpm: number;
  swing: number;
  baseRoot: number;
  kick: number[];
  ghostKick: number[];
  snare: number[];
  hatEvery: 1 | 2; // 1 = 16ths, 2 = 8ths
  rollSteps: number[];
  openHat: number[];
  use808: boolean;
  drive808: boolean;
  bass: "none" | "root" | "offbeat" | "walk";
  chord: "none" | "pad" | "stab";
  cowbell: boolean;
}

const TEMPO: Record<BeatStyle, number[]> = {
  trap: [138, 140, 142, 144, 146],
  drill: [140, 142, 144],
  phonk: [130, 140, 150],
  house: [122, 124, 126],
  boombap: [86, 90, 92],
  lofi: [76, 80, 84],
};

const TRAP_KICKS = [
  [0, 6, 10], [0, 7, 10], [0, 3, 8, 10], [0, 6, 8, 14],
  [0, 6, 10, 11], [0, 4, 7, 10], [0, 6, 10, 13], [0, 3, 6, 10],
];
const DRILL_KICKS = [
  [0, 3, 6, 10], [0, 6, 7, 10], [0, 3, 7, 10, 13], [0, 6, 10, 11, 14],
];

function genArrangement(style: BeatStyle, variation: number): Arrangement {
  const rnd = mulberry32(STYLE_INDEX[style] * 1009 + variation * 2654435761);
  const bpm = pick(rnd, TEMPO[style]);
  const baseRoot = KEYS[(variation + STYLE_INDEX[style]) % KEYS.length];
  const a: Arrangement = {
    style, bpm, swing: 0, baseRoot,
    kick: [0, 8], ghostKick: [], snare: [4, 12],
    hatEvery: 2, rollSteps: [], openHat: [],
    use808: false, drive808: false, bass: "none", chord: "none", cowbell: false,
  };

  if (style === "trap") {
    a.kick = pick(rnd, TRAP_KICKS);
    a.snare = rnd() < 0.3 ? [8, 15] : [8];
    a.hatEvery = 1;
    a.rollSteps = pick(rnd, [[14], [7, 14], [14, 15], [6, 14], []]);
    a.use808 = true;
    a.drive808 = rnd() < 0.6;
    a.chord = rnd() < 0.5 ? "pad" : "none";
  } else if (style === "drill") {
    a.kick = pick(rnd, DRILL_KICKS);
    a.snare = [8];
    a.hatEvery = 1;
    a.rollSteps = pick(rnd, [[7, 14, 15], [6, 7, 14], [13, 14, 15], [14, 15]]);
    a.use808 = true;
    a.drive808 = true;
    a.chord = "pad";
  } else if (style === "phonk") {
    a.kick = pick(rnd, [[0, 4, 8, 12], [0, 6, 10], [0, 4, 7, 10, 12]]);
    a.snare = rnd() < 0.5 ? [4, 12] : [8];
    a.hatEvery = pick(rnd, [1, 2]);
    a.use808 = true;
    a.drive808 = true;
    a.cowbell = true;
  } else if (style === "house") {
    a.kick = [0, 4, 8, 12];
    a.snare = [4, 12];
    a.hatEvery = 2;
    a.openHat = [2, 6, 10, 14];
    a.bass = "offbeat";
    a.chord = "stab";
  } else if (style === "boombap") {
    a.swing = 0.16;
    a.kick = pick(rnd, [[0, 7, 10], [0, 6, 10], [0, 7, 11]]);
    a.snare = [4, 12];
    a.hatEvery = 2;
    a.openHat = [14];
    a.bass = "walk";
    a.chord = "pad";
  } else {
    a.swing = 0.12;
    a.kick = [0, 8];
    a.snare = [4, 12];
    a.hatEvery = 2;
    a.bass = "root";
    a.chord = "pad";
  }
  return a;
}

/* ----------------------------------------------------------------- engine */

export function createBeats(
  ctx: AudioContext,
  out: AudioNode,
  opts: BeatOptions = {},
): BeatHandle {
  // Resolve which variation to play.
  let style: BeatStyle;
  let variation: number;
  if (opts.style) {
    style = opts.style;
    variation = opts.variation ?? 0;
  } else {
    const seedRnd = mulberry32((opts.seed ?? 1) * 374761393 + Math.floor(Math.random() * 1e9));
    const choice = BEAT_CATALOG[Math.floor(seedRnd() * BEAT_CATALOG.length)];
    style = choice.style;
    variation = choice.variation;
  }
  const name = variationName(style, variation);
  const arr = genArrangement(style, variation);
  const stepDur = 60 / arr.bpm / 4;
  const targetGain = opts.gain ?? 0.85;

  // master chain: buses → compressor → makeup gain → out
  const master = ctx.createGain();
  master.gain.value = 0;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -15;
  comp.knee.value = 26;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  comp.connect(master);
  master.connect(out);
  master.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.9);

  const punch = ctx.createGain();
  punch.connect(comp);
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = style === "house" ? 12000 : style === "lofi" ? 6500 : 9500;
  tone.connect(comp);
  const air = ctx.createGain();
  air.connect(tone);

  if (style === "boombap" || style === "lofi") {
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

  // shared noise + a soft distortion curve for grit
  const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const nd = noiseBuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  const noise = (): AudioBufferSourceNode => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    return s;
  };
  const driveCurve = (() => {
    const n = 1024;
    const c = new Float32Array(n);
    const k = 18;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return c;
  })();

  /* ---- voices ---- */
  const kick = (t: number, vel = 1) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(46, t + 0.09);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1.2 * vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g).connect(punch);
    o.start(t);
    o.stop(t + 0.4);
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
    ng.gain.linearRampToValueAtTime(0.78 * vel, t + 0.003);
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
    const dur = open ? 0.2 : 0.04;
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
      o.frequency.exponentialRampToValueAtTime(midiToFreq(midi), t + 0.09);
    } else {
      o.frequency.setValueAtTime(midiToFreq(midi), t);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(1.0, t + 0.01);
    g.gain.setValueAtTime(1.0, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = g;
    if (arr.drive808) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = driveCurve;
      g.connect(shaper);
      node = shaper;
    }
    o.connect(g);
    node.connect(punch);
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

  const cowbell = (t: number, midi: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = midiToFreq(midi + 12);
    bp.Q.value = 2;
    g.connect(bp).connect(air);
    for (const f of [midiToFreq(midi + 7), midiToFreq(midi + 14)]) {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = f;
      o.connect(g);
      o.start(t);
      o.stop(t + 0.17);
    }
  };

  const chord = (t: number, midis: number[], dur: number, type: OscillatorType, level: number) => {
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

  /* ---- scheduler ---- */
  let prevRoot = arr.baseRoot;
  const scheduleStep = (s: number, t: number) => {
    const bar = Math.floor(s / 16);
    const inBar = s % 16;
    const ch = PROG[bar % PROG.length];
    const rootMidi = arr.baseRoot + ch.root;
    const sw = inBar % 2 === 1 ? t + arr.swing * stepDur : t;
    const fillBar = bar % 4 === 3;

    if (arr.kick.includes(inBar)) kick(t, 1.08);
    if (fillBar && arr.ghostKick.includes(inBar)) kick(t, 0.7);
    if (arr.snare.includes(inBar)) {
      snare(t, style === "lofi" ? 0.6 : 0.95);
      if (style === "house" || style === "phonk") clap(t, 0.4);
    }

    // hats
    if (inBar % arr.hatEvery === 0) hat(sw, style === "lofi" ? 0.12 : inBar % 4 === 0 ? 0.24 : 0.16);
    if (arr.openHat.includes(inBar)) hat(sw, 0.26, true);
    if (arr.rollSteps.includes(inBar)) {
      hat(t + stepDur / 3, 0.16);
      hat(t + (2 * stepDur) / 3, 0.16);
      if (style === "drill") hat(t + stepDur / 6, 0.12);
    }

    // 808 / bass (808 follows the kick downbeats)
    if (arr.use808 && (inBar === 0 || inBar === 8)) {
      sub808(t, rootMidi - 12, stepDur * (inBar === 0 ? 8 : 6), inBar === 0 ? prevRoot - 12 : undefined);
      if (inBar === 0) prevRoot = rootMidi;
    }
    if (arr.bass === "offbeat" && inBar % 4 === 2) bass(t, rootMidi + 12, stepDur * 1.6);
    if (arr.bass === "root" && inBar === 0) bass(t, rootMidi, stepDur * 7, "triangle");
    if (arr.bass === "root" && inBar === 8) bass(t, rootMidi, stepDur * 6, "triangle");
    if (arr.bass === "walk" && inBar === 0) bass(t, rootMidi, stepDur * 3.2, "triangle");
    if (arr.bass === "walk" && inBar === 8) bass(t, rootMidi + 7, stepDur * 3.2, "triangle");

    // chords
    if (arr.chord === "pad" && inBar === 0)
      chord(t, triad(ch.minor).map((iv) => rootMidi + 12 + iv), stepDur * (style === "trap" || style === "drill" ? 8 : 16), style === "trap" || style === "drill" ? "sawtooth" : "triangle", style === "trap" || style === "drill" ? 0.08 : 0.14);
    if (arr.chord === "stab" && (inBar === 2 || inBar === 10))
      chord(t, triad(ch.minor).map((iv) => rootMidi + 12 + iv), stepDur * 1.6, "sawtooth", 0.1);

    // phonk cowbell riff
    if (arr.cowbell && [0, 3, 6, 8, 11, 14].includes(inBar)) {
      const scale = [0, 3, 5, 7, 10];
      cowbell(t, rootMidi + 12 + scale[(inBar + bar) % scale.length]);
    }
  };

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
    variation,
    name,
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
