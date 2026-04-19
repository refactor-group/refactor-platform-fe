import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";

import { buildSearchMatches, escapeRegex } from "../search-matches";
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

describe("escapeRegex", () => {
  it("escapes every regex metacharacter", () => {
    const meta = ".*+?^${}()|[]\\";
    const escaped = escapeRegex(meta);
    // Round-trip: a RegExp built from the escaped string must match the literal.
    expect(new RegExp(escaped).test(meta)).toBe(true);
  });

  it("leaves plain alphanumerics untouched", () => {
    expect(escapeRegex("cohort retention 42")).toBe("cohort retention 42");
  });
});

describe("buildSearchMatches", () => {
  it("returns empty result for an empty query", () => {
    const { matches, bySegmentId } = buildSearchMatches("", [
      makeSegment("1", "the cohort shipped"),
    ]);
    expect(matches).toEqual([]);
    expect(bySegmentId.size).toBe(0);
  });

  it("returns empty result for a whitespace-only query", () => {
    const { matches } = buildSearchMatches("   \t  ", [
      makeSegment("1", "the cohort shipped"),
    ]);
    expect(matches).toEqual([]);
  });

  it("trims leading/trailing whitespace before matching", () => {
    const { matches } = buildSearchMatches("  cohort  ", [
      makeSegment("1", "the cohort shipped"),
    ]);
    expect(matches).toHaveLength(1);
    expect(matches[0].start).toBe("the ".length);
  });

  it("finds case-insensitive matches", () => {
    const { matches } = buildSearchMatches("COHORT", [
      makeSegment("1", "the Cohort shipped"),
    ]);
    expect(matches).toHaveLength(1);
  });

  it("assigns monotonically increasing global indices across segments", () => {
    const segments = [
      makeSegment("1", "cohort one"),
      makeSegment("2", "cohort two and cohort three"),
    ];
    const { matches } = buildSearchMatches("cohort", segments);

    expect(matches.map((m) => m.globalIndex)).toEqual([0, 1, 2]);
    expect(matches[0].segmentId).toBe("1");
    expect(matches[1].segmentId).toBe("2");
    expect(matches[2].segmentId).toBe("2");
  });

  it("populates bySegmentId only for segments that had matches", () => {
    const segments = [
      makeSegment("1", "no term here"),
      makeSegment("2", "cohort"),
      makeSegment("3", "nothing"),
    ];
    const { bySegmentId } = buildSearchMatches("cohort", segments);

    expect(bySegmentId.has("1")).toBe(false);
    expect(bySegmentId.has("2")).toBe(true);
    expect(bySegmentId.has("3")).toBe(false);
  });

  it("treats regex metacharacters as literals", () => {
    const segments = [
      makeSegment("1", "total is $100"),
      makeSegment("2", "another 1000"),
    ];
    const { matches } = buildSearchMatches("$1", segments);

    // Without escaping, `$1` is a back-reference and matches nothing.
    // With escaping, it matches the literal `$1` — only in segment 1.
    expect(matches).toHaveLength(1);
    expect(matches[0].segmentId).toBe("1");
  });

  it("records precise start and end indices for highlighting", () => {
    const segments = [makeSegment("1", "the cohort shipped")];
    const { matches } = buildSearchMatches("cohort", segments);
    expect(matches[0].start).toBe(4);
    expect(matches[0].end).toBe(10);
  });
});
