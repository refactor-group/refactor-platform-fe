import type { TranscriptSegment } from "@/types/transcription";

/**
 * Per-bubble flags used by the renderer to collapse consecutive same-speaker
 * turns visually (tight spacing, a single speaker-label header at the top
 * of each group, a tail-corner on the last bubble).
 */
export interface BubbleGrouping {
  /** Inclusive index into the list the caller is rendering. */
  index: number;
  /** True when this segment starts a new speaker group relative to the reference order. */
  isFirstOfGroup: boolean;
  /** True when this segment ends a speaker group relative to the reference order. */
  isLastOfGroup: boolean;
}

/**
 * Computes grouping flags for each segment.
 *
 * `order` is the list the caller is actually rendering — typically the
 * filtered/visible list. `reference` is the adjacency source of truth —
 * typically the full original transcript. The distinction matters when a
 * speaker filter is active: two of Jim's turns may be adjacent in the
 * visible list but not actually consecutive in the conversation, so they
 * deserve their own header rather than collapsing into a single group.
 *
 * Callers that don't filter can pass the same array for both.
 */
export function groupBubbles(
  order: readonly TranscriptSegment[],
  reference: readonly TranscriptSegment[] = order
): BubbleGrouping[] {
  return order.map((segment, index) => {
    const refIndex = reference === order ? index : reference.indexOf(segment);
    return {
      index,
      isFirstOfGroup: isFirstOfGroupInReference(reference, refIndex, segment),
      isLastOfGroup: isLastOfGroupInReference(reference, refIndex, segment),
    };
  });
}

function isFirstOfGroupInReference(
  reference: readonly TranscriptSegment[],
  refIndex: number,
  segment: TranscriptSegment
): boolean {
  if (refIndex <= 0) return true;
  return reference[refIndex - 1].speaker_label !== segment.speaker_label;
}

function isLastOfGroupInReference(
  reference: readonly TranscriptSegment[],
  refIndex: number,
  segment: TranscriptSegment
): boolean {
  if (refIndex < 0 || refIndex >= reference.length - 1) return true;
  return reference[refIndex + 1].speaker_label !== segment.speaker_label;
}
