// Relationship actions API — routes between two backend endpoints:
//   - Single relationship: GET /organizations/{org}/coaching_relationships/{rel}/actions
//   - Batch (all relationships): GET /organizations/{org}/coaching_relationships/actions?assignee=...

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import {
  type Action,
  type ActionWithAssigneesWire,
  type BatchCoacheeActionsResponse,
  transformActionWithAssignees,
} from "@/types/action";
import {
  type AssigneeScope,
  UserActionsAssigneeFilter,
} from "@/types/assigned-actions";
import { ApiResponse } from "./entity-api";
import { buildQueryString } from "./query-params";
import { sessionGuard } from "@/lib/auth/session-guard";
import useSWR from "swr";

const ORGANIZATIONS_BASEURL = `${siteConfig.env.backendServiceURL}/organizations`;
const COACHING_RELATIONSHIPS_PATH = "coaching_relationships";

/** Query parameters for relationship actions endpoints. */
export interface RelationshipActionsParams {
  /** Scopes the batch endpoint by assignee role (coach, coachee, or a UUID). */
  assignee?: AssigneeScope | Id;
  coaching_relationship_id?: Id;
  assignee_filter?: UserActionsAssigneeFilter;
  status?: string;
  sort_by?: string;
  sort_order?: string;
}

/** Builds the query params shared by both endpoints (excludes `assignee`). */
function sharedQueryString(params: RelationshipActionsParams): string {
  return buildQueryString({
    assignee_filter: params.assignee_filter,
    status: params.status,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  });
}

/** Builds the batch endpoint query string, including the `assignee` param. */
function batchQueryString(params: RelationshipActionsParams): string {
  return buildQueryString({
    assignee: params.assignee,
    assignee_filter: params.assignee_filter,
    status: params.status,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  });
}

function relationshipActionsUrl(orgId: Id, params: RelationshipActionsParams): string {
  const relId = params.coaching_relationship_id;
  if (relId) {
    const qs = sharedQueryString(params);
    return `${ORGANIZATIONS_BASEURL}/${orgId}/${COACHING_RELATIONSHIPS_PATH}/${relId}/actions${qs}`;
  }
  const qs = batchQueryString(params);
  return `${ORGANIZATIONS_BASEURL}/${orgId}/${COACHING_RELATIONSHIPS_PATH}/actions${qs}`;
}

/** Fetches actions for a single relationship. Returns flat Action[]. */
async function fetchSingleRelationshipActions(url: string): Promise<Action[]> {
  const response =
    await sessionGuard.get<ApiResponse<ActionWithAssigneesWire[]>>(url);
  return response.data.data.map(transformActionWithAssignees);
}

/** Fetches actions for all relationships. Flattens grouped response into flat Action[]. */
async function fetchBatchRelationshipActions(url: string): Promise<Action[]> {
  const response =
    await sessionGuard.get<ApiResponse<BatchCoacheeActionsResponse>>(url);
  const grouped = response.data.data.coachee_actions;
  return Object.values(grouped).flat().map(transformActionWithAssignees);
}

/**
 * SWR hook that fetches relationship actions.
 *
 * Routes to the appropriate backend endpoint:
 * - When coaching_relationship_id is set: single-relationship endpoint
 * - Otherwise: batch endpoint returning actions for all relationships
 *
 * @param orgId Organization ID, or null to skip fetching
 * @param params Query parameters for filtering and sorting
 */
export function useBatchRelationshipActions(
  orgId: Id | null,
  params: RelationshipActionsParams
) {
  const url = orgId ? relationshipActionsUrl(orgId, params) : null;
  const isSingleRelationship = !!params.coaching_relationship_id;

  const { data, error, isLoading, mutate } = useSWR<Action[]>(
    url,
    // SWR only invokes the fetcher when key (url) is non-null
    () =>
      isSingleRelationship
        ? fetchSingleRelationshipActions(url!)
        : fetchBatchRelationshipActions(url!),
    { revalidateOnMount: true, shouldRetryOnError: false }
  );

  return {
    actions: data ?? [],
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}
