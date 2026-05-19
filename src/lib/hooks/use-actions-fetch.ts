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
import { type Option, Some, None, unwrapOr } from "@/types/option";

/**
 * Maps UI AssignmentFilter + Option<AssigneeScope> to wire params. None scope
 * omits `assignee` so the backend's visibility predicate handles narrowing.
 */
export function assignmentFilterToRelationshipActionsParams(
  filter: AssignmentFilter,
  assigneeScope: Option<AssigneeScope>
): {
  assignee?: AssigneeScope;
  assigneeFilter?: UserActionsAssigneeFilter;
} {
  const scope = unwrapOr(assigneeScope, undefined);
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

/** None = coachee broad view; lets the backend's visibility predicate narrow. */
function selectAssigneeScope(
  isACoach: boolean,
  isCoacheeMode: boolean
): Option<AssigneeScope> {
  if (isCoacheeMode) return Some(AssigneeScope.Coachee);
  if (isACoach) return Some(AssigneeScope.Coach);
  return None;
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
  const assigneeScope = selectAssigneeScope(isACoach, isCoacheeMode);

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
