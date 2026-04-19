/**
 * Formats a millisecond offset into a human-readable clock string.
 *
 * Rules:
 *   < 1 hour  → `m:ss`      (e.g. `0:07`, `12:34`)
 *   ≥ 1 hour  → `h:mm:ss`   (e.g. `1:02:03`)
 *
 * Negative or non-finite inputs are clamped to zero — callers don't have
 * to pre-check, and the UI never shows malformed timestamps.
 */
export function formatTimestamp(ms: number): string {
  const safeMs = Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  }
  return `${minutes}:${pad2(seconds)}`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
