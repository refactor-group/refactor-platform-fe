import { useMemo } from "react";
import type { SWRConfiguration } from "swr";
import { applyTimeFilter, visibleStatuses } from "@/components/ui/actions/utils";
import { useAllActionsWithContext } from "@/lib/hooks/use-all-actions-with-context";
import {
  AssignmentFilter,
  CoachViewMode,
  StatusVisibility,
  TimeRange,
  type AssignedActionWithContext,
} from "@/types/assigned-actions";
import type { Id } from "@/types/general";

/** The Actions page's filters; the page starts on DEFAULT_ACTIONS_VIEW. */
export interface ActionsView {
  viewMode: CoachViewMode;
  relationshipId?: Id;
  assignmentFilter: AssignmentFilter;
  timeRange: TimeRange;
  statusVisibility: StatusVisibility;
}

export const DEFAULT_ACTIONS_VIEW = {
  viewMode: CoachViewMode.MyActions,
  assignmentFilter: AssignmentFilter.Assigned,
  timeRange: TimeRange.Last30Days,
  statusVisibility: StatusVisibility.Open,
} as const satisfies ActionsView;

/**
 * The actions the Actions page lists for a view, before the board splits them
 * into its status columns.
 */
export function useActionsView(view: ActionsView, options?: SWRConfiguration) {
  const { actionsWithContext, isLoading, isError, refresh } = useAllActionsWithContext(
    view.viewMode,
    view.relationshipId,
    view.assignmentFilter,
    options
  );
  const filteredActions = useMemo(
    () => applyTimeFilter(actionsWithContext, view.timeRange),
    [actionsWithContext, view.timeRange]
  );

  return { actionsWithContext, filteredActions, isLoading, isError, refresh };
}

/** How many cards the board shows across its visible status columns. */
export function countVisibleActions(
  actions: AssignedActionWithContext[],
  visibility: StatusVisibility
): number {
  const statuses = new Set(visibleStatuses(visibility));
  return actions.filter(({ action }) => statuses.has(action.status)).length;
}
