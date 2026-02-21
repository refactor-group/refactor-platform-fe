import { DateTime } from "ts-luxon";
import { ItemStatus, Id } from "@/types/general";
import { SortOrder, type ActionSortField } from "@/types/sorting";

// This must always reflect the Rust struct on the backend
// Combines entity::actions::Model with assignee_ids from ActionWithAssignees
export interface Action {
  id: Id;
  coaching_session_id: Id;
  body?: string;
  user_id: Id;
  status: ItemStatus;
  status_changed_at: DateTime;
  due_by: DateTime;
  created_at: DateTime;
  updated_at: DateTime;
  /** User IDs assigned to this action. Frontend resolves names from coach/coachee data. */
  assignee_ids?: Id[];
}

const ITEM_STATUS_VALUES: ReadonlySet<string> = new Set(
  Object.values(ItemStatus)
);

function isDateTimeOrString(value: unknown): boolean {
  return typeof value === "string" || DateTime.isDateTime(value);
}

export function isAction(value: unknown): value is Action {
  if (!value || typeof value !== "object") {
    return false;
  }
  const object = value as Record<string, unknown>;

  return (
    typeof object.id === "string" &&
    typeof object.coaching_session_id === "string" &&
    typeof object.user_id === "string" &&
    typeof object.status === "string" &&
    ITEM_STATUS_VALUES.has(object.status as string) &&
    isDateTimeOrString(object.status_changed_at) &&
    isDateTimeOrString(object.due_by) &&
    isDateTimeOrString(object.created_at) &&
    isDateTimeOrString(object.updated_at) &&
    (object.body === undefined || typeof object.body === "string") &&
    (object.assignee_ids === undefined ||
      (Array.isArray(object.assignee_ids) &&
        object.assignee_ids.every((id: unknown) => typeof id === "string")))
  );
}

export function isActionArray(value: unknown): value is Action[] {
  return Array.isArray(value) && value.every(isAction);
}

export function sortActionArray(
  actions: Action[],
  order: SortOrder,
  field: ActionSortField = "updated_at"
): Action[] {
  const sorted = [...actions];
  sorted.sort((a, b) => {
    const aTime = a[field].toMillis();
    const bTime = b[field].toMillis();
    const primary = order === SortOrder.Asc ? aTime - bTime : bTime - aTime;
    if (primary !== 0) return primary;
    // Deterministic tiebreaker: ascending by id to ensure stable order
    // when the primary sort field values are equal.
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  return sorted;
}

/**
 * Sort items by a pre-built position map. Items not in the map are placed at
 * the end. Useful for preserving an initial load order across SWR revalidations
 * so that inline edits don't re-sort the list.
 *
 * @param items     - The array to sort (not mutated; returns a new array)
 * @param getId     - Extracts the ID used to look up position
 * @param positions - Map of ID → sort index (e.g. from buildInitialOrder)
 */
export function sortByPositionMap<T>(
  items: T[],
  getId: (item: T) => string,
  positions: Map<string, number>
): T[] {
  return [...items].sort((a, b) => {
    const posA = positions.get(getId(a)) ?? Infinity;
    const posB = positions.get(getId(b)) ?? Infinity;
    // Guard against Infinity - Infinity = NaN (undefined sort behavior per spec)
    if (posA === Infinity && posB === Infinity) return 0;
    return posA - posB;
  });
}

/**
 * Sort items by a date extracted via callback (ascending, earliest first).
 * Returns a new array without mutating the original.
 */
export function sortByDateField<T>(
  items: T[],
  getDate: (item: T) => DateTime
): T[] {
  return [...items].sort((a, b) => getDate(a).toMillis() - getDate(b).toMillis());
}

export function defaultAction(): Action {
  const now = DateTime.now();
  return {
    id: "",
    coaching_session_id: "",
    body: "",
    user_id: "",
    status: ItemStatus.NotStarted,
    status_changed_at: now,
    due_by: now,
    created_at: now,
    updated_at: now,
    assignee_ids: [],
  };
}

export function defaultActions(): Action[] {
  return [defaultAction()];
}

export function actionToString(action: Action): string {
  return JSON.stringify(action);
}

export function actionsToString(actions: Action[]): string {
  return JSON.stringify(actions);
}
