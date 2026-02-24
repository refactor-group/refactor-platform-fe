/**
 * Pure utility functions for the global actions kanban board.
 *
 * These handle grouping actions by status column, applying client-side
 * time/relationship filters, and providing display metadata for columns.
 */

import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import { sortByPositionMap } from "@/types/action";
import {
  StatusVisibility,
  TimeRange,
} from "@/types/assigned-actions";

/** Display order for kanban status columns (left → right) */
export const STATUS_COLUMN_ORDER: ItemStatus[] = [
  ItemStatus.NotStarted,
  ItemStatus.InProgress,
  ItemStatus.Completed,
  ItemStatus.WontDo,
];

/** Tailwind background color class for each status column indicator */
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

/** Tailwind text color class for each status */
export function statusTextColor(status: ItemStatus): string {
  switch (status) {
    case ItemStatus.NotStarted:
      return "text-slate-500";
    case ItemStatus.InProgress:
      return "text-blue-500";
    case ItemStatus.Completed:
      return "text-green-600";
    case ItemStatus.WontDo:
      return "text-gray-500";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}

/** Group items into status buckets, preserving order within each bucket */
export function groupByStatus<T>(
  items: T[],
  getStatus: (item: T) => ItemStatus
): Record<ItemStatus, T[]> {
  const result: Record<ItemStatus, T[]> = {
    [ItemStatus.NotStarted]: [],
    [ItemStatus.InProgress]: [],
    [ItemStatus.Completed]: [],
    [ItemStatus.WontDo]: [],
  };

  for (const item of items) {
    result[getStatus(item)].push(item);
  }

  return result;
}

/** Apply a time range filter on due date */
export function applyTimeFilter(
  actions: AssignedActionWithContext[],
  range: TimeRange
): AssignedActionWithContext[] {
  if (range === TimeRange.AllTime) return actions;

  const now = DateTime.now().startOf("day");
  const daysBack = range === TimeRange.Last30Days ? 30 : 90;
  const cutoff = now.minus({ days: daysBack });

  return actions.filter((ctx) => ctx.action.due_by >= cutoff);
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
 * Preserve snapshotted card positions within each status group.
 * Delegates to the generic `sortByPositionMap` from `@/types/action`.
 */
export function preserveGroupOrder(
  grouped: Record<ItemStatus, AssignedActionWithContext[]>,
  positionMap: Map<string, number>
): Record<ItemStatus, AssignedActionWithContext[]> {
  const getId = (ctx: AssignedActionWithContext) => ctx.action.id;
  const result = { ...grouped };
  for (const status of Object.keys(result) as ItemStatus[]) {
    result[status] = sortByPositionMap(result[status], getId, positionMap);
  }
  return result;
}

/**
 * Functional builder: group actions by status, then optionally preserve
 * snapshotted card positions so inline edits don't re-sort.
 */
export function groupActionsByStatus(items: AssignedActionWithContext[]) {
  const grouped = groupByStatus(items, (ctx) => ctx.action.status);
  return {
    preservingOrder(positionMap: Map<string, number>) {
      return preserveGroupOrder(grouped, positionMap);
    },
  };
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
