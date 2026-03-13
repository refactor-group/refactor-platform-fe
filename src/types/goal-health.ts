// ─── Goal Health Types (GET /goals/{id}/health) ─────────────────────
// Dedicated module for goal health concerns, mirroring the backend's
// `domain::goal_health` / `entity_api::goal_health` module pattern.
// See GoalHealthMetrics contract v3 on the coordination board.

import { type Option, Some, None } from "@/types/option";

export enum GoalHealth {
  SolidMomentum = "SolidMomentum",
  NeedsAttention = "NeedsAttention",
  LetsRefocus = "LetsRefocus",
}

/** Normalized goal health metrics for UI consumption. */
export interface GoalHealthMetrics {
  actions_completed: number;
  actions_total: number;
  linked_session_count: number;
  health: GoalHealth;
  last_session_date: Option<string>;
  next_action_due: Option<string>;
}

/** Raw API response shape from GET /goals/{id}/health. */
interface GoalHealthMetricsRaw {
  actions_completed: number;
  actions_total: number;
  linked_session_count: number;
  health: string;
  last_session_date: string | null;
  next_action_due: string | null;
}

/** Validates and normalizes a raw API response into GoalHealthMetrics. */
export function parseGoalHealthMetrics(value: unknown): GoalHealthMetrics {
  if (!isGoalHealthMetricsRaw(value)) {
    throw new Error("Invalid GoalHealthMetrics data");
  }

  return {
    actions_completed: value.actions_completed,
    actions_total: value.actions_total,
    linked_session_count: value.linked_session_count,
    health: value.health as GoalHealth,
    last_session_date: value.last_session_date !== null ? Some(value.last_session_date) : None,
    next_action_due: value.next_action_due !== null ? Some(value.next_action_due) : None,
  };
}

export function isGoalHealthMetricsRaw(value: unknown): value is GoalHealthMetricsRaw {
  if (!value || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.actions_completed === "number" &&
    typeof obj.actions_total === "number" &&
    typeof obj.linked_session_count === "number" &&
    typeof obj.health === "string" &&
    Object.values(GoalHealth).includes(obj.health as GoalHealth) &&
    (obj.last_session_date === null || typeof obj.last_session_date === "string") &&
    (obj.next_action_due === null || typeof obj.next_action_due === "string")
  );
}
