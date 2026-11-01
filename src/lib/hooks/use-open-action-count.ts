import { visibleStatuses } from "@/components/ui/actions/utils";
import { useActionsFetch } from "@/lib/hooks/use-actions-fetch";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import type { Action } from "@/types/action";
import {
  AssignmentFilter,
  CoachViewMode,
  StatusVisibility,
} from "@/types/assigned-actions";
import { type Option, Some, None } from "@/types/option";

const OPEN_STATUSES = new Set(visibleStatuses(StatusVisibility.Open));

export function countOpenActions(actions: Action[]): number {
  return actions.filter((action) => OPEN_STATUSES.has(action.status)).length;
}

/** Open actions assigned to the current user in the current organization; None until known. */
export function useOpenActionCount(): Option<number> {
  const { currentOrganizationId } = useCurrentOrganization();
  // Same arguments as the Actions page's default view, so both share one SWR cache entry.
  const { actions, isLoading, isError } = useActionsFetch(
    CoachViewMode.MyActions,
    undefined,
    AssignmentFilter.Assigned
  );

  if (!currentOrganizationId || isLoading || isError) return None;
  return Some(countOpenActions(actions));
}
