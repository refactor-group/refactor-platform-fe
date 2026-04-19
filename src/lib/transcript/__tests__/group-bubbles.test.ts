import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";

import { groupBubbles } from "../group-bubbles";
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

describe("groupBubbles — unfiltered", () => {
  it("marks first and last of a single A B A pattern correctly", () => {
    const segs = [
      makeSegment("1", "A"),
      makeSegment("2", "B"),
      makeSegment("3", "A"),
    ];
    const groups = groupBubbles(segs);

    expect(groups[0]).toMatchObject({ isFirstOfGroup: true, isLastOfGroup: true });
    expect(groups[1]).toMatchObject({ isFirstOfGroup: true, isLastOfGroup: true });
    expect(groups[2]).toMatchObject({ isFirstOfGroup: true, isLastOfGroup: true });
  });

  it("collapses consecutive same-speaker turns into one group", () => {
    const segs = [
      makeSegment("1", "A"),
      makeSegment("2", "A"),
      makeSegment("3", "A"),
      makeSegment("4", "B"),
    ];
    const groups = groupBubbles(segs);

    expect(groups[0]).toMatchObject({ isFirstOfGroup: true, isLastOfGroup: false });
    expect(groups[1]).toMatchObject({ isFirstOfGroup: false, isLastOfGroup: false });
    expect(groups[2]).toMatchObject({ isFirstOfGroup: false, isLastOfGroup: true });
    expect(groups[3]).toMatchObject({ isFirstOfGroup: true, isLastOfGroup: true });
  });

  it("handles a single-segment transcript", () => {
    const segs = [makeSegment("only", "A")];
    const groups = groupBubbles(segs);
    expect(groups).toEqual([
      { index: 0, isFirstOfGroup: true, isLastOfGroup: true },
    ]);
  });

  it("handles an empty transcript", () => {
    expect(groupBubbles([])).toEqual([]);
  });
});

describe("groupBubbles — filtered", () => {
  it("keeps headers on every bubble when filter breaks conversational adjacency", () => {
    const full = [
      makeSegment("1", "A"),
      makeSegment("2", "B"),
      makeSegment("3", "A"),
      makeSegment("4", "B"),
      makeSegment("5", "A"),
    ];
    const onlyA = full.filter((s) => s.speaker_label === "A");

    // Against the original transcript, every A turn starts a new group
    // because a B turn sits between each of them in the real conversation.
    const groups = groupBubbles(onlyA, full);

    for (const g of groups) {
      expect(g.isFirstOfGroup).toBe(true);
      expect(g.isLastOfGroup).toBe(true);
    }
  });

  it("still collapses truly consecutive turns even when filtered", () => {
    const full = [
      makeSegment("1", "A"),
      makeSegment("2", "A"), // adjacent to 1 in the original
      makeSegment("3", "B"),
      makeSegment("4", "A"),
    ];
    const onlyA = full.filter((s) => s.speaker_label === "A");
    const groups = groupBubbles(onlyA, full);

    expect(groups[0]).toMatchObject({ isFirstOfGroup: true, isLastOfGroup: false });
    expect(groups[1]).toMatchObject({ isFirstOfGroup: false, isLastOfGroup: true });
    expect(groups[2]).toMatchObject({ isFirstOfGroup: true, isLastOfGroup: true });
  });
});
