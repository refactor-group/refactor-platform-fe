"use client";

import { useMemo, useState } from "react";

import type { SpeakerFilterOption } from "@/components/ui/coaching-sessions/transcript-speaker-filter";
import type { SpeakerStyle } from "@/lib/transcript/speakers";
import type { TranscriptSegment } from "@/types/transcription";

/** Sentinel value that means "show all speakers". */
export const ALL_SPEAKERS = "all";

interface UseSpeakerFilterResult {
  /** Current selected filter value (`ALL_SPEAKERS` or a raw speaker_label). */
  value: string;
  setValue: (next: string) => void;
  /** Segments to render, filtered by the current selection. */
  visibleSegments: readonly TranscriptSegment[];
  /** Options suitable for `<TranscriptSpeakerFilter options=... />`. */
  options: SpeakerFilterOption[];
}

/**
 * Derives segmented-filter state + visible segment list from the full
 * transcript and a caller-provided speaker styling map.
 *
 * Options are derived from the segment data so the filter auto-adapts
 * to any speakers present (not just "A" and "B"). First option is
 * always "All" with no swatch.
 */
export function useSpeakerFilter(
  segments: readonly TranscriptSegment[],
  styles: Map<string, SpeakerStyle>
): UseSpeakerFilterResult {
  const [value, setValue] = useState<string>(ALL_SPEAKERS);

  const uniqueSpeakerLabels = useMemo(
    () => collectSpeakerLabels(segments),
    [segments]
  );

  const options = useMemo<SpeakerFilterOption[]>(
    () => [
      { value: ALL_SPEAKERS, label: "All" },
      ...uniqueSpeakerLabels.map((label) => ({
        value: label,
        label,
        swatchClass: styles.get(label)?.swatchClass,
      })),
    ],
    [uniqueSpeakerLabels, styles]
  );

  const visibleSegments = useMemo(() => {
    if (value === ALL_SPEAKERS) return segments;
    return segments.filter((s) => s.speaker_label === value);
  }, [segments, value]);

  return { value, setValue, visibleSegments, options };
}

function collectSpeakerLabels(segments: readonly TranscriptSegment[]): string[] {
  const seen: string[] = [];
  for (const segment of segments) {
    if (!seen.includes(segment.speaker_label)) {
      seen.push(segment.speaker_label);
    }
  }
  return seen;
}
