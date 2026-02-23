import { useMemo } from "react";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUserActionsList } from "@/lib/api/user-actions";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoacheeActionsFetch } from "@/lib/hooks/use-coachee-actions-fetch";
import {
  CoachViewMode,
  UserActionsScope,
} from "@/types/assigned-actions";
import type { Action } from "@/types/action";
import type { Id } from "@/types/general";
import { getRelationshipsAsCoach } from "@/types/coaching-relationship";

/**
 * Fetches actions based on the current view mode.
 *
 * In "My Actions" mode, fetches actions assigned to the current user.
 * In "Coachee Actions" mode, fetches actions for all coachees in parallel.
 *
 * @param viewMode - Whether to show the user's own actions or their coachees' actions
 * @param relationshipId - Optional server-side filter to a specific coaching relationship
 */
export function useActionsFetch(
  viewMode: CoachViewMode,
  relationshipId?: Id
) {
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const userId = userSession?.id ?? null;
  const { currentOrganizationId } = useCurrentOrganization();

  const isCoacheeMode = viewMode === CoachViewMode.CoacheeActions;

  // --- My Actions path ---

  const {
    actions: myActions,
    isLoading: myActionsLoading,
    isError: myActionsError,
    refresh: refreshMyActions,
  } = useUserActionsList(
    !isCoacheeMode ? userId : null,
    {
      scope: UserActionsScope.Assigned,
      coaching_relationship_id: relationshipId,
    }
  );

  // --- Coachee Actions path ---

  const { relationships, isLoading: relsLoading } =
    useCoachingRelationshipList(
      isCoacheeMode ? currentOrganizationId : null
    );

  const coacheeIds = useMemo(() => {
    if (!isCoacheeMode || !userId || !relationships) return [];
    return getRelationshipsAsCoach(userId, relationships).map(
      (r) => r.coachee_id
    );
  }, [isCoacheeMode, userId, relationships]);

  const {
    actions: coacheeActions,
    isLoading: coacheeActionsLoading,
    isError: coacheeActionsError,
    refresh: refreshCoacheeActions,
  } = useCoacheeActionsFetch(coacheeIds, isCoacheeMode, relationshipId);

  // --- Combine based on mode ---

  const actions: Action[] = useMemo(
    () => (isCoacheeMode ? coacheeActions : (myActions ?? [])),
    [isCoacheeMode, coacheeActions, myActions]
  );

  const isLoading = isCoacheeMode
    ? relsLoading || coacheeActionsLoading
    : myActionsLoading;

  const isError = isCoacheeMode ? coacheeActionsError : myActionsError;
  const refresh = isCoacheeMode ? refreshCoacheeActions : refreshMyActions;

  return { actions, isLoading, isError, refresh };
}
