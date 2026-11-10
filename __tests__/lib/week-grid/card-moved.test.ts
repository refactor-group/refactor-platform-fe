import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { createMockEnrichedSession } from "../../test-utils";
import { CardTense, cardNoteText, cardView, markMoved } from "@/lib/week-grid/card";

const NOW = DateTime.fromISO("2026-08-18T18:45:00Z", { zone: "utc" });
const CONTEXT = { viewerId: "coach-1", now: NOW, timezone: "America/Chicago" };

describe("markMoved", () => {
  it("replaces the note with Moved and drops the live state", () => {
    const live = cardView(createMockEnrichedSession({ date: "2026-08-18T19:30:00", duration_minutes: 50 }), CONTEXT);
    expect(live.tense).toBe(CardTense.Live);
    const moved = markMoved(live);
    expect(moved.note).toEqual({ kind: "moved" });
    expect(moved.tense).toBe(CardTense.Upcoming);
    expect(cardNoteText(moved.note)).toBe("Moved");
  });

  it("keeps an upcoming card upcoming and leaves everything else alone", () => {
    const view = cardView(createMockEnrichedSession({ date: "2026-08-20T15:00:00", duration_minutes: 50 }), CONTEXT);
    const moved = markMoved(view);
    expect(moved.tense).toBe(CardTense.Upcoming);
    expect({ ...moved, note: view.note }).toEqual(view);
  });
});
