// FROZEN ACCEPTANCE TEST (overseer-handoff-workflow).
// Pins the Phase 2 contract for the coaching-session Title: the Option<string>
// model + the read transform / write serialize / fallback helper. Aligned with
// the backend contract `CoachingSessionTitleField` v1 (coordination board):
// wire `title: string | null`, ALWAYS present, null when unset, never ""/
// whitespace (BE normalizes on write). FE house pattern mirrors Action.goal_id.
//
// This file is read-only (chmod 0444) and on the freeze list: an IMPLEMENTER
// must NOT edit it. Only the overseer may unlock it, and only to correct a
// genuine spec/harness error — never to fit the implementation.

import { describe, it, expect } from "vitest";
import { Some, None } from "@/types/option";
import {
  transformCoachingSession,
  serializeCoachingSession,
  defaultCoachingSession,
} from "@/types/coaching-session";
import { coachingSessionTitle } from "@/types/coaching-session-title";

// Raw wire CoachingSession (backend shape: title is string | null, always present).
const rawWire = {
  id: "s1",
  coaching_relationship_id: "r1",
  date: "2026-06-05T15:00:00",
  duration_minutes: 60,
  meeting_url: "https://meet.example/abc",
  provider: null,
  created_at: "2026-05-01T12:00:00Z",
  updated_at: "2026-05-02T09:30:00Z",
  title: "Quarterly planning",
};

describe("transformCoachingSession — wraps wire title into Option<string>", () => {
  it("wraps a non-empty string title as Some", () => {
    const s = transformCoachingSession(rawWire);
    expect(s.title.some).toBe(true);
    expect(s.title.some && s.title.val).toBe("Quarterly planning");
  });

  it("wraps null title as None", () => {
    const s = transformCoachingSession({ ...rawWire, title: null });
    expect(s.title.none).toBe(true);
  });

  it("wraps an absent (undefined) title as None (defensive)", () => {
    const { title, ...noTitle } = rawWire;
    const s = transformCoachingSession(noTitle);
    expect(s.title.none).toBe(true);
  });

  it("preserves the other session fields unchanged", () => {
    const s = transformCoachingSession(rawWire);
    expect(s.id).toBe("s1");
    expect(s.coaching_relationship_id).toBe("r1");
    expect(s.date).toBe("2026-06-05T15:00:00");
    expect(s.duration_minutes).toBe(60);
  });
});

describe("serializeCoachingSession — unwraps Option<string> back to wire string | null", () => {
  it("Some(title) serializes to the raw string", () => {
    const wire = serializeCoachingSession({
      ...defaultCoachingSession(),
      id: "s1",
      title: Some("Renamed session"),
    });
    expect(wire.title).toBe("Renamed session");
  });

  it("None serializes to null (explicit clear / no-title)", () => {
    const wire = serializeCoachingSession({
      ...defaultCoachingSession(),
      id: "s1",
      title: None,
    });
    expect(wire.title).toBe(null);
  });

  it("round-trips wire -> FE -> wire for both string and null", () => {
    expect(serializeCoachingSession(transformCoachingSession(rawWire)).title).toBe(
      "Quarterly planning"
    );
    expect(
      serializeCoachingSession(transformCoachingSession({ ...rawWire, title: null })).title
    ).toBe(null);
  });
});

describe("defaultCoachingSession", () => {
  it("has a None title", () => {
    expect(defaultCoachingSession().title.none).toBe(true);
  });
});

describe("coachingSessionTitle — fallback chain: title -> first topic -> first goal -> 'Untitled'", () => {
  it("returns the session title when set, ignoring topics and goals", () => {
    expect(
      coachingSessionTitle({
        title: Some("Custom title"),
        topics: [{ body: "Topic A" }],
        goals: [{ title: "Goal A" }],
      })
    ).toBe("Custom title");
  });

  it("falls back to the FIRST topic (drag-and-drop order) when no title, ahead of goals", () => {
    expect(
      coachingSessionTitle({
        title: None,
        topics: [{ body: "First topic" }, { body: "Second topic" }],
        goals: [{ title: "First goal" }],
      })
    ).toBe("First topic");
  });

  it("falls back to the FIRST goal's title when no title and no topics", () => {
    expect(
      coachingSessionTitle({
        title: None,
        topics: [],
        goals: [{ title: "First goal" }, { title: "Second goal" }],
      })
    ).toBe("First goal");
  });

  it("falls through an empty first topic body to the first goal", () => {
    expect(
      coachingSessionTitle({
        title: None,
        topics: [{ body: "" }],
        goals: [{ title: "First goal" }],
      })
    ).toBe("First goal");
  });

  it("falls back to 'Untitled' when no title, no topics, and no goals", () => {
    expect(coachingSessionTitle({ title: None, topics: [], goals: [] })).toBe(
      "Untitled"
    );
    expect(coachingSessionTitle({ title: None })).toBe("Untitled");
  });

  it("falls back to 'Untitled' when first topic body and first goal title are both empty", () => {
    expect(
      coachingSessionTitle({ title: None, topics: [{ body: "" }], goals: [{ title: "" }] })
    ).toBe("Untitled");
  });
});
