// Unified API for fetching actions for a user
// Replaces: list functions from actions.ts

import { siteConfig } from "@/site.config";
import { Id, ItemStatus } from "@/types/general";
import { transformAction, type Action } from "@/types/action";
import { ApiSortOrder, ActionSortField } from "@/types/sorting";
import {
  UserActionsScope,
  UserActionsAssigneeFilter,
} from "@/types/assigned-actions";
import { EntityApi } from "./entity-api";
import { buildQueryString } from "./query-params";

const USERS_BASEURL: string = `${siteConfig.env.backendServiceURL}/users`;

/**
 * Query parameters for the unified user actions endpoint.
 */
export interface UserActionsQueryParams {
  /** Scope of actions to fetch (default: Session) */
  scope?: UserActionsScope;
  /** Filter to a specific coaching session */
  coaching_session_id?: Id;
  /** Filter to actions from sessions belonging to a specific coaching relationship */
  coaching_relationship_id?: Id;
  /** Filter by assignee status */
  assignee_filter?: UserActionsAssigneeFilter;
  /** Filter by action status */
  status?: ItemStatus;
  /** Field to sort by */
  sort_by?: ActionSortField;
  /** Sort direction */
  sort_order?: ApiSortOrder;
}

function userActionsQueryString(params?: UserActionsQueryParams): string {
  if (!params) return "";
  return buildQueryString({
    scope: params.scope,
    coaching_session_id: params.coaching_session_id,
    coaching_relationship_id: params.coaching_relationship_id,
    assignee_filter: params.assignee_filter,
    status: params.status,
    sort_by: params.sort_by,
    sort_order: params.sort_order,
  });
}

/**
 * API client for the unified user actions endpoint.
 *
 * This endpoint consolidates:
 * - GET /users/{id}/assigned-actions
 * - GET /users/{id}/session-actions
 * - GET /actions?coaching_session_id=...
 *
 * Into a single endpoint: GET /users/{user_id}/actions
 *
 * Supports filtering by session, coaching relationship, assignee status,
 * action status, and sort options via {@link UserActionsQueryParams}.
 */
export const UserActionsApi = {
  /**
   * Fetches actions for a specific user with optional filtering.
   *
   * @param userId The ID of the user whose actions should be retrieved
   * @param params Optional query parameters for filtering and sorting
   * @returns Promise resolving to an array of Action objects
   */
  list: async (
    userId: Id,
    params?: UserActionsQueryParams
  ): Promise<Action[]> => {
    const queryString = userActionsQueryString(params);

    return EntityApi.listNestedFn<Action, Action>(
      USERS_BASEURL,
      userId,
      `actions${queryString}`,
      { params: {} },
      transformAction
    );
  },
};

/**
 * A custom React hook that fetches actions for a specific user.
 *
 * This hook uses SWR to efficiently fetch, cache, and revalidate action data.
 * It supports various filtering options through query parameters.
 *
 * @param userId The ID of the user whose actions should be fetched.
 *               If null, no fetch will occur.
 * @param params Optional query parameters for filtering and sorting
 * @returns An object containing:
 *   - actions: Array of Action objects (empty array if data is not yet loaded)
 *   - isLoading: Boolean indicating if the data is currently being fetched
 *   - isError: Error object if the fetch operation failed, undefined otherwise
 *   - refresh: Function to manually trigger a refresh of the data
 */
export const useUserActionsList = (
  userId: Id | null,
  params?: UserActionsQueryParams
) => {
  const queryString = userActionsQueryString(params);
  const url = userId ? `${USERS_BASEURL}/${userId}/actions${queryString}` : null;

  const { entities, isLoading, isError, refresh } = EntityApi.useEntityList<
    Action
  >(
    url ?? "",
    () => (userId ? UserActionsApi.list(userId, params) : Promise.resolve([])),
    userId ? { user_id: userId, ...params } : null
  );

  return {
    actions: entities,
    isLoading,
    isError,
    refresh,
  };
};
