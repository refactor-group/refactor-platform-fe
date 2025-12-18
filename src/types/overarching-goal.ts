import { DateTime } from "ts-luxon";
import { Id, ItemStatus } from "@/types/general";

// This must always reflect the Rust struct on the backend
// entity::overarching_goals::Model
export interface OverarchingGoal {
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

export function parseOverarchingGoal(data: any): OverarchingGoal {
  if (!isOverarchingGoal(data)) {
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

export function isOverarchingGoal(value: unknown): value is OverarchingGoal {
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

export function isOverarchingGoalArray(
  value: unknown
): value is OverarchingGoal[] {
  return Array.isArray(value) && value.every(isOverarchingGoal);
}

// export function sortOverarchingGoalArray(
//   sessions: OverarchingGoal[],
//   order: SortOrder
// ): OverarchingGoal[] {
//   if (order == SortOrder.Ascending) {
//     sessions.sort(
//       (a, b) =>
//         new Date(a.date.toString()).getTime() -
//         new Date(b.date.toString()).getTime()
//     );
//   } else if (order == SortOrder.Descending) {
//     sessions.sort(
//       (a, b) =>
//         new Date(b.date.toString()).getTime() -
//         new Date(a.date.toString()).getTime()
//     );
//   }
//   return sessions;
// }

export function getOverarchingGoalById(
  id: string,
  goals: OverarchingGoal[]
): OverarchingGoal {
  const goal = goals.find((goal) => goal.id === id);
  return goal ? goal : defaultOverarchingGoal();
}

export function defaultOverarchingGoal(): OverarchingGoal {
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

export function defaultOverarchingGoals(): OverarchingGoal[] {
  return [defaultOverarchingGoal()];
}

export function overarchingGoalToString(
  goal: OverarchingGoal | undefined
): string {
  return JSON.stringify(goal);
}

export function overarchingGoalsToString(
  goals: OverarchingGoal[] | undefined
): string {
  return JSON.stringify(goals);
}
