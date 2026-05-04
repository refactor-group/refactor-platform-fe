import { DateTime } from "ts-luxon";
import { Id, ItemStatus, EntityApiError } from "@/types/general";

// ─── Goal-endpoint error discriminators ────────────────────────────
// Top-level `error` string values returned by structured-error
// responses from goal-related endpoints. Centralized so wire-format
// strings live in one place and additions are discoverable.

export enum GoalErrorCode {
  /** Generic conflict; the specific case is carried in `details`. */
  Conflict = "conflict",
  /** POST /coaching_sessions/:id/goals on a goal already linked. */
  GoalAlreadyLinkedToSession = "goal_already_linked_to_session",
  /** POST /coaching_sessions/:id/goals on a Completed/WontDo goal. */
  CannotLinkCompletedGoal = "cannot_link_completed_goal",
}

// ─── In-Progress Goal Limit (409 Conflict) ─────────────────────────
// "Active" in FE-internal naming (e.g. DEFAULT_MAX_ACTIVE_GOALS) means
// InProgress ONLY — NotStarted does not count.
// Wire format documented in ActiveGoalLimitConflict v1 on the
// coordination board. The 409 carries `error: "conflict"` (generic) and
// the limit info nested under `details`. Discriminate on BOTH the error
// code AND the presence of `details.max_in_progress_goals` so a future
// 409 variant that happens to carry similar details fields can't be
// misclassified.

/** Default limit used when no 409 response has been received yet. */
const DEFAULT_MAX_ACTIVE_GOALS = 3;

/** Summary of an InProgress goal returned in the 409 response body. */
export interface InProgressGoalSummary {
  id: Id;
  title: string;
}

/** Parsed result from a 409 in-progress-goal-limit error. */
export interface ActiveGoalLimitInfo {
  maxInProgressGoals: number;
  inProgressGoals: InProgressGoalSummary[];
}

/**
 * Extracts in-progress-goal-limit info from an EntityApiError if it
 * represents the active-goal-limit case (409 with `error: "conflict"`
 * and the BE's `details.max_in_progress_goals` discriminator). Returns
 * the limit and in-progress goals on match, or null otherwise.
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
  if (!data || typeof data !== "object") return null;

  if ((data as { error?: unknown }).error !== GoalErrorCode.Conflict) {
    return null;
  }

  const details = (data as { details?: unknown }).details;
  if (
    details &&
    typeof details === "object" &&
    typeof (details as { max_in_progress_goals?: unknown }).max_in_progress_goals === "number" &&
    Array.isArray((details as { in_progress_goals?: unknown }).in_progress_goals)
  ) {
    const d = details as {
      max_in_progress_goals: number;
      in_progress_goals: InProgressGoalSummary[];
    };
    return {
      maxInProgressGoals: d.max_in_progress_goals,
      inProgressGoals: d.in_progress_goals,
    };
  }

  return null;
}

// ─── Cannot-Link-Completed-Goal (422) ───────────────────────────────
// Returned by POST /coaching_sessions/:id/goals when the target goal is
// Completed or WontDo. See goal_session_link_invariant decision on the
// coordination board.

/**
 * Returns true when the error is a 422 cannot_link_completed_goal response
 * from the link-goal-to-session endpoint.
 */
export function isCannotLinkCompletedGoalError(err: unknown): boolean {
  if (
    !(err instanceof EntityApiError) ||
    err.status !== 422
  ) {
    return false;
  }
  const data = err.data;
  return (
    !!data &&
    typeof data === "object" &&
    (data as { error?: unknown }).error === GoalErrorCode.CannotLinkCompletedGoal
  );
}

// ─── Goal Already Linked To Session (409) ──────────────────────────
// Wire format documented in GoalAlreadyLinkedToSessionError v1 on the
// coordination board. Distinct from the cap-collision 409 — this one
// uses the specific-discriminator pattern (top-level `error` string),
// no `details` envelope. See feedback_error_variant_shape on BE side.

/**
 * Returns true when the error is a 409 goal_already_linked_to_session
 * response from POST /coaching_sessions/:id/goals.
 */
export function isGoalAlreadyLinkedToSessionError(err: unknown): boolean {
  if (
    !(err instanceof EntityApiError) ||
    err.status !== 409
  ) {
    return false;
  }
  const data = err.data;
  return (
    !!data &&
    typeof data === "object" &&
    (data as { error?: unknown }).error === GoalErrorCode.GoalAlreadyLinkedToSession
  );
}

/**
 * Whether the active goal limit has been reached.
 * True when either the coaching relationship has the max number of
 * InProgress goals, or a session already has the max linked goals.
 */
export function isAtGoalLimit(
  inProgressGoals: Goal[],
  sessionLinkedGoals: Goal[]
): boolean {
  return (
    inProgressGoals.length >= DEFAULT_MAX_ACTIVE_GOALS ||
    sessionLinkedGoals.length >= DEFAULT_MAX_ACTIVE_GOALS
  );
}

/**
 * Returns the maximum number of active (InProgress) goals allowed.
 * Uses the server-provided value from a prior 409 response if available,
 * otherwise falls back to the default.
 */
export function maxActiveGoals(): number {
  return DEFAULT_MAX_ACTIVE_GOALS;
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

/**
 * Summarizes an enriched session's goals array into a display string.
 * Returns the first goal's title when there is exactly one, a comma-joined
 * list when there are multiple, or the default fallback when the array is
 * empty or undefined.
 */
export function goalsTitle(
  goals: Pick<Goal, "title">[] | undefined,
  fallback: string = DEFAULT_GOAL_TITLE
): string {
  if (!goals || goals.length === 0) return fallback;
  return goals.map((g) => goalTitle(g, fallback)).join(", ");
}

/** Returns true when the goal's status is OnHold. */
export function isOnHold(goal: Pick<Goal, "status">): boolean {
  return goal.status === ItemStatus.OnHold;
}

/** Returns true when the goal's status is InProgress. */
export function isInProgress(goal: Pick<Goal, "status">): boolean {
  return goal.status === ItemStatus.InProgress;
}

/** Returns true when the goal has a non-empty body/description. */
export function hasGoalBody(goal: Pick<Goal, "body">): boolean {
  return goal.body.trim().length > 0;
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
