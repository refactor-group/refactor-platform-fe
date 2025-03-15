// Interacts with the overarching_goal endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import {
  OverarchingGoal,
  defaultOverarchingGoal,
} from "@/types/overarching-goal";
import { EntityApi } from "./entity-api";

const OVERARCHING_GOALS_BASEURL: string = `${siteConfig.env.backendServiceURL}/overarching_goals`;

/**
 * API client for overarching-goal-related operations.
 *
 * This object provides a collection of functions for interacting with the overarching-goal endpoints
 * on the backend service. It handles the HTTP requests and response parsing for all CRUD operations.
 */
export const OverarchingGoalApi = {
  /*
   * Fetches a list of overarching-goals associated with a specific user.
   *
   * @param userId The ID of the user whose overarching-goal should be retrieved
   * @returns Promise resolving to an array of OverarchingGoal objects
   */
  list: async (coachingSessionId: Id): Promise<OverarchingGoal[]> =>
    EntityApi.listFn<OverarchingGoal>(OVERARCHING_GOALS_BASEURL, {
      params: { coaching_session_id: coachingSessionId },
    }),

  /**
   * Fetches a single overarching-goal by its ID.
   *
   * @param id The ID of the overarching-goal to retrieve
   * @returns Promise resolving to the OverarchingGoal object
   */
  get: async (id: Id): Promise<OverarchingGoal> =>
    EntityApi.getFn<OverarchingGoal>(`${OVERARCHING_GOALS_BASEURL}/${id}`),

  /**
   * Creates a new overarching-goal.
   *
   * @param overarchingGoal The overarching-goal data to create
   * @returns Promise resolving to the created OverarchingGoal object
   */
  create: async (overarchingGoal: OverarchingGoal): Promise<OverarchingGoal> =>
    EntityApi.createFn<OverarchingGoal, OverarchingGoal>(
      OVERARCHING_GOALS_BASEURL,
      overarchingGoal
    ),

  createNested: async (
    _id: Id,
    _entity: OverarchingGoal
  ): Promise<OverarchingGoal> => {
    throw new Error("Create nested operation not implemented");
  },

  /**
   * Updates an existing overarching-goal.
   *
   * @param id The ID of the overarching-goal to update
   * @param overarchingGoal The updated overarching-goal data
   * @returns Promise resolving to the updated OverarchingGoal object
   */
  update: async (
    id: Id,
    overarchingGoal: OverarchingGoal
  ): Promise<OverarchingGoal> =>
    EntityApi.updateFn<OverarchingGoal, OverarchingGoal>(
      `${OVERARCHING_GOALS_BASEURL}/${id}`,
      overarchingGoal
    ),

  /**
   * Deletes an overarching-goal.
   *
   * @param id The ID of the overarching-goal to delete
   * @returns Promise resolving to the deleted OverarchingGoal object
   */
  delete: async (id: Id): Promise<OverarchingGoal> =>
    EntityApi.deleteFn<null, OverarchingGoal>(
      `${OVERARCHING_GOALS_BASEURL}/${id}`
    ),
};

/**
 * A custom React hook that fetches a list of overarching-goals for a specific user.
 *
 * This hook uses SWR to efficiently fetch, cache, and revalidate overarching-goal data.
 * It automatically refreshes data when the component mounts.
 *
 * @param coachingSessionId The ID of the coachingSessionId whose overarching-goals should be fetched
 * @returns An object containing:
 *
 * * overarchingGoals: Array of OverarchingGoal objects (empty array if data is not yet loaded)
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useOverarchingGoalList = (coachingSessionId: Id) => {
  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<OverarchingGoal>(
      OVERARCHING_GOALS_BASEURL,
      () => OverarchingGoalApi.list(coachingSessionId),
      coachingSessionId
    );

  return {
    overarchingGoals: entities,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * A custom React hook that fetches a single overarching-goal by its ID.
 * This hook uses SWR to efficiently fetch and cache overarching-goal data.
 * It does not automatically revalidate the data on window focus, reconnect, or when data becomes stale.
 *
 * @param id The ID of the overarching-goal to fetch. If null or undefined, no fetch will occur.
 * @returns An object containing:
 *
 * * overarchingGoal: The fetched OverarchingGoal object, or a default overarching-goal if not yet loaded
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useOverarchingGoal = (id: Id) => {
  const url = id ? `${OVERARCHING_GOALS_BASEURL}/${id}` : null;
  const fetcher = () => OverarchingGoalApi.get(id);

  const { entity, isLoading, isError, refresh } =
    EntityApi.useEntity<OverarchingGoal>(
      url,
      fetcher,
      defaultOverarchingGoal()
    );

  return {
    overarchingGoal: entity,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * A custom React hook that fetches a single overarching-goal by coaching session ID.
 * This hook uses SWR to efficiently fetch and cache overarching-goal data.
 * It does not automatically revalidate the data on window focus, reconnect, or when data becomes stale.
 *
 * @param coachingSessionId The coaching session ID of the overarching-goal to fetch. If null or undefined, no fetch will occur.
 * @returns An object containing:
 *
 * * overarchingGoal: The fetched OverarchingGoal object, or a default overarching-goal if not yet loaded
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useOverarchingGoalBySession = (coachingSessionId: Id) => {
  const { overarchingGoals, isLoading, isError, refresh } =
    useOverarchingGoalList(coachingSessionId);

  return {
    overarchingGoal: overarchingGoals.length
      ? overarchingGoals[0]
      : defaultOverarchingGoal(),
    isLoading,
    isError: isError,
    refresh,
  };
};

/**
 * A custom React hook that provides mutation operations for overarching-goals with loading and error state management.
 * This hook simplifies creating, updating, and deleting overarching-goals while handling loading states,
 * error management, and cache invalidation automatically.
 *
 * @returns An object containing:
 * create: Function to create a new overarching-goal
 * update: Function to update an existing overarching-goal
 * delete: Function to delete an overarching-goal
 * isLoading: Boolean indicating if any operation is in progress
 * error: Error object if the last operation failed, null otherwise
 */
/**
 * Hook for overarching-goal mutations.
 * Provides methods to create, update, and delete overarching-goal.
 */
export const useOverarchingGoalMutation = () => {
  return EntityApi.useEntityMutation<OverarchingGoal>(
    OVERARCHING_GOALS_BASEURL,
    {
      create: OverarchingGoalApi.create,
      createNested: OverarchingGoalApi.createNested,
      update: OverarchingGoalApi.update,
      delete: OverarchingGoalApi.delete,
    }
  );
};
