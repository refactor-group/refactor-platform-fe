import { useMemo, useState, useEffect, useCallback } from "react";
import { UserActionsApi } from "@/lib/api/user-actions";
import {
  UserActionsAssigneeFilter,
  UserActionsScope,
} from "@/types/assigned-actions";
import type { Action } from "@/types/action";

export interface CoacheeActionsFetchResult {
  actions: Action[];
  isLoading: boolean;
  isError: boolean;
  refresh: () => void;
}

/**
 * Fetches actions for multiple coachees in parallel.
 * Returns a flattened array of all coachee actions.
 *
 * Uses a stable string key derived from coacheeIds to avoid infinite
 * re-render loops from unstable array identity changes.
 */
export function useCoacheeActionsFetch(
  coacheeIds: string[],
  enabled: boolean,
  coachingRelationshipId?: string,
  scope: UserActionsScope = UserActionsScope.Assigned,
  assigneeFilter?: UserActionsAssigneeFilter
): CoacheeActionsFetchResult {
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isError, setIsError] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Stable key to avoid refetching when array reference changes
  const coacheeIdsKey = useMemo(() => coacheeIds.join(","), [coacheeIds]);

  useEffect(() => {
    if (!enabled || coacheeIds.length === 0) {
      setActions([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setIsError(false);

    Promise.all(
      coacheeIds.map((id) =>
        UserActionsApi.list(id, {
          scope,
          coaching_relationship_id: coachingRelationshipId,
          assignee_filter: assigneeFilter,
        })
      )
    )
      .then((results) => {
        setActions(results.flat());
        setIsLoading(false);
      })
      .catch(() => {
        setIsError(true);
        setIsLoading(false);
      });
    // coacheeIds is intentionally omitted — coacheeIdsKey is the stable string proxy
    // that prevents infinite re-renders from unstable array identity
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, coacheeIdsKey, coachingRelationshipId, scope, assigneeFilter, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  return { actions, isLoading, isError, refresh };
}
