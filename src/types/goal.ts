import { DateTime } from "ts-luxon";
import { Id, ItemStatus } from "@/types/general";

// This must always reflect the Rust struct on the backend
// entity::goals::Model
export interface Goal {
  id: Id;
  coaching_session_id: Id;
  user_id: Id;
  title: string;
  body: string;
  status: ItemStatus;
  status_changed_at: DateTime;
  completed_at: DateTime;
  created_at: DateTime;
  updated_at: DateTime;
}

export function parseGoal(data: any): Goal {
  if (!isGoal(data)) {
    throw new Error("Invalid CoachingSession data");
  }
  return {
    id: data.id,
    coaching_session_id: data.coaching_session_id,
    user_id: data.user_id,
    title: data.title,
    body: data.body,
    status: data.status,
    status_changed_at: data.status_changed_at,
    completed_at: data.completed_at,
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
    (typeof object.id === "string" &&
      typeof object.coaching_session_id === "string" &&
      typeof object.user_id === "string" &&
      typeof object.status === "string" &&
      typeof object.created_at === "string" &&
      typeof object.updated_at === "string") ||
    typeof object.title === "string" ||
    typeof object.body === "string" ||
    typeof object.status_changed_at === "string" ||
    typeof object.completed_at === "string"
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
    coaching_session_id: "",
    user_id: "",
    title: "",
    body: "",
    status: ItemStatus.NotStarted,
    status_changed_at: now,
    completed_at: now,
    created_at: now,
    updated_at: now,
  };
}

export function defaultGoals(): Goal[] {
  return [defaultGoal()];
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
