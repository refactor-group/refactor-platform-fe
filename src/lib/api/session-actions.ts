// Interacts with the session-actions endpoint
// Returns all actions from a user's coaching sessions (where user is coach or coachee)

import useSWR from "swr";
import { siteConfig } from "@/site.config";
import { Id, transformEntityDates } from "@/types/general";
import type { Action } from "@/types/action";
import { sessionGuard } from "@/lib/auth/session-guard";

const USERS_BASEURL: string = `${siteConfig.env.backendServiceURL}/users`;

/**
 * Filter options for session actions endpoint
 */
export type SessionActionsFilter = "assigned" | "unassigned" | undefined;

/**
 * API client for session-actions operations.
 */
export const SessionActionsApi = {
  /**
   * Fetches all actions from a user's coaching sessions.
   *
   * @param userId The ID of the user whose session actions should be retrieved
   * @param filter Optional filter: "assigned", "unassigned", or undefined for all
   * @returns Promise resolving to an array of Action objects
   */
  list: async (userId: Id, filter?: SessionActionsFilter): Promise<Action[]> => {
    const params = new URLSearchParams();
    if (filter) {
      params.set("filter", filter);
    }

    const queryString = params.toString();
    const url = `${USERS_BASEURL}/${userId}/session-actions${queryString ? `?${queryString}` : ""}`;

    const response = await sessionGuard.get<{ data: Action[] }>(url);
    const actions = response.data.data;

    // Transform date fields
    return actions.map((action: Action) => transformEntityDates(action));
  },
};

/**
 * A custom React hook that fetches all actions from a user's coaching sessions.
 *
 * @param userId The ID of the user whose session actions should be fetched.
 *               If null, no fetch will occur.
 * @param filter Optional filter: "assigned", "unassigned", or undefined for all
 * @returns An object containing:
 *   - actions: Array of Action objects (empty array if data is not yet loaded)
 *   - isLoading: Boolean indicating if the data is currently being fetched
 *   - isError: Boolean indicating if the fetch operation failed
 *   - refresh: Function to manually trigger a refresh of the data
 */
export const useSessionActionsList = (
  userId: Id | null,
  filter?: SessionActionsFilter
) => {
  const cacheKey = userId
    ? `${USERS_BASEURL}/${userId}/session-actions${filter ? `?filter=${filter}` : ""}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<Action[]>(
    cacheKey,
    () => (userId ? SessionActionsApi.list(userId, filter) : Promise.resolve([])),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    actions: data ?? [],
    isLoading,
    isError: !!error,
    refresh: () => mutate(),
  };
};
