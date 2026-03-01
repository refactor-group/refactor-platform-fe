// Interacts with the goal endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import {
  Goal,
  defaultGoal,
} from "@/types/goal";
import { ApiSortOrder, GoalSortField } from "@/types/sorting";
import { EntityApi } from "./entity-api";

const GOALS_BASEURL: string = `${siteConfig.env.backendServiceURL}/goals`;

/**
 * API client for goal-related operations.
 *
 * This object provides a collection of functions for interacting with the goal endpoints
 * on the backend service. It handles the HTTP requests and response parsing for all CRUD operations.
 */
export const GoalApi = {
  /*
   * Fetches a list of goals associated with a specific coaching session.
   *
   * @param coachingSessionId The ID of the coaching session whose goals should be retrieved
   * @param sortBy Optional field to sort by.
   * @param sortOrder Optional sort order.
   * @returns Promise resolving to an array of Goal objects
   */
  list: async (
    coachingSessionId: Id,
    sortBy?: GoalSortField,
    sortOrder?: ApiSortOrder
  ): Promise<Goal[]> => {
    const params: Record<string, string> = {
      coaching_session_id: coachingSessionId,
    };

    if (sortBy) {
      params.sort_by = sortBy;
    }
    if (sortOrder) {
      params.sort_order = sortOrder;
    }

    return EntityApi.listFn<Goal>(GOALS_BASEURL, { params });
  },

  /**
   * Fetches a single goal by its ID.
   *
   * @param id The ID of the goal to retrieve
   * @returns Promise resolving to the Goal object
   */
  get: async (id: Id): Promise<Goal> =>
    EntityApi.getFn<Goal>(`${GOALS_BASEURL}/${id}`),

  /**
   * Creates a new goal.
   *
   * @param goal The goal data to create
   * @returns Promise resolving to the created Goal object
   */
  create: async (goal: Goal): Promise<Goal> =>
    EntityApi.createFn<Goal, Goal>(
      GOALS_BASEURL,
      goal
    ),

  createNested: async (
    _id: Id,
    _entity: Goal
  ): Promise<Goal> => {
    throw new Error("Create nested operation not implemented");
  },

  /**
   * Updates an existing goal.
   *
   * @param id The ID of the goal to update
   * @param goal The updated goal data
   * @returns Promise resolving to the updated Goal object
   */
  update: async (
    id: Id,
    goal: Goal
  ): Promise<Goal> =>
    EntityApi.updateFn<Goal, Goal>(
      `${GOALS_BASEURL}/${id}`,
      goal
    ),

  /**
   * Deletes a goal.
   *
   * @param id The ID of the goal to delete
   * @returns Promise resolving to the deleted Goal object
   */
  delete: async (id: Id): Promise<Goal> =>
    EntityApi.deleteFn<null, Goal>(
      `${GOALS_BASEURL}/${id}`
    ),

  /**
   * Deletes a goal nested under another entity (foreign key relationship).
   *
   * @param entityId The ID of the entity under which to delete the goal
   * @param goalId The ID of the goal to delete
   * @returns Promise resolving to the deleted Goal object
   */
  deleteNested: async (
    _entityId: Id,
    _goalId: Id
  ): Promise<Goal> => {
    throw new Error("Delete nested operation not implemented");
  },
};

/**
 * A custom React hook that fetches a list of goals for a specific coaching session.
 *
 * This hook uses SWR to efficiently fetch, cache, and revalidate goal data.
 * It automatically refreshes data when the component mounts.
 *
 * @param coachingSessionId The ID of the coaching session whose goals should be fetched
 * @returns An object containing:
 *
 * * goals: Array of Goal objects (empty array if data is not yet loaded)
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useGoalList = (coachingSessionId: Id) => {
  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<Goal>(
      GOALS_BASEURL,
      () => GoalApi.list(coachingSessionId),
      coachingSessionId
    );

  return {
    goals: entities,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * A custom React hook that fetches a single goal by its ID.
 * This hook uses SWR to efficiently fetch and cache goal data.
 *
 * @param id The ID of the goal to fetch. If null or undefined, no fetch will occur.
 * @returns An object containing:
 *
 * * goal: The fetched Goal object, or a default goal if not yet loaded
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useGoal = (id: Id) => {
  const url = id ? `${GOALS_BASEURL}/${id}` : null;
  const fetcher = () => GoalApi.get(id);

  const { entity, isLoading, isError, refresh } =
    EntityApi.useEntity<Goal>(
      url,
      fetcher,
      defaultGoal()
    );

  return {
    goal: entity,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * A custom React hook that fetches a single goal by coaching session ID.
 * This hook uses SWR to efficiently fetch and cache goal data.
 *
 * @param coachingSessionId The coaching session ID of the goal to fetch.
 * @returns An object containing:
 *
 * * goal: The fetched Goal object, or a default goal if not yet loaded
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useGoalBySession = (coachingSessionId: Id) => {
  const { goals, isLoading, isError, refresh } =
    useGoalList(coachingSessionId);

  return {
    goal: goals.length
      ? goals[0]
      : defaultGoal(),
    isLoading,
    isError: isError,
    refresh,
  };
};

/**
 * Hook for goal mutations.
 * Provides methods to create, update, and delete goals.
 */
export const useGoalMutation = () => {
  return EntityApi.useEntityMutation<Goal>(
    GOALS_BASEURL,
    {
      create: GoalApi.create,
      createNested: GoalApi.createNested,
      update: GoalApi.update,
      delete: GoalApi.delete,
      deleteNested: GoalApi.deleteNested,
    }
  );
};
