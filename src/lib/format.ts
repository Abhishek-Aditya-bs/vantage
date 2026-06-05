/**
 * Small presentation helpers — kept pure and dependency-free.
 */

/** Compact relative time, mono-friendly ("now", "12s", "4m", "2h", "3d"). */
export function relativeTime(ts: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const s = Math.floor(diff / 1000);
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

/** Human file size for upload diagnostics. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** Zero-padded clock, e.g. for the Moment countdown ("03"). */
export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Render a value 0..1 as a block-character progress bar (Space Mono),
 * e.g. "▓▓▓▓▓▒░░░░" — used for processing/upload states.
 */
export function blockBar(value: number, width = 16): string {
  const clamped = Math.min(1, Math.max(0, value));
  const filled = Math.floor(clamped * width);
  const partialIndex = Math.floor((clamped * width - filled) * 4);
  const partials = ["", "░", "▒", "▓"];
  let out = "█".repeat(filled);
  if (filled < width) {
    out += partials[partialIndex] || "";
    out += "·".repeat(Math.max(0, width - filled - (partialIndex ? 1 : 0)));
  }
  return out.slice(0, width).padEnd(width, "·");
}

/** Pretty space code with a hyphen group ("7QF9XB" -> "7QF-9XB"). */
export function formatCode(code: string): string {
  if (code.length <= 3) return code;
  const mid = Math.ceil(code.length / 2);
  return `${code.slice(0, mid)}-${code.slice(mid)}`;
}
