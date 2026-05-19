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
import { type Option, Some, None } from "@/types/option";

/**
 * Maps a UI-level AssignmentFilter to the relationship-actions API params
 * (assignee + assignee_filter).
 *
 * `assigneeScope` is the strict-contains scope (Some(coach) / Some(coachee) /
 * Some(UUID)) or None for "no scope filter." When None, the backend applies
 * a role-aware visibility predicate to narrow the result instead of
 * strict-contains; this is the right shape for a coachee asking for their
 * own broad view (self-assigned ∪ unassigned).
 *
 * `assignee_filter` controls assigned/unassigned filtering and is independent
 * of scope.
 */
export function assignmentFilterToRelationshipActionsParams(
  filter: AssignmentFilter,
  assigneeScope: Option<AssigneeScope>
): {
  assignee?: AssigneeScope;
  assigneeFilter?: UserActionsAssigneeFilter;
} {
  const scope = assigneeScope.some ? assigneeScope.val : undefined;
  switch (filter) {
    case AssignmentFilter.Assigned:
      return {
        assignee: scope,
        assigneeFilter: UserActionsAssigneeFilter.Assigned,
      };
    case AssignmentFilter.Unassigned:
      return {
        assigneeFilter: UserActionsAssigneeFilter.Unassigned,
      };
    case AssignmentFilter.All:
      return { assignee: scope };
    default: {
      const _exhaustive: never = filter;
      throw new Error(`Unhandled assignment filter: ${_exhaustive}`);
    }
  }
}

/**
 * Fetches actions via the batch relationship-actions endpoint.
 *
 * All views hit the same endpoint, differentiated by `assignee`:
 * - Coach "My Actions" toggle: assignee=coach (strict-contains)
 * - Coach "Coachee Actions" toggle: assignee=coachee (strict-contains)
 * - Coachee broad view: assignee omitted (backend visibility predicate returns
 *   self-assigned ∪ unassigned)
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

  // None for the coachee's own broad view: the backend's visibility predicate
  // returns self-assigned ∪ unassigned. Sending Some(Coachee) instead would
  // strict-contains-filter and silently drop unassigned actions.
  const assigneeScope: Option<AssigneeScope> =
    isCoacheeMode
      ? Some(AssigneeScope.Coachee)
      : isACoach
        ? Some(AssigneeScope.Coach)
        : None;

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
