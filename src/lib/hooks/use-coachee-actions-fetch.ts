import { useMemo, useCallback } from "react";
import { EntityApi } from "@/lib/api/entity-api";
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
 * Uses EntityApi.useEntityList with a synthetic key and composite params
 * for SWR-managed caching, auto-revalidation, and request deduplication.
 * A stable string key derived from coacheeIds avoids infinite re-render
 * loops from unstable array identity changes.
 */
export function useCoacheeActionsFetch(
  coacheeIds: string[],
  enabled: boolean,
  coachingRelationshipId?: string,
  scope: UserActionsScope = UserActionsScope.Assigned,
  assigneeFilter?: UserActionsAssigneeFilter
): CoacheeActionsFetchResult {
  // Stable key to avoid refetching when array reference changes
  const coacheeIdsKey = useMemo(() => coacheeIds.join(","), [coacheeIds]);

  // EntityApi.useEntityList disables fetching when params is falsy (null).
  // When enabled, the composite params object acts as the SWR cache key —
  // any filter change invalidates the cache and triggers a fresh fetch.
  const params =
    enabled && coacheeIds.length > 0
      ? { coacheeIdsKey, scope, assigneeFilter, coachingRelationshipId }
      : null;

  const fetcher = useCallback(async (): Promise<Action[]> => {
    const results = await Promise.all(
      coacheeIds.map((id) =>
        UserActionsApi.list(id, {
          scope,
          coaching_relationship_id: coachingRelationshipId,
          assignee_filter: assigneeFilter,
        })
      )
    );
    return results.flat();
  }, [coacheeIds, scope, coachingRelationshipId, assigneeFilter]);

  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<Action>("coachee-actions", fetcher, params);

  return {
    actions: entities,
    isLoading,
    isError: !!isError,
    refresh: useCallback(() => { refresh(); }, [refresh]),
  };
}
