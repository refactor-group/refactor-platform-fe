import { describe, it, expect } from "vitest";
import { DateTime } from "ts-luxon";
import { Some, None } from "@/types/option";
import { ItemStatus } from "@/types/general";
import { serializeAction, transformAction } from "@/types/action";
import type { Action } from "@/types/action";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const now = DateTime.fromISO("2026-03-30T12:00:00Z");

function makeAction(goalId: Action["goal_id"]): Action {
  return {
    id: "action-1",
    coaching_session_id: "session-1",
    goal_id: goalId,
    body: "Test action",
    user_id: "user-1",
    status: ItemStatus.NotStarted,
    status_changed_at: now,
    due_by: now.plus({ days: 7 }),
    created_at: now,
    updated_at: now,
    assignee_ids: ["user-1"],
  };
}

// ---------------------------------------------------------------------------
// serializeAction
// ---------------------------------------------------------------------------

describe("serializeAction", () => {
  it("unwraps Some(goalId) to the raw string", () => {
    const action = makeAction(Some("goal-abc"));
    const wire = serializeAction(action);

    expect(wire.goal_id).toBe("goal-abc");
  });

  it("unwraps None to null", () => {
    const action = makeAction(None);
    const wire = serializeAction(action);

    expect(wire.goal_id).toBeNull();
  });

  it("preserves all other fields unchanged", () => {
    const action = makeAction(Some("goal-abc"));
    const wire = serializeAction(action);

    expect(wire.id).toBe(action.id);
    expect(wire.coaching_session_id).toBe(action.coaching_session_id);
    expect(wire.body).toBe(action.body);
    expect(wire.user_id).toBe(action.user_id);
    expect(wire.status).toBe(action.status);
    expect(wire.assignee_ids).toEqual(action.assignee_ids);
    // DateTime instances should be the same references
    expect(wire.due_by).toBe(action.due_by);
    expect(wire.created_at).toBe(action.created_at);
  });
});

// ---------------------------------------------------------------------------
// transformAction
// ---------------------------------------------------------------------------

describe("transformAction", () => {
  it("wraps a string goal_id as Some", () => {
    const raw = {
      id: "action-1",
      coaching_session_id: "session-1",
      goal_id: "goal-abc",
      body: "Test action",
      user_id: "user-1",
      status: "NotStarted",
      status_changed_at: "2026-03-30T12:00:00Z",
      due_by: "2026-04-06T12:00:00Z",
      created_at: "2026-03-30T12:00:00Z",
      updated_at: "2026-03-30T12:00:00Z",
      assignee_ids: [],
    };

    const action = transformAction(raw);

    expect(action.goal_id.some).toBe(true);
    expect(action.goal_id.val).toBe("goal-abc");
  });

  it("wraps null goal_id as None", () => {
    const raw = {
      id: "action-1",
      coaching_session_id: "session-1",
      goal_id: null,
      body: "Test action",
      user_id: "user-1",
      status: "NotStarted",
      status_changed_at: "2026-03-30T12:00:00Z",
      due_by: "2026-04-06T12:00:00Z",
      created_at: "2026-03-30T12:00:00Z",
      updated_at: "2026-03-30T12:00:00Z",
      assignee_ids: [],
    };

    const action = transformAction(raw);

    expect(action.goal_id.some).toBe(false);
    expect(action.goal_id.none).toBe(true);
  });

  it("wraps undefined goal_id as None", () => {
    const raw = {
      id: "action-1",
      coaching_session_id: "session-1",
      // goal_id intentionally absent
      body: "Test action",
      user_id: "user-1",
      status: "NotStarted",
      status_changed_at: "2026-03-30T12:00:00Z",
      due_by: "2026-04-06T12:00:00Z",
      created_at: "2026-03-30T12:00:00Z",
      updated_at: "2026-03-30T12:00:00Z",
      assignee_ids: [],
    };

    const action = transformAction(raw);

    expect(action.goal_id.some).toBe(false);
    expect(action.goal_id.none).toBe(true);
  });

  it("transforms date strings into DateTime instances", () => {
    const raw = {
      id: "action-1",
      coaching_session_id: "session-1",
      goal_id: null,
      body: "Test",
      user_id: "user-1",
      status: "NotStarted",
      status_changed_at: "2026-03-30T12:00:00Z",
      due_by: "2026-04-06T12:00:00Z",
      created_at: "2026-03-30T12:00:00Z",
      updated_at: "2026-03-30T12:00:00Z",
      assignee_ids: [],
    };

    const action = transformAction(raw);

    expect(DateTime.isDateTime(action.due_by)).toBe(true);
    expect(DateTime.isDateTime(action.created_at)).toBe(true);
    expect(DateTime.isDateTime(action.updated_at)).toBe(true);
  });

  it("round-trips: serializeAction(transformAction(raw)) preserves goal_id", () => {
    const rawWithGoal = {
      id: "action-1",
      coaching_session_id: "session-1",
      goal_id: "goal-xyz",
      body: "Test",
      user_id: "user-1",
      status: "NotStarted",
      status_changed_at: "2026-03-30T12:00:00Z",
      due_by: "2026-04-06T12:00:00Z",
      created_at: "2026-03-30T12:00:00Z",
      updated_at: "2026-03-30T12:00:00Z",
      assignee_ids: [],
    };
    const rawWithNull = { ...rawWithGoal, goal_id: null };

    expect(serializeAction(transformAction(rawWithGoal)).goal_id).toBe("goal-xyz");
    expect(serializeAction(transformAction(rawWithNull)).goal_id).toBeNull();
  });
});
