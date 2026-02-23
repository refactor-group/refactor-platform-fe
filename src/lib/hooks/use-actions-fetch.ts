import { useMemo } from "react";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUserActionsList } from "@/lib/api/user-actions";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoacheeActionsFetch } from "@/lib/hooks/use-coachee-actions-fetch";
import {
  AssignmentFilter,
  CoachViewMode,
  UserActionsAssigneeFilter,
  UserActionsScope,
} from "@/types/assigned-actions";
import type { Action } from "@/types/action";
import type { Id } from "@/types/general";
import { getRelationshipsAsCoach } from "@/types/coaching-relationship";

/**
 * Maps a UI-level AssignmentFilter to the API params (scope + assignee_filter).
 *
 * - Assigned: scope=assigned (backend handles filtering to assigned user)
 * - Unassigned: scope=sessions + assignee_filter=unassigned
 * - All: scope=sessions (returns both assigned and unassigned)
 */
export function assignmentFilterToApiParams(filter: AssignmentFilter): {
  scope: UserActionsScope;
  assigneeFilter?: UserActionsAssigneeFilter;
} {
  switch (filter) {
    case AssignmentFilter.Assigned:
      return { scope: UserActionsScope.Assigned };
    case AssignmentFilter.Unassigned:
      return {
        scope: UserActionsScope.Sessions,
        assigneeFilter: UserActionsAssigneeFilter.Unassigned,
      };
    case AssignmentFilter.All:
      return { scope: UserActionsScope.Sessions };
    default: {
      const _exhaustive: never = filter;
      throw new Error(`Unhandled assignment filter: ${_exhaustive}`);
    }
  }
}

/**
 * Fetches actions based on the current view mode and assignment filter.
 *
 * In "My Actions" mode, fetches actions for the current user.
 * In "Coachee Actions" mode, fetches actions for all coachees in parallel.
 *
 * @param viewMode - Whether to show the user's own actions or their coachees' actions
 * @param relationshipId - Optional server-side filter to a specific coaching relationship
 * @param assignmentFilter - Filter by assignment status (assigned/unassigned/all)
 */
export function useActionsFetch(
  viewMode: CoachViewMode,
  relationshipId?: Id,
  assignmentFilter: AssignmentFilter = AssignmentFilter.Assigned
) {
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const userId = userSession?.id ?? null;
  const { currentOrganizationId } = useCurrentOrganization();

  const isCoacheeMode = viewMode === CoachViewMode.CoacheeActions;
  const { scope, assigneeFilter } = assignmentFilterToApiParams(assignmentFilter);

  // --- My Actions path ---

  const {
    actions: myActions,
    isLoading: myActionsLoading,
    isError: myActionsError,
    refresh: refreshMyActions,
  } = useUserActionsList(
    !isCoacheeMode ? userId : null,
    {
      scope,
      coaching_relationship_id: relationshipId,
      assignee_filter: assigneeFilter,
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
  } = useCoacheeActionsFetch(coacheeIds, isCoacheeMode, relationshipId, scope, assigneeFilter);

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
