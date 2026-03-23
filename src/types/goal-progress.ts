// ─── Goal Progress Types (GET /goals/{id}/progress) ──────────────────
// Dedicated module for goal progress concerns, mirroring the backend's
// `domain::goal_progress` / `entity_api::goal_progress` module pattern.
// See GoalProgressMetrics contract v4 on the coordination board.

import { type Option, Some, None } from "@/types/option";

export enum GoalProgress {
  SolidMomentum = "SolidMomentum",
  NeedsAttention = "NeedsAttention",
  LetsRefocus = "LetsRefocus",
}

/** Normalized goal progress metrics for UI consumption. */
export interface GoalProgressMetrics {
  actions_completed: number;
  actions_total: number;
  linked_session_count: number;
  progress: GoalProgress;
  last_session_date: Option<string>;
  next_action_due: Option<string>;
}

/** Raw API response shape from GET /goals/{id}/progress, only internal use here. */
interface GoalProgressMetricsRaw {
  actions_completed: number;
  actions_total: number;
  linked_session_count: number;
  progress: string;
  last_session_date: string | null;
  next_action_due: string | null;
}

/** Validates and normalizes a raw API response into GoalProgressMetrics. */
export function parseGoalProgressMetrics(value: unknown): GoalProgressMetrics {
  if (!isGoalProgressMetricsRaw(value)) {
    throw new Error("Invalid GoalProgressMetrics data");
  }

  return {
    actions_completed: value.actions_completed,
    actions_total: value.actions_total,
    linked_session_count: value.linked_session_count,
    progress: value.progress as GoalProgress,
    last_session_date:
      value.last_session_date !== null ? Some(value.last_session_date) : None,
    next_action_due:
      value.next_action_due !== null ? Some(value.next_action_due) : None,
  };
}

function isGoalProgressMetricsRaw(value: unknown): value is GoalProgressMetricsRaw {
  if (!value || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.actions_completed === "number" &&
    typeof obj.actions_total === "number" &&
    typeof obj.linked_session_count === "number" &&
    typeof obj.progress === "string" &&
    Object.values(GoalProgress).includes(obj.progress as GoalProgress) &&
    (obj.last_session_date === null ||
      typeof obj.last_session_date === "string") &&
    (obj.next_action_due === null || typeof obj.next_action_due === "string")
  );
}
