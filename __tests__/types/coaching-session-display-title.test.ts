// Covers the backend-composed `display_title` field added to the coaching-session
// read transform (string | null on the list/enriched reads, absent on the single
// read) and its exclusion from the write serialize. The frozen
// coaching-session-title.test.ts pins the client-side fallback rule; this file
// pins only the display_title wire handling.

import { describe, it, expect } from "vitest";
import { Some } from "@/types/option";
import {
  transformCoachingSession,
  serializeCoachingSession,
  defaultCoachingSession,
} from "@/types/coaching-session";

const rawWire = {
  id: "s1",
  coaching_relationship_id: "r1",
  date: "2026-06-05T15:00:00",
  duration_minutes: 60,
  created_at: "2026-05-01T12:00:00Z",
  updated_at: "2026-05-02T09:30:00Z",
  title: null,
};

describe("transformCoachingSession — display_title", () => {
  it("wraps a string display_title as Some", () => {
    const s = transformCoachingSession({
      ...rawWire,
      display_title: "Server-composed title",
    });
    expect(s.display_title?.some).toBe(true);
    expect(s.display_title?.some && s.display_title.val).toBe(
      "Server-composed title"
    );
  });

  it("wraps a null display_title as None (backend derived nothing)", () => {
    const s = transformCoachingSession({ ...rawWire, display_title: null });
    expect(s.display_title?.none).toBe(true);
  });

  it("leaves display_title undefined when absent (single-session read)", () => {
    const s = transformCoachingSession(rawWire);
    expect(s.display_title).toBeUndefined();
  });
});

describe("serializeCoachingSession — display_title is read-only", () => {
  it("never includes display_title on the wire", () => {
    const wire = serializeCoachingSession({
      ...defaultCoachingSession(),
      id: "s1",
      title: Some("Renamed"),
      display_title: Some("Server-composed title"),
    });
    expect("display_title" in wire).toBe(false);
  });

  it("round-trips a read with display_title -> serialize without it", () => {
    const fe = transformCoachingSession({
      ...rawWire,
      title: "Quarterly planning",
      display_title: "Quarterly planning",
    });
    const wire = serializeCoachingSession(fe);
    expect(wire.title).toBe("Quarterly planning");
    expect("display_title" in wire).toBe(false);
  });
});

describe("defaultCoachingSession — display_title", () => {
  it("omits display_title (None is only set from a wire read)", () => {
    expect(defaultCoachingSession().display_title).toBeUndefined();
  });
});
