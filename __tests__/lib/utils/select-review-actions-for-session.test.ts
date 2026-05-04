import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import { selectReviewActionsForSession } from "@/lib/utils/select-review-actions-for-session";
import type { Action } from "@/types/action";
import type { CoachingSession } from "@/types/coaching-session";
import { ItemStatus } from "@/types/general";
import { Some } from "@/types/option";

function makeAction(overrides: Partial<Action> & { id: string; coaching_session_id: string; due_by: DateTime }): Action {
  return {
    id: overrides.id,
    coaching_session_id: overrides.coaching_session_id,
    user_id: "user-1",
    body: "An action",
    goal_id: Some("goal-1"),
    status: ItemStatus.NotStarted,
    due_by: overrides.due_by,
    assignee_ids: [],
    created_at: DateTime.now(),
    updated_at: DateTime.now(),
    ...overrides,
  } as Action;
}

function makeSession(id: string, isoDate: string): CoachingSession {
  return {
    id,
    coaching_relationship_id: "rel-1",
    date: isoDate,
    collab_document_name: null,
    created_at: DateTime.now(),
    updated_at: DateTime.now(),
  } as CoachingSession;
}

describe("selectReviewActionsForSession", () => {
  const s1 = makeSession("s1", "2026-02-01T14:00:00Z");
  const s2 = makeSession("s2", "2026-02-08T14:00:00Z");
  const s3 = makeSession("s3", "2026-02-15T14:00:00Z");
  const sessionsAsc = [s1, s2, s3];

  it("returns actions due between the previous and the target session", () => {
    const actions = [
      // Created in s1, due before s2 → in s2's review window
      makeAction({
        id: "a-due",
        coaching_session_id: "s1",
        due_by: DateTime.fromISO("2026-02-05T12:00:00Z"),
      }),
      // Created in s2 → excluded (it's "new" for s2, not "due")
      makeAction({
        id: "a-new-in-current",
        coaching_session_id: "s2",
        due_by: DateTime.fromISO("2026-02-07T12:00:00Z"),
      }),
      // Due after s2 → out of window
      makeAction({
        id: "a-future",
        coaching_session_id: "s1",
        due_by: DateTime.fromISO("2026-02-10T12:00:00Z"),
      }),
    ];

    const result = selectReviewActionsForSession(actions, sessionsAsc, "s2");
    expect(result.map((a) => a.id)).toEqual(["a-due"]);
  });

  it("includes actions due any time before the target when no previous session exists", () => {
    const actions = [
      makeAction({
        id: "a-very-old",
        coaching_session_id: "other",
        due_by: DateTime.fromISO("2025-01-01T00:00:00Z"),
      }),
      makeAction({
        id: "a-recent",
        coaching_session_id: "other",
        due_by: DateTime.fromISO("2026-01-25T00:00:00Z"),
      }),
    ];

    const result = selectReviewActionsForSession(actions, sessionsAsc, "s1");
    expect(result.map((a) => a.id).sort()).toEqual(["a-recent", "a-very-old"]);
  });

  it("returns an empty array when the target session is not in the list", () => {
    const actions = [
      makeAction({
        id: "a",
        coaching_session_id: "s1",
        due_by: DateTime.fromISO("2026-02-05T12:00:00Z"),
      }),
    ];

    expect(selectReviewActionsForSession(actions, sessionsAsc, "missing")).toEqual([]);
  });

  it("treats sessions in a different relationship as if absent when picking the previous session", () => {
    // Two sessions in rel-A; one rogue session in rel-B sandwiched in time.
    // The rogue session must NOT be picked as the "previous session" for the
    // rel-A target — that would compute the wrong review window.
    const relA1 = makeSession("a1", "2026-02-01T14:00:00Z");
    const relB = { ...makeSession("b1", "2026-02-05T14:00:00Z"), coaching_relationship_id: "rel-B" };
    const relA2 = makeSession("a2", "2026-02-08T14:00:00Z");
    const sessions = [relA1, relB, relA2];

    const actions = [
      // Due between the two rel-A sessions; should appear for a2.
      makeAction({
        id: "a-rel-a-window",
        coaching_session_id: "a1",
        due_by: DateTime.fromISO("2026-02-04T12:00:00Z"),
      }),
    ];

    const result = selectReviewActionsForSession(actions, sessions, "a2");
    expect(result.map((a) => a.id)).toEqual(["a-rel-a-window"]);
  });

  it("returns sorted descending by due_by (delegates to filterReviewActions)", () => {
    const actions = [
      makeAction({
        id: "a-earlier",
        coaching_session_id: "s1",
        due_by: DateTime.fromISO("2026-02-04T12:00:00Z"),
      }),
      makeAction({
        id: "a-later",
        coaching_session_id: "s1",
        due_by: DateTime.fromISO("2026-02-06T12:00:00Z"),
      }),
    ];

    const result = selectReviewActionsForSession(actions, sessionsAsc, "s2");
    expect(result.map((a) => a.id)).toEqual(["a-later", "a-earlier"]);
  });

  it("uses fallbackPriorDate as the lower bound when no prior session exists in the list", () => {
    // Target s1 is the oldest in the rel — there's no prior session in `sessionsAsc`.
    // Without the fallback, every earlier-due action gets included; with it,
    // only actions due on/after the fallback are included.
    const fallback = DateTime.fromISO("2026-01-15T00:00:00Z");
    const actions = [
      makeAction({
        id: "a-before-fallback",
        coaching_session_id: "other",
        due_by: DateTime.fromISO("2025-08-01T00:00:00Z"),
      }),
      makeAction({
        id: "a-within-fallback",
        coaching_session_id: "other",
        due_by: DateTime.fromISO("2026-01-20T00:00:00Z"),
      }),
    ];

    const result = selectReviewActionsForSession(
      actions,
      sessionsAsc,
      "s1",
      fallback
    );
    expect(result.map((a) => a.id)).toEqual(["a-within-fallback"]);
  });
});
