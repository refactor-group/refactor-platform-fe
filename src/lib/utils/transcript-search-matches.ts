import type { TranscriptSegment } from "@/types/transcription";

/**
 * Escapes any regex metacharacters so a user-typed query can be safely
 * embedded in a `RegExp`. Without this, a query like `$1` or `.` would
 * change semantics instead of matching the literal characters.
 */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A single match occurrence within a segment.
 * Indices are on the segment's raw text; callers slice it directly.
 */
export interface SegmentMatch {
  segmentId: string;
  /** Zero-based global match index across the whole result set. */
  globalIndex: number;
  start: number;
  end: number;
}

export interface SearchMatches {
  /** Every match across the visible segments, in document order. */
  matches: SegmentMatch[];
  /** Convenience map for renderers: segmentId → that segment's matches. */
  bySegmentId: Map<string, SegmentMatch[]>;
}

/**
 * Finds all matches of `query` across the given segments using case-insensitive
 * phrase search (literal substring semantics). Returns an empty result set for
 * empty/whitespace-only queries.
 */
export function buildSearchMatches(
  query: string,
  segments: readonly TranscriptSegment[]
): SearchMatches {
  const trimmed = query.trim();
  if (!trimmed) {
    return { matches: [], bySegmentId: new Map() };
  }

  const pattern = new RegExp(escapeRegex(trimmed), "gi");
  const matches: SegmentMatch[] = [];
  const bySegmentId = new Map<string, SegmentMatch[]>();

  for (const segment of segments) {
    const perSegment = collectMatchesInSegment(segment, pattern, matches.length);
    if (perSegment.length > 0) {
      matches.push(...perSegment);
      bySegmentId.set(segment.id, perSegment);
    }
    pattern.lastIndex = 0;
  }

  return { matches, bySegmentId };
}

function collectMatchesInSegment(
  segment: TranscriptSegment,
  pattern: RegExp,
  globalOffset: number
): SegmentMatch[] {
  const out: SegmentMatch[] = [];
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(segment.text)) !== null) {
    out.push({
      segmentId: segment.id,
      globalIndex: globalOffset + out.length,
      start: m.index,
      end: m.index + m[0].length,
    });
    // Defend against zero-width matches that would otherwise loop forever.
    if (m[0].length === 0) pattern.lastIndex++;
  }
  return out;
}
