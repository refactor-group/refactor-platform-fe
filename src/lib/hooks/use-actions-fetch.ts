import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useBatchRelationshipActions } from "@/lib/api/relationship-actions";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import {
  AssigneeScope,
  AssignmentFilter,
  CoachViewMode,
  UserActionsAssigneeFilter,
} from "@/types/assigned-actions";
import type { Id } from "@/types/general";

/**
 * Maps a UI-level AssignmentFilter to the relationship-actions API params
 * (assignee + assignee_filter).
 *
 * The `assigneeScope` determines whose actions are returned (coach or coachee),
 * while `assignee_filter` controls assigned/unassigned filtering.
 *
 * Used by both "My Actions" (with coach or coachee scope depending on role)
 * and "Coachee Actions" (always coachee scope).
 */
export function assignmentFilterToRelationshipActionsParams(
  filter: AssignmentFilter,
  assigneeScope: AssigneeScope
): {
  assignee?: AssigneeScope;
  assigneeFilter?: UserActionsAssigneeFilter;
} {
  switch (filter) {
    case AssignmentFilter.Assigned:
      return {
        assignee: assigneeScope,
        assigneeFilter: UserActionsAssigneeFilter.Assigned,
      };
    case AssignmentFilter.Unassigned:
      return {
        assigneeFilter: UserActionsAssigneeFilter.Unassigned,
      };
    case AssignmentFilter.All:
      return { assignee: assigneeScope };
    default: {
      const _exhaustive: never = filter;
      throw new Error(`Unhandled assignment filter: ${_exhaustive}`);
    }
  }
}

/**
 * Fetches actions via the batch relationship-actions endpoint.
 *
 * Both "My Actions" and "Coachee Actions" use the same endpoint, differentiated
 * by the `assignee` query param:
 * - My Actions (coach user): assignee=coach
 * - My Actions (coachee-only user): assignee=coachee
 * - Coachee Actions: assignee=coachee
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
  const { isACoach } = useAuthStore((state) => ({
    isACoach: state.isACoach,
  }));
  const { currentOrganizationId } = useCurrentOrganization();

  const isCoacheeMode = viewMode === CoachViewMode.CoacheeActions;

  const assigneeScope: AssigneeScope =
    isCoacheeMode
      ? AssigneeScope.Coachee
      : isACoach
        ? AssigneeScope.Coach
        : AssigneeScope.Coachee;

  const params = assignmentFilterToRelationshipActionsParams(assignmentFilter, assigneeScope);

  const { actions, isLoading, isError, refresh } = useBatchRelationshipActions(
    currentOrganizationId,
    {
      assignee: params.assignee,
      assignee_filter: params.assigneeFilter,
      coaching_relationship_id: relationshipId,
    }
  );

  return { actions, isLoading, isError, refresh };
}
