import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useRef } from "react";
import { DateTime } from "ts-luxon";

import { useTranscriptSearch } from "../use-transcript-search";
import type { TranscriptSegment } from "@/types/transcription";

function makeSegment(id: string, text: string): TranscriptSegment {
  return {
    id,
    transcription_id: "t1",
    speaker_label: "A",
    text,
    start_ms: 0,
    end_ms: 1_000,
    created_at: DateTime.fromISO("2026-03-17T15:30:00.000Z"),
  };
}

const SEGMENTS: readonly TranscriptSegment[] = [
  makeSegment("1", "the cohort shipped"),
  makeSegment("2", "another cohort and another"),
  makeSegment("3", "no match here"),
];

function renderSearch(segments: readonly TranscriptSegment[] = SEGMENTS) {
  return renderHook(() => {
    const scrollContainerRef = useRef<HTMLElement | null>(null);
    return useTranscriptSearch(segments, { scrollContainerRef });
  });
}

describe("useTranscriptSearch — counter", () => {
  it("starts with zero matches and activeIndex 0", () => {
    const { result } = renderSearch();
    expect(result.current.totalMatches).toBe(0);
    expect(result.current.activeIndex).toBe(0);
  });

  it("counts every occurrence across all segments", () => {
    const { result } = renderSearch();
    act(() => result.current.setQuery("cohort"));
    expect(result.current.totalMatches).toBe(2);
  });

  it("returns zero matches for an empty query", () => {
    const { result } = renderSearch();
    act(() => result.current.setQuery(""));
    expect(result.current.totalMatches).toBe(0);
  });
});

describe("useTranscriptSearch — navigation", () => {
  it("goNext wraps at the end", () => {
    const { result } = renderSearch();
    act(() => result.current.setQuery("cohort"));
    expect(result.current.activeIndex).toBe(0);
    act(() => result.current.goNext());
    expect(result.current.activeIndex).toBe(1);
    act(() => result.current.goNext());
    expect(result.current.activeIndex).toBe(0);
  });

  it("goPrev wraps at zero", () => {
    const { result } = renderSearch();
    act(() => result.current.setQuery("cohort"));
    act(() => result.current.goPrev());
    expect(result.current.activeIndex).toBe(1);
  });

  it("no-ops with no matches", () => {
    const { result } = renderSearch();
    act(() => result.current.setQuery("zzzzz"));
    act(() => result.current.goNext());
    expect(result.current.activeIndex).toBe(0);
  });

  it("resets activeIndex to 0 when the query changes", () => {
    const { result } = renderSearch();
    act(() => result.current.setQuery("cohort"));
    act(() => result.current.goNext());
    expect(result.current.activeIndex).toBe(1);
    act(() => result.current.setQuery("another"));
    expect(result.current.activeIndex).toBe(0);
  });

  it("clearQuery empties the query", () => {
    const { result } = renderSearch();
    act(() => result.current.setQuery("cohort"));
    expect(result.current.query).toBe("cohort");
    act(() => result.current.clearQuery());
    expect(result.current.query).toBe("");
    expect(result.current.totalMatches).toBe(0);
  });
});

describe("useTranscriptSearch — renderSegmentText", () => {
  it("returns the raw text when there are no matches for that segment", () => {
    const { result } = renderSearch();
    act(() => result.current.setQuery("cohort"));
    const node = result.current.renderSegmentText("3", "no match here");
    expect(node).toBe("no match here");
  });

  it("returns the raw text when the query is empty", () => {
    const { result } = renderSearch();
    const node = result.current.renderSegmentText("1", "the cohort shipped");
    expect(node).toBe("the cohort shipped");
  });

  it("returns an array of nodes for a segment with matches", () => {
    const { result } = renderSearch();
    act(() => result.current.setQuery("cohort"));
    const node = result.current.renderSegmentText("1", "the cohort shipped");
    expect(Array.isArray(node)).toBe(true);
  });
});
