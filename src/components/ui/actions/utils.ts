/**
 * Pure utility functions for the global actions kanban board.
 *
 * These handle grouping actions by status column, applying client-side
 * time/relationship filters, and providing display metadata for columns.
 */

import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import type { Id } from "@/types/general";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import { sortByPositionMap } from "@/types/action";
import {
  StatusVisibility,
  TimeRange,
  TimeField,
} from "@/types/assigned-actions";

/** Display order for kanban status columns (left → right) */
export const STATUS_COLUMN_ORDER: ItemStatus[] = [
  ItemStatus.NotStarted,
  ItemStatus.InProgress,
  ItemStatus.Completed,
  ItemStatus.WontDo,
];

/** Human-readable label for each status */
export function statusLabel(status: ItemStatus): string {
  switch (status) {
    case ItemStatus.NotStarted:
      return "Not Started";
    case ItemStatus.InProgress:
      return "In Progress";
    case ItemStatus.Completed:
      return "Completed";
    case ItemStatus.WontDo:
      return "Won't Do";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}

/** Tailwind color class for each status column indicator */
export function statusColor(status: ItemStatus): string {
  switch (status) {
    case ItemStatus.NotStarted:
      return "bg-slate-400";
    case ItemStatus.InProgress:
      return "bg-blue-500";
    case ItemStatus.Completed:
      return "bg-green-500";
    case ItemStatus.WontDo:
      return "bg-gray-400";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}

/** Group actions into status buckets, preserving order within each bucket */
export function groupByStatus(
  actions: AssignedActionWithContext[]
): Record<ItemStatus, AssignedActionWithContext[]> {
  const result: Record<ItemStatus, AssignedActionWithContext[]> = {
    [ItemStatus.NotStarted]: [],
    [ItemStatus.InProgress]: [],
    [ItemStatus.Completed]: [],
    [ItemStatus.WontDo]: [],
  };

  for (const ctx of actions) {
    result[ctx.action.status].push(ctx);
  }

  return result;
}

/** Apply a time range filter on the given date field */
export function applyTimeFilter(
  actions: AssignedActionWithContext[],
  range: TimeRange,
  field: TimeField
): AssignedActionWithContext[] {
  if (range === TimeRange.AllTime) return actions;

  const now = DateTime.now().startOf("day");
  const daysBack = range === TimeRange.Last30Days ? 30 : 90;
  const cutoff = now.minus({ days: daysBack });

  return actions.filter((ctx) => {
    const dateValue =
      field === TimeField.DueDate ? ctx.action.due_by : ctx.action.created_at;
    return dateValue >= cutoff;
  });
}

/** Filter actions by coaching relationship (no-op when relationshipId is undefined) */
export function filterByRelationship(
  actions: AssignedActionWithContext[],
  relationshipId?: Id
): AssignedActionWithContext[] {
  if (!relationshipId) return actions;
  return actions.filter(
    (ctx) => ctx.relationship.coachingRelationshipId === relationshipId
  );
}

/**
 * Build a position map from a previous snapshot and the current set of IDs.
 *
 * Preserves existing positions for IDs still present, appends new IDs at the
 * end. Returns `null` when the ID set hasn't changed (no additions or removals),
 * signalling the caller that the previous map is still valid.
 */
export function buildInitialOrder(
  previous: Map<string, number>,
  currentIds: string[]
): Map<string, number> | null {
  const currentSet = new Set(currentIds);
  const hasAdded = currentIds.some((id) => !previous.has(id));
  const hasRemoved = [...previous.keys()].some((id) => !currentSet.has(id));

  if (!hasAdded && !hasRemoved) return null;

  const next = new Map<string, number>();
  let idx = 0;

  // Preserve order for IDs that are still present
  for (const [id] of previous) {
    if (currentSet.has(id)) {
      next.set(id, idx++);
    }
  }

  // Append new IDs at the end
  for (const id of currentIds) {
    if (!next.has(id)) {
      next.set(id, idx++);
    }
  }

  return next;
}

/**
 * Sort actions within each status group according to an initial position map.
 * Delegates to the generic `sortByPositionMap` from `@/types/action`.
 */
export function sortGroupedByInitialOrder(
  grouped: Record<ItemStatus, AssignedActionWithContext[]>,
  order: Map<string, number>
): Record<ItemStatus, AssignedActionWithContext[]> {
  const getId = (ctx: AssignedActionWithContext) => ctx.action.id;
  const sorted = { ...grouped };
  for (const status of Object.keys(sorted) as ItemStatus[]) {
    sorted[status] = sortByPositionMap(sorted[status], getId, order);
  }
  return sorted;
}

/** Which ItemStatus values are visible for a given StatusVisibility setting */
export function visibleStatuses(visibility: StatusVisibility): ItemStatus[] {
  switch (visibility) {
    case StatusVisibility.Open:
      return [ItemStatus.NotStarted, ItemStatus.InProgress];
    case StatusVisibility.All:
      return [...STATUS_COLUMN_ORDER];
    case StatusVisibility.Closed:
      return [ItemStatus.Completed, ItemStatus.WontDo];
    default: {
      const _exhaustive: never = visibility;
      throw new Error(`Unhandled visibility: ${_exhaustive}`);
    }
  }
}
