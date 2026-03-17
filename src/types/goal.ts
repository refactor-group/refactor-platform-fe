import { DateTime } from "ts-luxon";
import { Id, ItemStatus, EntityApiError } from "@/types/general";

// ─── Active Goal Limit (409 Conflict) ───────────────────────────────
// "Active" means InProgress ONLY — NotStarted does not count.
// See ActiveGoalLimitError contract v4 on the coordination board.

/** Default limit used when no 409 response has been received yet. */
const DEFAULT_MAX_ACTIVE_GOALS = 3;

/** Summary of an InProgress goal returned in the 409 response body. */
export interface ActiveGoalSummary {
  id: Id;
  title: string;
}

/** Parsed result from a 409 active-goal-limit error. */
export interface ActiveGoalLimitInfo {
  maxActiveGoals: number;
  activeGoals: ActiveGoalSummary[];
}

/** Shape of the 409 response body when the active-goal limit is exceeded. */
export interface ActiveGoalLimitErrorData {
  status_code: 409;
  error: "active_goal_limit_reached";
  message: string;
  max_active_goals: number;
  active_goals: ActiveGoalSummary[];
}

/**
 * Extracts active-goal-limit info from an EntityApiError if it represents
 * a 409 active-goal-limit error. Returns the limit and active goals on match,
 * or null if the error is something else.
 */
export function extractActiveGoalLimitError(
  err: unknown
): ActiveGoalLimitInfo | null {
  if (
    !(err instanceof EntityApiError) ||
    err.status !== 409
  ) {
    return null;
  }

  const data = err.data;
  if (
    data &&
    typeof data === "object" &&
    data.error === "active_goal_limit_reached" &&
    Array.isArray(data.active_goals) &&
    typeof data.max_active_goals === "number"
  ) {
    return {
      maxActiveGoals: data.max_active_goals,
      activeGoals: data.active_goals as ActiveGoalSummary[],
    };
  }

  return null;
}

export { DEFAULT_MAX_ACTIVE_GOALS };

// This must always reflect the Rust struct on the backend
// entity::goals::Model
export interface Goal {
  id: Id;
  coaching_relationship_id: Id;
  created_in_session_id: Id | null;
  user_id: Id;
  title: string;
  body: string;
  status: ItemStatus;
  status_changed_at: DateTime;
  completed_at: DateTime;
  target_date: string | null;
  created_at: DateTime;
  updated_at: DateTime;
}

export function parseGoal(data: any): Goal {
  if (!isGoal(data)) {
    throw new Error("Invalid Goal data");
  }
  return {
    id: data.id,
    coaching_relationship_id: data.coaching_relationship_id,
    created_in_session_id: data.created_in_session_id ?? null,
    user_id: data.user_id,
    title: data.title,
    body: data.body,
    status: data.status,
    status_changed_at: data.status_changed_at,
    completed_at: data.completed_at,
    target_date: data.target_date ?? null,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export function isGoal(value: unknown): value is Goal {
  if (!value || typeof value !== "object") {
    return false;
  }
  const object = value as Record<string, unknown>;

  return (
    typeof object.id === "string" &&
    typeof object.coaching_relationship_id === "string" &&
    (object.created_in_session_id === null || typeof object.created_in_session_id === "string") &&
    typeof object.user_id === "string" &&
    typeof object.title === "string" &&
    typeof object.body === "string" &&
    typeof object.status === "string" &&
    (object.target_date === null || typeof object.target_date === "string") &&
    typeof object.status_changed_at === "string" &&
    typeof object.completed_at === "string" &&
    typeof object.created_at === "string" &&
    typeof object.updated_at === "string"
  );
}

export function isGoalArray(
  value: unknown
): value is Goal[] {
  return Array.isArray(value) && value.every(isGoal);
}

export function getGoalById(
  id: string,
  goals: Goal[]
): Goal {
  const goal = goals.find((goal) => goal.id === id);
  return goal ? goal : defaultGoal();
}

export function defaultGoal(): Goal {
  const now = DateTime.now();
  return {
    id: "",
    coaching_relationship_id: "",
    created_in_session_id: null,
    user_id: "",
    title: "",
    body: "",
    status: ItemStatus.NotStarted,
    status_changed_at: now,
    completed_at: now,
    target_date: null,
    created_at: now,
    updated_at: now,
  };
}

export function defaultGoals(): Goal[] {
  return [defaultGoal()];
}

export const DEFAULT_GOAL_TITLE = "No goal set";

/**
 * Returns the goal's title if non-empty, otherwise a default fallback.
 * Handles empty string titles consistently across the UI.
 */
export function goalTitle(
  goal: Pick<Goal, "title">,
  fallback: string = DEFAULT_GOAL_TITLE
): string {
  return goal.title || fallback;
}

/** Returns true when the goal's status is OnHold. */
export function isOnHold(goal: Pick<Goal, "status">): boolean {
  return goal.status === ItemStatus.OnHold;
}

export function goalToString(
  goal: Goal | undefined
): string {
  return JSON.stringify(goal);
}

export function goalsToString(
  goals: Goal[] | undefined
): string {
  return JSON.stringify(goals);
}
