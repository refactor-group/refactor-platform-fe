// Interacts with the coaching_session endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import {
  CoachingSession,
  defaultCoachingSession,
  EnrichedCoachingSession,
  CoachingSessionInclude,
  transformCoachingSession,
  serializeCoachingSession,
} from "@/types/coaching-session";
import { CoachingSessionCountByMonth } from "@/types/coaching-session-bucket";
import { ApiSortOrder, CoachingSessionSortField } from "@/types/sorting";
import { CreateRecurringSessionRequest } from "@/types/recurrence";
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

    return (
      await EntityApi.listFn<any>(COACHING_SESSIONS_BASEURL, { params })
    ).map(transformCoachingSession);
  },

  /**
   * Fetches a single coaching session by its ID.
   *
   * @param id The ID of the coaching session to retrieve
   * @returns Promise resolving to the CoachingSession object
   */
  get: async (id: Id): Promise<CoachingSession> =>
    transformCoachingSession(
      await EntityApi.getFn<any>(`${COACHING_SESSIONS_BASEURL}/${id}`)
    ),

  /**
   * Creates a new coaching session.
   *
   * @param coaching session The coaching session data to create
   * @returns Promise resolving to the created CoachingSession object
   */
  create: async (coachingSession: CoachingSession): Promise<CoachingSession> =>
    transformCoachingSession(
      await EntityApi.createFn<any, any>(
        COACHING_SESSIONS_BASEURL,
        serializeCoachingSession(coachingSession)
      )
    ),

  /**
   * Creates a recurring series of coaching sessions in a single request.
   *
   * Hits POST /coaching_sessions/recurring. The backend expands the
   * recurrence rule and persists every occurrence; the first one always
   * equals `start_at`. Caller is responsible for satisfying the field
   * rules — see `@/types/recurrence` and the form-side guards.
   *
   * @param payload The CreateRecurringSessionRequest payload
   * @returns Promise resolving to the array of created CoachingSession objects
   */
  createRecurring: async (
    payload: CreateRecurringSessionRequest
  ): Promise<CoachingSession[]> =>
    (
      await EntityApi.createFn<CreateRecurringSessionRequest, any[]>(
        `${COACHING_SESSIONS_BASEURL}/recurring`,
        payload
      )
    ).map(transformCoachingSession),

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
    transformCoachingSession(
      await EntityApi.updateFn<any, any>(
        `${COACHING_SESSIONS_BASEURL}/${id}`,
        serializeCoachingSession(coachingSession)
      )
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
    _coachingSessionId: Id
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
    return (
      await EntityApi.listNestedFn<any>(
        USERS_BASEURL,
        userId,
        'coaching_sessions',
        params
      )
    ).map(transformCoachingSession) as EnrichedCoachingSession[];
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
   * @param relationshipId Optional coaching relationship ID to filter sessions
   * @returns Promise resolving to array of EnrichedCoachingSession objects
   */
  listForUser: async (
    userId: Id,
    fromDate: DateTime,
    toDate: DateTime,
    include?: CoachingSessionInclude[],
    sortBy?: CoachingSessionSortField,
    sortOrder?: ApiSortOrder,
    relationshipId?: Id,
    tz?: string
  ): Promise<EnrichedCoachingSession[]> => {
    const params: Record<string, string> = {
      from_date: fromDate.toISODate() || '',
      to_date: toDate.toISODate() || '',
    };

    if (relationshipId) {
      params.coaching_relationship_id = relationshipId;
    }

    if (include && include.length > 0) {
      params.include = include.join(',');
    }

    if (sortBy) {
      params.sort_by = sortBy;
    }
    if (sortOrder) {
      params.sort_order = sortOrder;
    }
    if (tz) {
      params.tz = tz;
    }

    return CoachingSessionApi.listNested(userId, { params });
  },

  listCountsForUser: async (
    userId: Id,
    fromDate: DateTime,
    toDate: DateTime,
    tz: string,
    relationshipId?: Id
  ): Promise<CoachingSessionCountByMonth[]> => {
    const fromIso = fromDate.toISODate();
    const toIso = toDate.toISODate();
    if (!fromIso || !toIso) {
      throw new Error(
        `listCountsForUser: invalid DateTime input (fromDate=${fromDate.toString()}, toDate=${toDate.toString()})`
      );
    }
    const params: Record<string, string> = {
      from_date: fromIso,
      to_date: toIso,
      group_by: "month",
      tz,
    };
    if (relationshipId) {
      params.coaching_relationship_id = relationshipId;
    }

    const url = `${USERS_BASEURL}/${userId}/coaching_sessions/counts`;
    const response = await EntityApi.getFn<{ counts: CoachingSessionCountByMonth[] }>(
      url,
      { params }
    );
    return response.counts;
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
 * @param relationshipId Optional coaching relationship ID to filter sessions
 * @returns Object containing enriched sessions, loading state, error, and refresh function
 */
export const useEnrichedCoachingSessionsForUser = (
  userId: Id | null,
  fromDate: DateTime,
  toDate: DateTime,
  include?: CoachingSessionInclude[],
  sortBy?: CoachingSessionSortField,
  sortOrder?: ApiSortOrder,
  relationshipId?: Id,
  tz?: string
) => {
  // Only create params when userId is valid - null params skips the SWR fetch
  const params = userId
    ? {
        user_id: userId,
        from_date: fromDate.toISODate(),
        to_date: toDate.toISODate(),
        ...(include && include.length > 0 && { include: include.join(',') }),
        ...(relationshipId && { coaching_relationship_id: relationshipId }),
        ...(sortBy && { sort_by: sortBy }),
        ...(sortOrder && { sort_order: sortOrder }),
        ...(tz && { tz }),
      }
    : null;

  const url = userId ? `${USERS_BASEURL}/${userId}/coaching_sessions` : '';

  const fetcher = () =>
    userId
      ? CoachingSessionApi.listForUser(
          userId,
          fromDate,
          toDate,
          include,
          sortBy,
          sortOrder,
          relationshipId,
          tz
        )
      : Promise.resolve([]);

  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<EnrichedCoachingSession>(
      url,
      fetcher,
      params
    );

  return {
    enrichedSessions: entities,
    isLoading: userId ? isLoading : false,
    isError,
    refresh,
  };
};

/**
 * Custom React hook that fetches per-month coaching-session counts for a user
 * within a date range. Used by the dashboard bucket UI to display count badges
 * on collapsed bucket headers without loading full session rows.
 *
 * @param userId The ID of the user (coach or coachee). Null skips the fetch.
 * @param fromDate Start date for the count window
 * @param toDate End date for the count window
 * @param tz IANA timezone for local-calendar month aggregation on the BE
 * @param relationshipId Optional relationship to narrow counts to one coachee
 * @returns counts, loading/error state, and a refresh fn. On error or 404,
 *   counts is an empty array — caller falls back to "no badge" rendering.
 */
export const useEnrichedCoachingSessionsForUserCounts = (
  userId: Id | null,
  fromDate: DateTime,
  toDate: DateTime,
  tz: string,
  relationshipId?: Id
) => {
  const params = userId
    ? {
        user_id: userId,
        from_date: fromDate.toISODate(),
        to_date: toDate.toISODate(),
        group_by: "month",
        tz,
        ...(relationshipId && { coaching_relationship_id: relationshipId }),
      }
    : null;

  const url = userId
    ? `${USERS_BASEURL}/${userId}/coaching_sessions/counts`
    : '';

  const fetcher = () =>
    userId
      ? CoachingSessionApi.listCountsForUser(
          userId,
          fromDate,
          toDate,
          tz,
          relationshipId
        )
      : Promise.resolve([]);

  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<CoachingSessionCountByMonth>(url, fetcher, params, {
      // Avoids a flicker on range expansion where new empty months render
      // as `None` and then collapse once the response lands.
      keepPreviousData: true,
    });

  return {
    counts: entities,
    isLoading: userId ? isLoading : false,
    isError,
    refresh,
  };
};
