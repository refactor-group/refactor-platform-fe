// Relationship actions API — routes between two backend endpoints:
//   - Single relationship: GET /organizations/{org}/coaching_relationships/{rel}/actions
//   - Batch (all relationships): GET /organizations/{org}/coaching_relationships/actions?assignee=...

import { useEffect, useRef } from "react";
import { useSWRConfig, type SWRConfiguration } from "swr";
import { useApiSWR } from "@/lib/hooks/use-api-swr";
import { matchesEndpoint } from "@/lib/hooks/use-sse-cache-invalidation";
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

/** Builds the query string for relationship action endpoints. */
export function relationshipQueryString(params: RelationshipActionsParams): string {
  return buildQueryString({
    assignee: params.assignee,
    assignee_filter: params.assignee_filter,
    status: params.status,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  });
}

export function relationshipActionsUrl(orgId: Id, params: RelationshipActionsParams): string {
  const relId = params.coaching_relationship_id;
  const qs = relationshipQueryString(params);
  if (relId) {
    return `${ORGANIZATIONS_BASEURL}/${orgId}/${COACHING_RELATIONSHIPS_PATH}/${relId}/actions${qs}`;
  }
  return `${ORGANIZATIONS_BASEURL}/${orgId}/${COACHING_RELATIONSHIPS_PATH}/actions${qs}`;
}

/**
 * Forgets an organization's cached action lists once it's no longer current.
 * While away its lists have no subscribers, so action saves and SSE events
 * can't refresh them; forgetting makes a return fetch fresh instead of
 * showing a stale list.
 */
export function useForgetActionsOnOrganizationChange(currentOrganizationId: Id | null) {
  const { mutate } = useSWRConfig();
  const previous = useRef(currentOrganizationId);

  useEffect(() => {
    const left = previous.current;
    previous.current = currentOrganizationId;
    if (!left || left === currentOrganizationId) return;
    const leftBaseUrl = `${ORGANIZATIONS_BASEURL}/${left}/${COACHING_RELATIONSHIPS_PATH}`;
    // Writing undefined clears the data; `revalidate` also drops SWR's record
    // of the last request, which a return within the dedupe window would
    // otherwise reuse. With no subscribers nothing is fetched now.
    mutate(
      (key) => typeof key === "string" && matchesEndpoint(key, leftBaseUrl, "/actions"),
      undefined,
      { revalidate: true }
    );
  }, [currentOrganizationId, mutate]);
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
 * @param options SWR overrides, e.g. to turn off focus revalidation
 */
export function useBatchRelationshipActions(
  orgId: Id | null,
  params: RelationshipActionsParams,
  options?: SWRConfiguration<Action[]>
) {
  const url = orgId ? relationshipActionsUrl(orgId, params) : null;
  const isSingleRelationship = !!params.coaching_relationship_id;

  const { data, error, isLoading, mutate } = useApiSWR<Action[]>(
    url,
    // SWR only invokes the fetcher when key (url) is non-null
    () =>
      isSingleRelationship
        ? fetchSingleRelationshipActions(url!)
        : fetchBatchRelationshipActions(url!),
    { revalidateOnMount: true, shouldRetryOnError: false, ...options }
  );

  return {
    actions: data ?? [],
    isLoading,
    isError: !!error,
    refresh: mutate,
  };
}
