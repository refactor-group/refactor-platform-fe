// ─── Goal Progress Types (GET /goals/{id}/progress) ──────────────────
// Dedicated module for goal progress concerns, mirroring the backend's
// `domain::goal_progress` / `entity_api::goal_progress` module pattern.
// See GoalProgressMetrics contract v4 on the coordination board.

import { Id, ItemStatus } from "@/types/general";
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
  linked_coaching_session_count: number;
  progress: GoalProgress;
  last_coaching_session_date: Option<string>;
  next_action_due: Option<string>;
}

/** Raw API response shape — uses backend's snake_case field names. */
interface GoalProgressMetricsRaw {
  actions_completed: number;
  actions_total: number;
  linked_coaching_session_count: number;
  progress: string;
  last_coaching_session_date: string | null;
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
    linked_coaching_session_count: value.linked_coaching_session_count,
    progress: value.progress as GoalProgress,
    last_coaching_session_date:
      value.last_coaching_session_date !== null
        ? Some(value.last_coaching_session_date)
        : None,
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
    typeof obj.linked_coaching_session_count === "number" &&
    typeof obj.progress === "string" &&
    Object.values(GoalProgress).includes(obj.progress as GoalProgress) &&
    (obj.last_coaching_session_date === null ||
      typeof obj.last_coaching_session_date === "string") &&
    (obj.next_action_due === null || typeof obj.next_action_due === "string")
  );
}

// ─── Aggregate Goal Progress (GET /organizations/{org_id}/coaching_relationships/{rel_id}/goal_progress) ──

/** A single goal's progress entry from the aggregate endpoint. */
export interface GoalWithProgress {
  goal_id: Id;
  coaching_relationship_id: Id;
  title: string;
  body: string;
  status: ItemStatus;
  status_changed_at: string;
  target_date: string | null;
  created_at: string;
  updated_at: string;
  progress_metrics: GoalProgressMetrics;
}

/** Raw API response shape from the aggregate endpoint. */
interface GoalWithProgressRaw {
  goal_id: string;
  coaching_relationship_id: string;
  title: string;
  body: string;
  status: string;
  status_changed_at: string;
  target_date: string | null;
  created_at: string;
  updated_at: string;
  progress_metrics: unknown;
}

/** Response wrapper from GET .../goal_progress */
interface GoalProgressResponseRaw {
  goal_progress: unknown[];
}

function isGoalWithProgressRaw(value: unknown): value is GoalWithProgressRaw {
  if (!value || typeof value !== "object") {
    return false;
  }
  const obj = value as Record<string, unknown>;

  return (
    typeof obj.goal_id === "string" &&
    typeof obj.coaching_relationship_id === "string" &&
    typeof obj.title === "string" &&
    typeof obj.body === "string" &&
    typeof obj.status === "string" &&
    typeof obj.status_changed_at === "string" &&
    (obj.target_date === null || typeof obj.target_date === "string") &&
    typeof obj.created_at === "string" &&
    typeof obj.updated_at === "string" &&
    obj.progress_metrics !== undefined
  );
}

function parseGoalWithProgress(value: unknown): GoalWithProgress {
  if (!isGoalWithProgressRaw(value)) {
    throw new Error("Invalid GoalWithProgress data");
  }

  return {
    goal_id: value.goal_id,
    coaching_relationship_id: value.coaching_relationship_id,
    title: value.title,
    body: value.body,
    status: value.status as ItemStatus,
    status_changed_at: value.status_changed_at,
    target_date: value.target_date,
    created_at: value.created_at,
    updated_at: value.updated_at,
    progress_metrics: parseGoalProgressMetrics(value.progress_metrics),
  };
}

/** Validates and normalizes the aggregate goal progress response. */
export function parseGoalProgressResponse(value: unknown): GoalWithProgress[] {
  if (
    !value ||
    typeof value !== "object" ||
    !Array.isArray((value as GoalProgressResponseRaw).goal_progress)
  ) {
    throw new Error("Invalid GoalProgressResponse data");
  }

  return (value as GoalProgressResponseRaw).goal_progress.map(parseGoalWithProgress);
}
