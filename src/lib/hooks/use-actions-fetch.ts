import type { SWRConfiguration } from "swr";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import {
  useBatchRelationshipActions,
  useForgetActionsOnOrganizationChange,
} from "@/lib/api/relationship-actions";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import type { Action } from "@/types/action";
import {
  AssigneeScope,
  AssignmentFilter,
  CoachViewMode,
  UserActionsAssigneeFilter,
} from "@/types/assigned-actions";
import { RelationshipKind, seesAllActionsIn } from "@/types/coaching-relationship";
import type { Id } from "@/types/general";
import { type Option, Some, None, unwrapOr } from "@/types/option";

/**
 * Maps UI AssignmentFilter + Option<AssigneeScope> to wire params. None scope
 * omits `assignee` so the backend's visibility predicate handles narrowing.
 */
export function assignmentFilterToRelationshipActionsParams(
  filter: AssignmentFilter,
  assigneeScope: Option<AssigneeScope | Id>
): {
  assignee?: AssigneeScope | Id;
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

/**
 * None = the broad view; lets the backend's visibility predicate narrow.
 * My Actions is the user's own id whenever they can see others' actions (a coach or a
 * colleague), so the backend doesn't return those too. A colleague relationship has no
 * coachee side, so Coachee Actions filtered to one sends no scope.
 */
function selectAssigneeScope(
  userId: Id,
  seesOthersActions: boolean,
  isCoacheeMode: boolean,
  filteredToColleagues: boolean
): Option<AssigneeScope | Id> {
  if (isCoacheeMode) return filteredToColleagues ? None : Some(AssigneeScope.Coachee);
  if (seesOthersActions) return Some(userId);
  return None;
}

/**
 * Fetches actions via the batch relationship-actions endpoint.
 *
 * All views hit the same endpoint, differentiated by `assignee`:
 * - "My Actions" for a coach or colleague: assignee=<own user id>, across coaching and colleague relationships
 * - Coach "Coachee Actions" toggle: assignee=coachee (strict-contains)
 * - Coachee broad view: assignee omitted (backend visibility predicate returns
 *   self-assigned ∪ unassigned)
 *
 * The role comes from the current organization's relationships, and the fetch
 * waits for them, so the request (and its cache key) never flips scope while
 * they load or after an organization switch.
 *
 * @param viewMode - Whether to show the user's own actions or their coachees' actions
 * @param relationshipId - Optional server-side filter to a specific coaching relationship
 * @param assignmentFilter - Filter by assignment status (assigned/unassigned/all)
 * @param options - SWR overrides for the actions fetch
 */
export function useActionsFetch(
  viewMode: CoachViewMode,
  relationshipId?: Id,
  assignmentFilter: AssignmentFilter = AssignmentFilter.Assigned,
  options?: SWRConfiguration<Action[]>
) {
  const userId = useAuthStore((state) => state.userId);
  const { currentOrganizationId } = useCurrentOrganization();
  useForgetActionsOnOrganizationChange(currentOrganizationId);
  const {
    relationships,
    isLoading: relationshipsLoading,
    isError: relationshipsError,
  } = useCoachingRelationshipList(currentOrganizationId);
  const roleKnown = !!userId && !relationshipsLoading && !relationshipsError;

  const isCoacheeMode = viewMode === CoachViewMode.CoacheeActions;
  const filteredToColleagues = relationships.some(
    (r) => r.id === relationshipId && r.kind === RelationshipKind.Colleague
  );
  const assigneeScope = selectAssigneeScope(
    userId,
    relationships.some(seesAllActionsIn),
    isCoacheeMode,
    filteredToColleagues
  );

  // Scoped to the user's own id, All would match Assigned; it means theirs plus unassigned.
  const mineAndUnassigned =
    assignmentFilter === AssignmentFilter.All && assigneeScope.some && assigneeScope.val === userId;
  const params = assignmentFilterToRelationshipActionsParams(
    mineAndUnassigned ? AssignmentFilter.Assigned : assignmentFilter,
    assigneeScope
  );
  const orgId = roleKnown ? currentOrganizationId : null;

  const main = useBatchRelationshipActions(
    orgId,
    {
      assignee: params.assignee,
      assignee_filter: params.assigneeFilter,
      coaching_relationship_id: relationshipId,
    },
    options
  );
  const unassigned = useBatchRelationshipActions(
    mineAndUnassigned ? orgId : null,
    { assignee_filter: UserActionsAssigneeFilter.Unassigned, coaching_relationship_id: relationshipId },
    options
  );

  return {
    actions: mineAndUnassigned ? [...main.actions, ...unassigned.actions] : main.actions,
    isLoading: relationshipsLoading || main.isLoading || (mineAndUnassigned && unassigned.isLoading),
    isError: !!relationshipsError || main.isError || (mineAndUnassigned && unassigned.isError),
    refresh: () => Promise.all([main.refresh(), mineAndUnassigned ? unassigned.refresh() : undefined]),
  };
}
