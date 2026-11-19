import { describe, it, expect, afterEach } from "vitest";
import { DateTime, Settings } from "ts-luxon";
import { Some, None } from "@/types/option";
import { ItemStatus } from "@/types/general";
import type { Action } from "@/types/action";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Goal } from "@/types/goal";
import {
  addContextToAction,
  resolveGoalContext,
  buildGoalContext,
} from "@/lib/utils/assigned-actions";
import { createMockEnrichedSession } from "../../test-utils";

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

const now = DateTime.now();

function makeGoal(id: string, title: string): Goal {
  return {
    id,
    coaching_relationship_id: "rel-1",
    created_in_session_id: null,
    user_id: "user-1",
    title,
    body: "",
    status: ItemStatus.NotStarted,
    status_changed_at: now.toISO()!,
    completed_at: now.toISO()!,
    target_date: null,
    created_at: now.toISO()!,
    updated_at: now.toISO()!,
  };
}

function makeAction(overrides: Partial<Action> = {}): Action {
  return {
    id: "action-1",
    coaching_session_id: "session-1",
    goal_id: None,
    body: "Test action",
    user_id: "user-1",
    status: ItemStatus.NotStarted,
    status_changed_at: now,
    due_by: Some(now.plus({ days: 7 })),
    created_at: now,
    updated_at: now,
    assignee_ids: [],
    ...overrides,
  };
}

function makeSession(goals: Goal[] = []): EnrichedCoachingSession {
  return createMockEnrichedSession({ date: now.toISO()!, goals });
}

// ---------------------------------------------------------------------------
// resolveGoalContext
// ---------------------------------------------------------------------------

describe("resolveGoalContext", () => {
  const goals = [
    makeGoal("goal-1", "Improve communication"),
    makeGoal("goal-2", "Build leadership skills"),
  ];

  it("returns GoalContext when goal_id is Some and found in goals", () => {
    const result = resolveGoalContext(Some("goal-1"), goals);
    expect(result).toEqual({ goalId: "goal-1", title: "Improve communication" });
  });

  it("returns undefined when goal_id is None", () => {
    expect(resolveGoalContext(None, goals)).toBeUndefined();
  });

  it("returns undefined when goals array is undefined", () => {
    expect(resolveGoalContext(Some("goal-1"), undefined)).toBeUndefined();
  });

  it("returns undefined when goal_id is not found in goals", () => {
    expect(resolveGoalContext(Some("nonexistent"), goals)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// buildGoalContext
// ---------------------------------------------------------------------------

describe("buildGoalContext", () => {
  const goal1 = makeGoal("goal-1", "Improve communication");
  const goal2 = makeGoal("goal-2", "Build leadership skills");

  it("prefers action.goal_id over session's first goal", () => {
    const action = makeAction({ goal_id: Some("goal-2") });
    const session = makeSession([goal1, goal2]);

    const result = buildGoalContext(action, session);
    expect(result).toEqual({ goalId: "goal-2", title: "Build leadership skills" });
  });

  it("falls back to session's first goal when action has no goal_id", () => {
    const action = makeAction({ goal_id: None });
    const session = makeSession([goal1, goal2]);

    const result = buildGoalContext(action, session);
    expect(result).toEqual({ goalId: "goal-1", title: "Improve communication" });
  });

  it("returns No Goal when action has no goal_id and session has no goals", () => {
    const action = makeAction({ goal_id: None });
    const session = makeSession([]);

    const result = buildGoalContext(action, session);
    expect(result).toEqual({ goalId: "", title: "No Goal" });
  });

  it("falls back to session's first goal when action.goal_id is not in session goals", () => {
    const action = makeAction({ goal_id: Some("nonexistent") });
    const session = makeSession([goal1]);

    const result = buildGoalContext(action, session);
    expect(result).toEqual({ goalId: "goal-1", title: "Improve communication" });
  });
});

// ---------------------------------------------------------------------------
// addContextToAction: overdue
// ---------------------------------------------------------------------------

describe("addContextToAction overdue", () => {
  const originalNow = Settings.now;
  afterEach(() => {
    Settings.now = originalNow;
  });

  // At 06:00 UTC it's Oct 30 everywhere here; the action was due 03:00 UTC, which is still Oct 29 in Chicago.
  const pinned = DateTime.fromISO("2026-10-30T06:00:00Z").toMillis();
  const overdueFor = (timezone: string) => {
    Settings.now = () => pinned;
    const action = makeAction({ due_by: Some(DateTime.fromISO("2026-10-30T03:00:00Z")) });
    const sessionMap = new Map([["session-1", makeSession()]]);
    return addContextToAction(action, sessionMap, new Map(), timezone)?.isOverdue;
  };

  it("counts calendar days in the profile zone", () => {
    expect(overdueFor("America/Chicago")).toBe(true);
    expect(overdueFor("UTC")).toBe(false);
  });
});
