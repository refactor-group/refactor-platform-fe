import type { BubbleAlignment, BubbleVariant } from "@/components/ui/coaching-sessions/transcript-bubble";
import type { TranscriptSegment } from "@/types/transcription";

/**
 * Visual theming for a single speaker. `swatchClass` is the Tailwind
 * background class used for the color dot in the speaker filter.
 */
export interface SpeakerStyle {
  variant: BubbleVariant;
  alignment: BubbleAlignment;
  swatchClass: string;
}

/**
 * Assigns visual styling to every distinct speaker in a transcript.
 *
 * The first speaker encountered (assumed to be the coach opening the
 * session, though not reliable — see the plan's "Speaker labels in v1"
 * section) gets the primary blue-bubble right-aligned treatment. All
 * others get the secondary grey-bordered left-aligned treatment.
 *
 * Returns a stable Map keyed by `speaker_label`.
 */
export function buildSpeakerStyles(
  segments: readonly TranscriptSegment[]
): Map<string, SpeakerStyle> {
  const styles = new Map<string, SpeakerStyle>();
  for (const segment of segments) {
    if (styles.has(segment.speaker_label)) continue;
    styles.set(segment.speaker_label, stylesForOrdinal(styles.size));
  }
  return styles;
}

function stylesForOrdinal(ordinal: number): SpeakerStyle {
  if (ordinal === 0) {
    return {
      variant: "primary",
      alignment: "right",
      swatchClass: "bg-[#007AFF]",
    };
  }
  return {
    variant: "secondary",
    alignment: "left",
    swatchClass: "bg-zinc-400",
  };
}

/**
 * Returns the same `SpeakerStyle` lookup result as `buildSpeakerStyles`
 * for a single segment. Falls back to the secondary treatment if the
 * segment's speaker wasn't seen during build — shouldn't happen under
 * normal flow, but keeps the renderer total.
 */
export function speakerStyleFor(
  segment: TranscriptSegment,
  styles: Map<string, SpeakerStyle>
): SpeakerStyle {
  return (
    styles.get(segment.speaker_label) ?? {
      variant: "secondary",
      alignment: "left",
      swatchClass: "bg-zinc-400",
    }
  );
}
