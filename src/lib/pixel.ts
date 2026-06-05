/**
 * Deterministic pixel-art helpers — used by PixelAvatar and the confetti burst.
 * Pure functions of a string seed so the same member always renders identically
 * on every device (server sends `avatarSeed`).
 */

/** FNV-1a 32-bit hash — small, fast, good-enough avalanche for visuals. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A tiny seeded PRNG (mulberry32) so we can derive multiple values per seed. */
export function rng(seedNum: number): () => number {
  let a = seedNum >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a vertically-mirrored 5x5 boolean grid (identicon style) from a seed.
 * Mirroring the left 3 columns keeps avatars feeling like faces/sigils.
 */
export function avatarGrid(seed: string): boolean[][] {
  const next = rng(hashSeed(seed));
  const grid: boolean[][] = [];
  for (let y = 0; y < 5; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < 3; x++) {
      // bias toward ~45% fill density for legible silhouettes
      row.push(next() > 0.55);
    }
    // mirror columns 0,1 onto 4,3
    row.push(row[1], row[0]);
    grid.push(row);
  }
  return grid;
}

/**
 * Pick a stable foreground color token for an avatar from the brand palette.
 * Returns a CSS variable reference so it tracks light/dark automatically.
 */
const AVATAR_TOKENS = [
  "var(--primary)",
  "var(--accent)",
  "var(--moment)",
  "var(--live)",
] as const;

export function avatarColor(seed: string): string {
  const idx = hashSeed(seed + "#color") % AVATAR_TOKENS.length;
  return AVATAR_TOKENS[idx];
}
