import { visibleStatuses } from "@/components/ui/actions/utils";
import { useBatchRelationshipActions } from "@/lib/api/relationship-actions";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import type { Action } from "@/types/action";
import { StatusVisibility, UserActionsAssigneeFilter } from "@/types/assigned-actions";

const OPEN_STATUSES = new Set(visibleStatuses(StatusVisibility.Open));

export function countOpenActions(actions: Action[]): number {
  return actions.filter((action) => OPEN_STATUSES.has(action.status)).length;
}

/**
 * Open actions assigned to the current user in the current organization, in
 * every relationship whatever their role; 0 until known. Action saves and SSE
 * events revalidate it, so it skips focus revalidation.
 */
export function useOpenActionCount(): number {
  const userId = useAuthStore((state) => state.userId);
  const { currentOrganizationId } = useCurrentOrganization();
  const { actions, isError } = useBatchRelationshipActions(
    userId ? currentOrganizationId : null,
    { assignee: userId, assignee_filter: UserActionsAssigneeFilter.Assigned },
    { revalidateOnFocus: false }
  );

  // actions is [] while loading
  return isError ? 0 : countOpenActions(actions);
}
