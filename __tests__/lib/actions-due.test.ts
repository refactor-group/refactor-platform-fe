import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import {
  ActionsDueKind,
  actionsDueAt,
  isOverdue,
  previousSessionOf,
  summarizeActionsDue,
} from "@/lib/actions-due";
import type { Action } from "@/types/action";
import type { CoachingSession } from "@/types/coaching-session";
import { ItemStatus } from "@/types/general";
import { Some, None } from "@/types/option";

function makeAction({
  due_by,
  ...overrides
}: Partial<Omit<Action, "due_by">> & {
  id: string;
  coaching_session_id: string;
  due_by: DateTime | null;
}): Action {
  return {
    id: overrides.id,
    coaching_session_id: overrides.coaching_session_id,
    user_id: "user-1",
    body: "An action",
    goal_id: Some("goal-1"),
    status: ItemStatus.NotStarted,
    due_by: due_by ? Some(due_by) : None,
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

describe("actionsDueAt", () => {
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

    const result = actionsDueAt(actions, sessionsAsc, "s2", "UTC");
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

    const result = actionsDueAt(actions, sessionsAsc, "s1", "UTC");
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

    expect(actionsDueAt(actions, sessionsAsc, "missing", "UTC")).toEqual([]);
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

    const result = actionsDueAt(actions, sessions, "a2", "UTC");
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

    const result = actionsDueAt(actions, sessionsAsc, "s2", "UTC");
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

    const result = actionsDueAt(actions, sessionsAsc, "s1", "UTC", {
      fallbackPriorDate: fallback,
    });
    expect(result.map((a) => a.id)).toEqual(["a-within-fallback"]);
  });
});

describe("previousSessionOf", () => {
  const inRel = (id: string, isoDate: string, rel: string): CoachingSession => ({
    ...makeSession(id, isoDate),
    coaching_relationship_id: rel,
  });

  it("picks the prior session in the same relationship", () => {
    const nov10 = inRel("a-10", "2026-11-10T14:00:00Z", "rel-a");
    const nov15 = inRel("b-15", "2026-11-15T14:00:00Z", "rel-b");
    const nov17 = inRel("a-17", "2026-11-17T14:00:00Z", "rel-a");
    expect(previousSessionOf([nov10, nov15, nov17], "a-17")).toEqual(Some(nov10));
  });

  it("counts an earlier session on the same day", () => {
    const morning = inRel("a-am", "2026-11-19T09:00:00", "rel-a");
    const afternoon = inRel("a-pm", "2026-11-19T15:00:00", "rel-a");
    expect(previousSessionOf([morning, afternoon], "a-pm")).toEqual(Some(morning));
  });

  it("sorts unsorted input by date", () => {
    const nov17 = inRel("a-17", "2026-11-17T14:00:00Z", "rel-a");
    const nov3 = inRel("a-3", "2026-11-03T14:00:00Z", "rel-a");
    const nov10 = inRel("a-10", "2026-11-10T14:00:00Z", "rel-a");
    expect(previousSessionOf([nov17, nov3, nov10], "a-17")).toEqual(Some(nov10));
  });

  it("returns None for the first session or an unknown id", () => {
    const nov10 = inRel("a-10", "2026-11-10T14:00:00Z", "rel-a");
    const nov17 = inRel("a-17", "2026-11-17T14:00:00Z", "rel-a");
    expect(previousSessionOf([nov10, nov17], "a-10")).toEqual(None);
    expect(previousSessionOf([nov10, nov17], "missing")).toEqual(None);
  });
});

const CHICAGO = "America/Chicago";
const chicagoNow = DateTime.fromISO("2026-11-19T12:00:00", { zone: CHICAGO });
const chicago = (iso: string) => DateTime.fromISO(iso, { zone: CHICAGO });
const dueAction = (id: string, status: ItemStatus, due: DateTime | null) =>
  makeAction({ id, coaching_session_id: "s1", status, due_by: due });

describe("isOverdue", () => {
  it("is true for open actions due before today", () => {
    const due = chicago("2026-11-18T10:00");
    expect(isOverdue(dueAction("a", ItemStatus.NotStarted, due), chicagoNow)).toBe(true);
    expect(isOverdue(dueAction("a", ItemStatus.InProgress, due), chicagoNow)).toBe(true);
  });

  it("is false for an action due today", () => {
    const due = chicago("2026-11-19T08:00");
    expect(isOverdue(dueAction("a", ItemStatus.NotStarted, due), chicagoNow)).toBe(false);
  });

  it("is false for on-hold, completed and won't-do actions", () => {
    const due = chicago("2026-11-18");
    for (const status of [ItemStatus.OnHold, ItemStatus.Completed, ItemStatus.WontDo]) {
      expect(isOverdue(dueAction("a", status, due), chicagoNow)).toBe(false);
    }
  });

  it("is false without a due date", () => {
    expect(isOverdue(dueAction("a", ItemStatus.NotStarted, null), chicagoNow)).toBe(false);
  });

  it("counts calendar days in now's zone", () => {
    const action = dueAction("a", ItemStatus.NotStarted, DateTime.fromISO("2026-11-19T03:00:00Z"));
    const instant = DateTime.fromISO("2026-11-19T06:00:00Z");
    expect(isOverdue(action, instant.setZone(CHICAGO))).toBe(true);
    expect(isOverdue(action, instant.setZone("UTC"))).toBe(false);
  });
});

describe("summarizeActionsDue", () => {
  it("is None for no actions", () => {
    expect(summarizeActionsDue([], chicagoNow)).toEqual({ kind: ActionsDueKind.None });
  });

  it("is a Count when nothing is overdue", () => {
    const due = [
      dueAction("a", ItemStatus.NotStarted, chicago("2026-11-19T08:00")),
      dueAction("b", ItemStatus.InProgress, chicago("2026-11-20")),
      dueAction("c", ItemStatus.NotStarted, chicago("2026-11-25")),
    ];
    expect(summarizeActionsDue(due, chicagoNow)).toEqual({
      kind: ActionsDueKind.Count,
      count: 3,
    });
  });

  it("is Overdue with the open past-due count", () => {
    const due = [
      dueAction("a", ItemStatus.NotStarted, chicago("2026-11-18")),
      dueAction("b", ItemStatus.Completed, chicago("2026-11-18")),
      dueAction("c", ItemStatus.NotStarted, chicago("2026-11-20")),
    ];
    expect(summarizeActionsDue(due, chicagoNow)).toEqual({
      kind: ActionsDueKind.Overdue,
      count: 3,
      overdue: 1,
    });
  });
});
