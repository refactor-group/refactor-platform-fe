// Unified API for fetching actions for a user
// Replaces: assigned-actions.ts, session-actions.ts, and list functions from actions.ts

import { siteConfig } from "@/site.config";
import { Id, ItemStatus, transformEntityDates } from "@/types/general";
import type { Action } from "@/types/action";
import { ApiSortOrder, ActionSortField } from "@/types/sorting";
import {
  UserActionsScope,
  UserActionsAssigneeFilter,
} from "@/types/assigned-actions";
import { EntityApi } from "./entity-api";

const USERS_BASEURL: string = `${siteConfig.env.backendServiceURL}/users`;

/**
 * Query parameters for the unified user actions endpoint.
 */
export interface UserActionsQueryParams {
  /** Scope of actions to fetch (default: Session) */
  scope?: UserActionsScope;
  /** Filter to a specific coaching session */
  coaching_session_id?: Id;
  /** Filter by assignee status */
  assignee_filter?: UserActionsAssigneeFilter;
  /** Filter by action status */
  status?: ItemStatus;
  /** Field to sort by */
  sort_by?: ActionSortField;
  /** Sort direction */
  sort_order?: ApiSortOrder;
}

/**
 * Builds URL search params from query parameters, excluding undefined values.
 */
function buildQueryString(params?: UserActionsQueryParams): string {
  if (!params) return "";

  const searchParams = new URLSearchParams();

  if (params.scope) {
    searchParams.set("scope", params.scope);
  }
  if (params.coaching_session_id) {
    searchParams.set("coaching_session_id", params.coaching_session_id);
  }
  if (params.assignee_filter) {
    searchParams.set("assignee_filter", params.assignee_filter);
  }
  if (params.status) {
    searchParams.set("status", params.status);
  }
  if (params.sort_by) {
    searchParams.set("sort_by", params.sort_by);
  }
  if (params.sort_order) {
    searchParams.set("sort_order", params.sort_order);
  }

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : "";
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
    const queryString = buildQueryString(params);

    return EntityApi.listNestedFn<Action, Action>(
      USERS_BASEURL,
      userId,
      `actions${queryString}`,
      { params: {} },
      transformEntityDates
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
  const queryString = buildQueryString(params);
  const url = userId ? `${USERS_BASEURL}/${userId}/actions${queryString}` : null;

  const { entities, isLoading, isError, refresh } = EntityApi.useEntityList<
    Action,
    Action
  >(
    url ?? "",
    () => (userId ? UserActionsApi.list(userId, params) : Promise.resolve([])),
    transformEntityDates,
    userId ? { user_id: userId, ...params } : null
  );

  return {
    actions: entities,
    isLoading,
    isError,
    refresh,
  };
};
