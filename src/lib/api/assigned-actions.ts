// Interacts with the assigned-actions endpoint for fetching actions assigned to a user

import { siteConfig } from "@/site.config";
import { Id, transformEntityDates } from "@/types/general";
import type { Action } from "@/types/action";
import { EntityApi } from "./entity-api";

const USERS_BASEURL: string = `${siteConfig.env.backendServiceURL}/users`;

/**
 * API client for fetching actions assigned to a specific user.
 *
 * This endpoint returns all actions where the user is listed in assignee_ids,
 * across all coaching sessions and relationships.
 */
export const AssignedActionsApi = {
  /**
   * Fetches all actions assigned to a specific user.
   *
   * @param userId The ID of the user whose assigned actions should be retrieved
   * @returns Promise resolving to an array of Action objects
   */
  list: async (userId: Id): Promise<Action[]> => {
    return EntityApi.listNestedFn<Action>(
      USERS_BASEURL,
      userId,
      "assigned-actions",
      { params: {} }
    );
  },
};

/**
 * A custom React hook that fetches all actions assigned to a specific user.
 *
 * This hook uses SWR to efficiently fetch, cache, and revalidate action data.
 * It returns actions from all coaching sessions where the user is an assignee.
 *
 * @param userId The ID of the user whose assigned actions should be fetched.
 *               If null, no fetch will occur.
 * @returns An object containing:
 *   - actions: Array of Action objects (empty array if data is not yet loaded)
 *   - isLoading: Boolean indicating if the data is currently being fetched
 *   - isError: Error object if the fetch operation failed, undefined otherwise
 *   - refresh: Function to manually trigger a refresh of the data
 */
export const useAssignedActionsList = (userId: Id | null) => {
  const url = userId ? `${USERS_BASEURL}/${userId}/assigned-actions` : null;

  const { entities, isLoading, isError, refresh } = EntityApi.useEntityList<
    Action,
    Action
  >(
    url ?? "",
    () => (userId ? AssignedActionsApi.list(userId) : Promise.resolve([])),
    transformEntityDates,
    userId ? { user_id: userId } : null
  );

  return {
    actions: entities,
    isLoading,
    isError,
    refresh,
  };
};
