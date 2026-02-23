import { useMemo } from "react";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useActionsFetch } from "@/lib/hooks/use-actions-fetch";
import { useSessionContextFetch } from "@/lib/hooks/use-session-context-fetch";
import { CoachViewMode } from "@/types/assigned-actions";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import type { Id } from "@/types/general";
import { addContextToActions } from "@/lib/utils/assigned-actions";

/**
 * Fetches and enriches all actions for the current user (or their coachees).
 *
 * Unlike useAssignedActions, this hook skips filterActionsByStatus and
 * groupActionsByRelationship — the kanban board groups by status column
 * and applies its own client-side filters.
 *
 * @param viewMode - Whether to show the user's own actions or their coachees' actions
 * @param relationshipId - Optional filter to a specific coaching relationship (server-side)
 */
export function useAllActionsWithContext(
  viewMode: CoachViewMode,
  relationshipId?: Id
) {
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const userId = userSession?.id ?? null;

  const {
    actions,
    isLoading: actionsLoading,
    isError: actionsError,
    refresh,
  } = useActionsFetch(viewMode, relationshipId);

  const {
    lookupMaps,
    isLoading: sessionsLoading,
    isError: sessionsError,
  } = useSessionContextFetch(userId);

  const actionsWithContext: AssignedActionWithContext[] = useMemo(
    () =>
      addContextToActions(
        actions,
        lookupMaps.sessionMap,
        lookupMaps.nextSessionByRelationship
      ),
    [actions, lookupMaps]
  );

  const isLoading = !userId || actionsLoading || sessionsLoading;
  const isError = actionsError || sessionsError;

  return {
    actionsWithContext,
    isLoading,
    isError,
    refresh,
  };
}
