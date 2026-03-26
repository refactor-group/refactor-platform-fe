// Interacts with the goal endpoints

import { ResultAsync } from "neverthrow";
import { siteConfig } from "@/site.config";
import { Id, EntityApiError } from "@/types/general";
import {
  Goal,
  defaultGoal,
} from "@/types/goal";
import { ApiSortOrder, GoalSortField } from "@/types/sorting";
import { EntityApi } from "./entity-api";
import useSWR from "swr";
import { sessionGuard } from "@/lib/auth/session-guard";

const GOALS_BASEURL: string = `${siteConfig.env.backendServiceURL}/goals`;
const COACHING_SESSIONS_BASEURL: string = `${siteConfig.env.backendServiceURL}/coaching_sessions`;

/**
 * API client for goal-related operations.
 *
 * This object provides a collection of functions for interacting with the goal endpoints
 * on the backend service. It handles the HTTP requests and response parsing for all CRUD operations.
 */
export const GoalApi = {
  /*
   * Fetches a list of goals associated with a specific coaching relationship.
   *
   * @param coachingRelationshipId The ID of the coaching relationship whose goals should be retrieved
   * @param sortBy Optional field to sort by.
   * @param sortOrder Optional sort order.
   * @returns Promise resolving to an array of Goal objects
   */
  list: async (
    coachingRelationshipId: Id,
    sortBy?: GoalSortField,
    sortOrder?: ApiSortOrder
  ): Promise<Goal[]> => {
    const params: Record<string, string> = {
      coaching_relationship_id: coachingRelationshipId,
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
   * Fetches goals nested under a coaching session via the join table.
   * Uses GET /coaching_sessions/{session_id}/goals which returns full Goal models.
   *
   * @param coachingSessionId The ID of the parent coaching session
   * @returns Promise resolving to an array of Goal objects linked to the session
   */
  listNested: async (coachingSessionId: Id): Promise<Goal[]> => {
    return EntityApi.listNestedFn<Goal>(
      COACHING_SESSIONS_BASEURL,
      coachingSessionId,
      'goals',
      {}
    );
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

  /**
   * Links an existing goal to a coaching session via the join table.
   * Sends POST /coaching_sessions/{sessionId}/goals with { goal_id }.
   */
  linkToSession: (
    coachingSessionId: Id,
    goalId: Id
  ): ResultAsync<void, EntityApiError> =>
    ResultAsync.fromPromise(
      EntityApi.createFn<{ goal_id: Id }, unknown>(
        `${COACHING_SESSIONS_BASEURL}/${coachingSessionId}/goals`,
        { goal_id: goalId }
      ).then(() => undefined),
      (e) =>
        e instanceof EntityApiError
          ? e
          : new EntityApiError("POST", `${COACHING_SESSIONS_BASEURL}/${coachingSessionId}/goals`, e as Error)
    ),

  /**
   * Unlinks a goal from a coaching session via the join table.
   * Sends DELETE /coaching_sessions/{sessionId}/goals/{goalId}.
   */
  unlinkFromSession: (
    coachingSessionId: Id,
    goalId: Id
  ): ResultAsync<void, EntityApiError> =>
    ResultAsync.fromPromise(
      EntityApi.deleteFn<null, unknown>(
        `${COACHING_SESSIONS_BASEURL}/${coachingSessionId}/goals/${goalId}`
      ).then(() => undefined),
      (e) =>
        e instanceof EntityApiError
          ? e
          : new EntityApiError("DELETE", `${COACHING_SESSIONS_BASEURL}/${coachingSessionId}/goals/${goalId}`, e as Error)
    ),
};

/** Response shape from GET /coaching_sessions/goals batch endpoint. */
interface BatchSessionGoalsResponse {
  session_goals: Record<Id, Goal[]>;
}

/** Wrapped API response from the backend. */
interface ApiResponse<T> {
  status_code: number;
  data: T;
}

/**
 * Fetches goals for all sessions in a coaching relationship in a single request.
 * Replaces the N+1 pattern of calling GET /coaching_sessions/{id}/goals per session.
 *
 * @param coachingRelationshipId The coaching relationship whose session goals to fetch
 * @returns Record mapping session IDs to their linked goals
 */
async function fetchBatchSessionGoals(
  coachingRelationshipId: Id
): Promise<Record<Id, Goal[]>> {
  const response = await sessionGuard.get<ApiResponse<BatchSessionGoalsResponse>>(
    `${COACHING_SESSIONS_BASEURL}/goals`,
    {
      params: { coaching_relationship_id: coachingRelationshipId },
    }
  );
  return response.data.data.session_goals;
}

/**
 * SWR hook that fetches goals for all sessions in a coaching relationship
 * via the batch endpoint GET /coaching_sessions/goals?coaching_relationship_id=UUID.
 *
 * Returns a Record<Id, Goal[]> mapping session IDs to their linked goals.
 * Session cards can read sessionGoals[sessionId] directly.
 *
 * @param coachingRelationshipId The relationship ID, or null to skip fetching
 */
export const useBatchSessionGoals = (coachingRelationshipId: Id | null) => {
  const key = coachingRelationshipId
    ? `${COACHING_SESSIONS_BASEURL}/goals?coaching_relationship_id=${coachingRelationshipId}`
    : null;

  const { data, error, isLoading, mutate } = useSWR<Record<Id, Goal[]>>(
    key,
    () => fetchBatchSessionGoals(coachingRelationshipId!),
    { revalidateOnMount: true }
  );

  return {
    sessionGoals: data ?? {},
    isLoading,
    isError: error,
    refresh: mutate,
  };
};

/**
 * A custom React hook that fetches a list of goals for a specific coaching relationship.
 *
 * This hook uses SWR to efficiently fetch, cache, and revalidate goal data.
 * It automatically refreshes data when the component mounts.
 *
 * @param coachingRelationshipId The ID of the coaching relationship whose goals should be fetched
 * @returns An object containing:
 *
 * * goals: Array of Goal objects (empty array if data is not yet loaded)
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useGoalList = (coachingRelationshipId: Id | null) => {
  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<Goal>(
      GOALS_BASEURL,
      // SWR skips this fetcher when params are falsy (null key = no fetch)
      () => GoalApi.list(coachingRelationshipId!),
      coachingRelationshipId
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
 * A custom React hook that fetches the first goal for a coaching relationship.
 * This hook uses SWR to efficiently fetch and cache goal data.
 *
 * @param coachingRelationshipId The coaching relationship ID whose first goal should be fetched.
 * @returns An object containing:
 *
 * * goal: The fetched Goal object, or a default goal if not yet loaded
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useGoalByRelationship = (coachingRelationshipId: Id | null) => {
  const { goals, isLoading, isError, refresh } =
    useGoalList(coachingRelationshipId);

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
 * A custom React hook that fetches goals linked to a specific coaching session
 * via the coaching_sessions_goals join table.
 *
 * Uses GET /coaching_sessions/{session_id}/goals which returns full Goal models.
 *
 * @param coachingSessionId The coaching session ID whose linked goals should be fetched.
 * @returns An object containing:
 *
 * * goals: Array of Goal objects linked to the session (empty array if not loaded)
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useGoalsBySession = (coachingSessionId: Id | null) => {
  const url = coachingSessionId
    ? `${COACHING_SESSIONS_BASEURL}/${coachingSessionId}/goals`
    : COACHING_SESSIONS_BASEURL;

  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<Goal>(
      url,
      // SWR skips this fetcher when params are falsy (null key = no fetch)
      () => GoalApi.listNested(coachingSessionId!),
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
