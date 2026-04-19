import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";

import { ALL_SPEAKERS, useSpeakerFilter } from "../use-speaker-filter";
import { buildSpeakerStyles } from "@/lib/transcript/speakers";
import type { TranscriptSegment } from "@/types/transcription";

function makeSegment(id: string, speaker: string, text = ""): TranscriptSegment {
  return {
    id,
    transcription_id: "t1",
    speaker_label: speaker,
    text,
    start_ms: 0,
    end_ms: 1_000,
    created_at: DateTime.fromISO("2026-03-17T15:30:00.000Z"),
  };
}

describe("useSpeakerFilter", () => {
  const segments = [
    makeSegment("1", "Speaker A"),
    makeSegment("2", "Speaker B"),
    makeSegment("3", "Speaker A"),
  ];
  const styles = buildSpeakerStyles(segments);

  it("starts with 'all' selected and returns every segment", () => {
    const { result } = renderHook(() => useSpeakerFilter(segments, styles));
    expect(result.current.value).toBe(ALL_SPEAKERS);
    expect(result.current.visibleSegments).toHaveLength(3);
  });

  it("derives options from segment data, preserving first-seen order", () => {
    const { result } = renderHook(() => useSpeakerFilter(segments, styles));
    expect(result.current.options.map((o) => o.value)).toEqual([
      "all",
      "Speaker A",
      "Speaker B",
    ]);
  });

  it("attaches swatch classes for speakers (not for 'all')", () => {
    const { result } = renderHook(() => useSpeakerFilter(segments, styles));
    const [allOpt, speakerAOpt, speakerBOpt] = result.current.options;
    expect(allOpt.swatchClass).toBeUndefined();
    expect(speakerAOpt.swatchClass).toBeDefined();
    expect(speakerBOpt.swatchClass).toBeDefined();
  });

  it("filtering to a single speaker returns only their segments", () => {
    const { result } = renderHook(() => useSpeakerFilter(segments, styles));
    act(() => result.current.setValue("Speaker A"));
    expect(result.current.visibleSegments).toHaveLength(2);
    for (const s of result.current.visibleSegments) {
      expect(s.speaker_label).toBe("Speaker A");
    }
  });

  it("setting 'all' restores the full list", () => {
    const { result } = renderHook(() => useSpeakerFilter(segments, styles));
    act(() => result.current.setValue("Speaker B"));
    expect(result.current.visibleSegments).toHaveLength(1);
    act(() => result.current.setValue(ALL_SPEAKERS));
    expect(result.current.visibleSegments).toHaveLength(3);
  });

  it("returns an empty visible list when selecting a speaker with no segments (defensive)", () => {
    const { result } = renderHook(() => useSpeakerFilter(segments, styles));
    act(() => result.current.setValue("Speaker Nobody"));
    expect(result.current.visibleSegments).toHaveLength(0);
  });
});
