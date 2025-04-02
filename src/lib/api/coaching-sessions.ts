// Interacts with the coaching_session endpoints

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import {
  CoachingSession,
  defaultCoachingSession,
} from "@/types/coaching-session";
import { EntityApi } from "./entity-api";
import { DateTime } from "ts-luxon";

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
   * @returns Promise resolving to an array of CoachingSession objects (empty array if data is not yet loaded or
   *  relationshipId is null)
   */
  list: async (
    relationshipId: Id | null,
    fromDate: DateTime,
    toDate: DateTime
  ): Promise<CoachingSession[]> => {
    if (!relationshipId) return [];

    return EntityApi.listFn<CoachingSession>(COACHING_SESSIONS_BASEURL, {
      params: {
        coaching_relationship_id: relationshipId,
        from_date: fromDate.toISODate(),
        to_date: toDate.toISODate(),
      },
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
  toDate: DateTime
) => {
  const params = relationshipId
    ? {
        coaching_relationship_id: relationshipId,
        from_date: fromDate.toISODate(),
        to_date: toDate.toISODate(),
      }
    : undefined;

  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<CoachingSession>(
      COACHING_SESSIONS_BASEURL,
      () => CoachingSessionApi.list(relationshipId!, fromDate, toDate),
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
    }
  );
};
