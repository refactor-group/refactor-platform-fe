// Interacts with the coaching_session_series endpoints.

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { CreateRecurringSessionRequest } from "@/types/recurrence";
import {
  CoachingSessionSeries,
  CoachingSessionSeriesWithSessions,
  CoachingSessionSeriesRaw,
  CoachingSessionSeriesWithSessionsRaw,
  defaultCoachingSessionSeriesWithSessions,
  parseCoachingSessionSeries,
  parseCoachingSessionSeriesWithSessions,
} from "@/types/coaching-session-series";
import { EntityApi } from "./entity-api";

const COACHING_SESSION_SERIES_BASEURL: string = `${siteConfig.env.backendServiceURL}/coaching_session_series`;

/**
 * API client for coaching session series operations.
 *
 * Mirrors the CoachingSessionApi pattern: thin wrappers over the generic
 * EntityApi helpers, with the wire `rule` normalized to domain types at the
 * fetch edge via the `parse*` functions.
 */
export const CoachingSessionSeriesApi = {
  /**
   * Lists series for a coaching relationship (metadata only — no sessions).
   *
   * @param relationshipId Relationship whose series to fetch; null returns [].
   */
  list: (relationshipId: Id | null): Promise<CoachingSessionSeries[]> => {
    if (!relationshipId) return Promise.resolve([]);
    return EntityApi.listFn<CoachingSessionSeriesRaw, CoachingSessionSeries>(
      COACHING_SESSION_SERIES_BASEURL,
      { params: { coaching_relationship_id: relationshipId } },
      parseCoachingSessionSeries
    );
  },

  /**
   * Reads one series together with its materialized sessions, date-sorted.
   */
  get: (id: Id): Promise<CoachingSessionSeriesWithSessions> =>
    EntityApi.getFn<CoachingSessionSeriesWithSessionsRaw>(
      `${COACHING_SESSION_SERIES_BASEURL}/${id}`
    ).then(parseCoachingSessionSeriesWithSessions),

  /**
   * Creates a series and materializes its sessions in one transaction.
   * Returns the series with every created session; the first equals `start_at`.
   */
  create: (
    payload: CreateRecurringSessionRequest
  ): Promise<CoachingSessionSeriesWithSessions> =>
    EntityApi.createFn<
      CreateRecurringSessionRequest,
      CoachingSessionSeriesWithSessionsRaw
    >(COACHING_SESSION_SERIES_BASEURL, payload).then(
      parseCoachingSessionSeriesWithSessions
    ),

  /**
   * Reschedules a series: replaces the rule and re-materializes future
   * sessions. Past sessions are untouched. Returns the series with its sessions.
   */
  update: (
    id: Id,
    payload: CreateRecurringSessionRequest
  ): Promise<CoachingSessionSeriesWithSessions> =>
    EntityApi.updateFn<
      CreateRecurringSessionRequest,
      CoachingSessionSeriesWithSessionsRaw
    >(`${COACHING_SESSION_SERIES_BASEURL}/${id}`, payload).then(
      parseCoachingSessionSeriesWithSessions
    ),

  /**
   * Deletes a series and its future sessions; past sessions survive.
   */
  delete: (id: Id): Promise<CoachingSessionSeries> =>
    EntityApi.deleteFn<null, CoachingSessionSeriesRaw>(
      `${COACHING_SESSION_SERIES_BASEURL}/${id}`
    ).then(parseCoachingSessionSeries),
};

/**
 * Fetches the list of series for a relationship (metadata only).
 *
 * @returns { series, isLoading, isError, refresh }
 */
export const useCoachingSessionSeriesList = (relationshipId: Id | null) => {
  const params = relationshipId
    ? { coaching_relationship_id: relationshipId }
    : undefined;

  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<CoachingSessionSeries>(
      COACHING_SESSION_SERIES_BASEURL,
      () => CoachingSessionSeriesApi.list(relationshipId),
      params
    );

  return { series: entities, isLoading, isError, refresh };
};

/**
 * Fetches a single series with its materialized sessions. Passing a falsy id
 * disables the fetch and yields the default empty series.
 *
 * @returns { series, isLoading, isError, refresh }
 */
export const useCoachingSessionSeries = (id: Id) => {
  const url = id ? `${COACHING_SESSION_SERIES_BASEURL}/${id}` : null;

  const { entity, isLoading, isError, refresh } =
    EntityApi.useEntity<CoachingSessionSeriesWithSessions>(
      url,
      () => CoachingSessionSeriesApi.get(id),
      defaultCoachingSessionSeriesWithSessions()
    );

  return { series: entity, isLoading, isError, refresh };
};

/**
 * Mutation hook for series create/reschedule/delete with loading + error state
 * and automatic invalidation of series-list cache keys.
 *
 * Note: this only invalidates `coaching_session_series` keys. Because a
 * reschedule re-materializes and a delete drops future sessions, callers
 * displaying `coaching_sessions` lists must `refresh()` those separately.
 */
export const useCoachingSessionSeriesMutation = () => {
  return EntityApi.useEntityMutation<
    CreateRecurringSessionRequest,
    CoachingSessionSeries
  >(COACHING_SESSION_SERIES_BASEURL, {
    create: CoachingSessionSeriesApi.create,
    update: CoachingSessionSeriesApi.update,
    delete: CoachingSessionSeriesApi.delete,
  });
};
