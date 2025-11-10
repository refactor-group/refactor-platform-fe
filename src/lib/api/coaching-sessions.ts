// Interacts with the coaching_session endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import {
  CoachingSession,
  defaultCoachingSession,
  EnrichedCoachingSession,
  CoachingSessionInclude,
} from "@/types/coaching-session";
import { ApiSortOrder, CoachingSessionSortField } from "@/types/sorting";
import { EntityApi } from "./entity-api";
import { USERS_BASEURL } from "./users";
import { DateTime } from "ts-luxon";

// Re-export for convenience
export { CoachingSessionInclude };

const COACHING_SESSIONS_BASEURL: string = `${siteConfig.env.backendServiceURL}/coaching_sessions`;

/**
 * API client for coaching session-related operations.
 *
 * This object provides a collection of functions for interacting with the coaching session endpoints
 * on the backend service. It handles the HTTP requests and response parsing for all CRUD operations.
 */
export const CoachingSessionApi = {
  /*
   * Fetches a list of coaching sessions associated with a specific coaching relationship.
   *
   * @param relationshipId The ID of the coaching relationship under which the list of
   * coaching sessions should be retrieved from.
   * @param fromDate A date specifying the earliest coaching session date to return.
   * @param toDate A date specifying the latest coaching session date to match.
   * @param sortBy Optional field to sort by.
   * @param sortOrder Optional sort order.
   * @returns Promise resolving to an array of CoachingSession objects (empty array if data is not yet loaded or
   *  relationshipId is null)
   */
  list: async (
    relationshipId: Id | null,
    fromDate: DateTime,
    toDate: DateTime,
    sortBy?: CoachingSessionSortField,
    sortOrder?: ApiSortOrder
  ): Promise<CoachingSession[]> => {
    if (!relationshipId) return [];

    const params: Record<string, string> = {
      coaching_relationship_id: relationshipId,
      from_date: fromDate.toISODate() || '',
      to_date: toDate.toISODate() || '',
    };

    if (sortBy) {
      params.sort_by = sortBy;
    }
    if (sortOrder) {
      params.sort_order = sortOrder;
    }

    return EntityApi.listFn<CoachingSession>(COACHING_SESSIONS_BASEURL, {
      params,
    });
  },

  /**
   * Fetches a single coaching session by its ID.
   *
   * @param id The ID of the coaching session to retrieve
   * @returns Promise resolving to the CoachingSession object
   */
  get: async (id: Id): Promise<CoachingSession> =>
    EntityApi.getFn<CoachingSession>(`${COACHING_SESSIONS_BASEURL}/${id}`),

  /**
   * Creates a new coaching session.
   *
   * @param coaching session The coaching session data to create
   * @returns Promise resolving to the created CoachingSession object
   */
  create: async (coachingSession: CoachingSession): Promise<CoachingSession> =>
    EntityApi.createFn<CoachingSession, CoachingSession>(
      COACHING_SESSIONS_BASEURL,
      coachingSession
    ),

  createNested: async (): Promise<CoachingSession> => {
    throw new Error("Create nested operation not implemented");
  },

  /**
   * Updates an existing coaching session.
   *
   * @param id The ID of the coaching session to update
   * @param coaching session The updated coaching session data
   * @returns Promise resolving to the updated CoachingSession object
   */
  update: async (
    id: Id,
    coachingSession: CoachingSession
  ): Promise<CoachingSession> =>
    EntityApi.updateFn<CoachingSession, CoachingSession>(
      `${COACHING_SESSIONS_BASEURL}/${id}`,
      coachingSession
    ),

  /**
   * Deletes an coaching session.
   *
   * @param id The ID of the coaching session to delete
   * @returns Promise resolving to the deleted CoachingSession object
   */
  delete: async (id: Id): Promise<CoachingSession> =>
    EntityApi.deleteFn<null, CoachingSession>(
      `${COACHING_SESSIONS_BASEURL}/${id}`
    ),

  /**
   * Deletes a coaching session nested under another entity (foreign key relationship).
   *
   * @param entityId The ID of the entity under which to delete the coaching session
   * @param coachingSessionId The ID of the coaching session to delete
   * @returns Promise resolving to the deleted CoachingSession object
   */
  deleteNested: async (
    _entityId: Id,
    coachingSessionId: Id
  ): Promise<CoachingSession> => {
    throw new Error("Delete nested operation not implemented");
  },

  /**
   * Lists coaching sessions nested under a user (follows the createNested pattern).
   *
   * This uses the /users/{user_id}/coaching_sessions endpoint with support for
   * query parameters like date filtering and related resource inclusion.
   *
   * @param userId The ID of the user (coach or coachee)
   * @param params Query parameters for filtering, sorting, and including related data
   * @returns Promise resolving to array of EnrichedCoachingSession objects
   */
  listNested: async (
    userId: Id,
    params?: any
  ): Promise<EnrichedCoachingSession[]> => {
    return EntityApi.listNestedFn<EnrichedCoachingSession>(
      USERS_BASEURL,
      userId,
      'coaching_sessions',
      params
    );
  },

  /**
   * Fetches coaching sessions for a specific user with optional related data.
   *
   * This uses the enhanced /users/{user_id}/coaching_sessions endpoint that
   * supports batch loading of related resources to avoid N+1 queries.
   *
   * @param userId The ID of the user (coach or coachee)
   * @param fromDate Start date for filtering sessions
   * @param toDate End date for filtering sessions
   * @param include Optional array of related resources to include
   * @param sortBy Optional field to sort by
   * @param sortOrder Optional sort order
   * @returns Promise resolving to array of EnrichedCoachingSession objects
   */
  listForUser: async (
    userId: Id,
    fromDate: DateTime,
    toDate: DateTime,
    include?: CoachingSessionInclude[],
    sortBy?: CoachingSessionSortField,
    sortOrder?: ApiSortOrder
  ): Promise<EnrichedCoachingSession[]> => {
    const params: Record<string, string> = {
      from_date: fromDate.toISODate() || '',
      to_date: toDate.toISODate() || '',
    };

    if (include && include.length > 0) {
      params.include = include.join(',');
    }

    if (sortBy) {
      params.sort_by = sortBy;
    }
    if (sortOrder) {
      params.sort_order = sortOrder;
    }

    return CoachingSessionApi.listNested(userId, { params });
  },
};

/**
 * A custom React hook that fetches a list of coaching sessions for a specific user.
 *
 * This hook uses SWR to efficiently fetch, cache, and revalidate coaching session data.
 * It automatically refreshes data when the component mounts.
 *
 * @param relationshipId The ID of the coaching relationship under which the list of
 * coaching sessions should be fetched from.
 * @param fromDate A date specifying the earliest coaching session date to return.
 * @param toDate A date specifying the latest coaching session date to match.
 * @param sortBy Optional field to sort by.
 * @param sortOrder Optional sort order.
 * @returns An object containing:
 *
 * * coachingSessions: Array of CoachingSession objects (empty array if data is not yet loaded or
 *   relationshipId is null)
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useCoachingSessionList = (
  relationshipId: Id | null,
  fromDate: DateTime,
  toDate: DateTime,
  sortBy?: CoachingSessionSortField,
  sortOrder?: ApiSortOrder
) => {
  const params = relationshipId
    ? {
        coaching_relationship_id: relationshipId,
        from_date: fromDate.toISODate(),
        to_date: toDate.toISODate(),
        ...(sortBy && { sort_by: sortBy }),
        ...(sortOrder && { sort_order: sortOrder }),
      }
    : undefined;

  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<CoachingSession>(
      COACHING_SESSIONS_BASEURL,
      () => CoachingSessionApi.list(relationshipId!, fromDate, toDate, sortBy, sortOrder),
      params
    );

  return {
    coachingSessions: entities,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * A custom React hook that fetches a single coaching session by its ID.
 * This hook uses SWR to efficiently fetch and cache coaching session data.
 * It does not automatically revalidate the data on window focus, reconnect, or when data becomes stale.
 *
 * @param id The ID of the coaching session to fetch. If null or undefined, no fetch will occur.
 * @returns An object containing:
 *
 * * coachingSession: The fetched CoachingSession object, or a default coaching session if not yet loaded
 * * isLoading: Boolean indicating if the data is currently being fetched
 * * isError: Error object if the fetch operation failed, undefined otherwise
 * * refresh: Function to manually trigger a refresh of the data
 */
export const useCoachingSession = (id: Id) => {
  const url = id ? `${COACHING_SESSIONS_BASEURL}/${id}` : null;
  const fetcher = () => CoachingSessionApi.get(id);

  const { entity, isLoading, isError, refresh } =
    EntityApi.useEntity<CoachingSession>(
      url,
      fetcher,
      defaultCoachingSession()
    );

  return {
    coachingSession: entity,
    isLoading,
    isError,
    refresh,
  };
};

/**
 * A custom React hook that provides mutation operations for coaching sessions with loading and error state management.
 * This hook simplifies creating, updating, and deleting coaching sessions while handling loading states,
 * error management, and cache invalidation automatically.
 *
 * @returns An object containing:
 * create: Function to create a new coaching session
 * update: Function to update an existing coaching session
 * delete: Function to delete an coaching session
 * isLoading: Boolean indicating if any operation is in progress
 * error: Error object if the last operation failed, null otherwise
 */
export const useCoachingSessionMutation = () => {
  return EntityApi.useEntityMutation<CoachingSession>(
    COACHING_SESSIONS_BASEURL,
    {
      create: CoachingSessionApi.create,
      createNested: CoachingSessionApi.createNested,
      update: CoachingSessionApi.update,
      delete: CoachingSessionApi.delete,
      deleteNested: CoachingSessionApi.deleteNested,
    }
  );
};

/**
 * Custom React hook that fetches enriched coaching sessions for a user.
 *
 * This hook uses the enhanced endpoint that supports batch loading of related
 * resources, avoiding N+1 queries and reducing the number of API calls needed.
 *
 * @param userId The ID of the user to fetch sessions for
 * @param fromDate Start date for filtering sessions
 * @param toDate End date for filtering sessions
 * @param include Optional array of related resources to include
 * @param sortBy Optional field to sort by
 * @param sortOrder Optional sort order
 * @returns Object containing enriched sessions, loading state, error, and refresh function
 */
export const useEnrichedCoachingSessionsForUser = (
  userId: Id,
  fromDate: DateTime,
  toDate: DateTime,
  include?: CoachingSessionInclude[],
  sortBy?: CoachingSessionSortField,
  sortOrder?: ApiSortOrder
) => {
  const params = {
    from_date: fromDate.toISODate(),
    to_date: toDate.toISODate(),
    ...(include && include.length > 0 && { include: include.join(',') }),
    ...(sortBy && { sort_by: sortBy }),
    ...(sortOrder && { sort_order: sortOrder }),
  };

  const url = `${USERS_BASEURL}/${userId}/coaching_sessions`;

  const fetcher = () =>
    CoachingSessionApi.listForUser(
      userId,
      fromDate,
      toDate,
      include,
      sortBy,
      sortOrder
    );

  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<EnrichedCoachingSession>(
      url,
      fetcher,
      params
    );

  return {
    enrichedSessions: entities,
    isLoading,
    isError,
    refresh,
  };
};
