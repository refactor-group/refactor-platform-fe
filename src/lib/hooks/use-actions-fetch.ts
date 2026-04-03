import { useMemo } from "react";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUserActionsList } from "@/lib/api/user-actions";
import { useBatchRelationshipActions } from "@/lib/api/relationship-actions";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import {
  AssigneeScope,
  AssignmentFilter,
  CoachViewMode,
  UserActionsAssigneeFilter,
  UserActionsScope,
} from "@/types/assigned-actions";
import type { Action } from "@/types/action";
import type { Id } from "@/types/general";

/**
 * Maps a UI-level AssignmentFilter to the user-actions API params
 * (scope + assignee_filter) used by the "My Actions" path.
 *
 * - Assigned: scope=assigned (backend handles filtering to assigned user)
 * - Unassigned: scope=sessions + assignee_filter=unassigned
 * - All: scope=sessions (returns both assigned and unassigned)
 */
export function assignmentFilterToUserActionsParams(filter: AssignmentFilter): {
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
 * Maps a UI-level AssignmentFilter to the batch relationship-actions API params
 * (assignee + assignee_filter) used by the "Coachee Actions" path.
 *
 * The `assignee` param scopes by role (coachee/coach) while `assignee_filter`
 * controls assigned/unassigned filtering.
 */
export function assignmentFilterToRelationshipActionsParams(filter: AssignmentFilter): {
  assignee?: AssigneeScope;
  assigneeFilter?: UserActionsAssigneeFilter;
} {
  switch (filter) {
    case AssignmentFilter.Assigned:
      return {
        assignee: AssigneeScope.Coachee,
        assigneeFilter: UserActionsAssigneeFilter.Assigned,
      };
    case AssignmentFilter.Unassigned:
      return {
        assigneeFilter: UserActionsAssigneeFilter.Unassigned,
      };
    case AssignmentFilter.All:
      return { assignee: AssigneeScope.Coachee };
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
 * In "Coachee Actions" mode, fetches actions for all coachees via a single batch request.
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

  const userActionsParams = assignmentFilterToUserActionsParams(assignmentFilter);
  const relationshipActionsParams = assignmentFilterToRelationshipActionsParams(assignmentFilter);

  // --- User Actions path ---

  const {
    actions: userActions,
    isLoading: userActionsLoading,
    isError: userActionsError,
    refresh: refreshUserActions,
  } = useUserActionsList(
    !isCoacheeMode ? userId : null,
    {
      scope: userActionsParams.scope,
      coaching_relationship_id: relationshipId,
      assignee_filter: userActionsParams.assigneeFilter,
    }
  );

  // --- Relationship Actions path (single batch request) ---

  const {
    actions: relationshipActions,
    isLoading: relationshipActionsLoading,
    isError: relationshipActionsError,
    refresh: refreshRelationshipActions,
  } = useBatchRelationshipActions(
    isCoacheeMode ? currentOrganizationId : null,
    {
      assignee: relationshipActionsParams.assignee,
      assignee_filter: relationshipActionsParams.assigneeFilter,
      coaching_relationship_id: relationshipId,
    }
  );

  // --- Combine based on mode ---

  const actions: Action[] = useMemo(
    () => (isCoacheeMode ? relationshipActions : (userActions ?? [])),
    [isCoacheeMode, relationshipActions, userActions]
  );

  const isLoading = isCoacheeMode
    ? relationshipActionsLoading
    : userActionsLoading;

  const isError = isCoacheeMode ? relationshipActionsError : userActionsError;
  const refresh = isCoacheeMode ? refreshRelationshipActions : refreshUserActions;

  return { actions, isLoading, isError, refresh };
}
