"use client";

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { siteConfig } from '@/site.config';
import type { Agreement } from '@/types/agreement';
import type { Id } from '@/types/general';
import { useSSEEventHandler } from './use-sse-event-handler';

/**
 * Returns true when the given SWR cache URL belongs to `baseUrl` and has
 * `endpointPath` as a path segment — i.e. the path ends with it, has a
 * subpath under it, or has a query string following it.
 *
 * This is deliberately loose enough to catch nested endpoints like
 * `/users/{id}/actions` when invalidating `/actions`. The previous
 * implementation used a substring check against `${baseUrl}${endpointPath}`,
 * which only matched the literal top-level path and silently skipped
 * user-scoped and relationship-scoped caches.
 *
 * Constraint: `endpointPath` must be a plain path segment like `/actions`
 * or `/goals` (no regex metacharacters).
 */
export function matchesEndpoint(
  url: string,
  baseUrl: string,
  endpointPath: string,
): boolean {
  if (!url.startsWith(baseUrl)) return false;
  const pattern = new RegExp(`${endpointPath}(/|\\?|$)`);
  return pattern.test(url);
}

/**
 * Upsert an agreement into a cached list: replace in place if its id is already
 * present (an update), otherwise append (a create). Returns a new array; never
 * mutates the input.
 */
export function upsertAgreementInList(
  list: Agreement[],
  agreement: Agreement,
): Agreement[] {
  const idx = list.findIndex((a) => a.id === agreement.id);
  if (idx === -1) return [...list, agreement];
  const next = [...list];
  next[idx] = agreement;
  return next;
}

/** Remove an agreement from a cached list by id. Returns a new array. */
export function removeAgreementFromList(
  list: Agreement[],
  agreementId: Id,
): Agreement[] {
  return list.filter((a) => a.id !== agreementId);
}

export function useSSECacheInvalidation(eventSource: EventSource | null) {
  const { mutate } = useSWRConfig();
  const baseUrl = siteConfig.env.backendServiceURL;

  /**
   * Invalidates SWR cache entries for a specific API endpoint.
   *
   * Matches the endpoint at any path depth — `/actions` catches both the
   * top-level `/actions[/{id}][?...]` endpoint and nested forms like
   * `/users/{id}/actions[?...]` and `/organizations/{org}/coaching_relationships/{rel}/actions[?...]`.
   */
  const invalidateEndpoint = useCallback((endpointPath: string, eventName: string) => {
    mutate(
      (key) => {
        const url = typeof key === 'string' ? key : Array.isArray(key) ? key[0] : null;
        if (typeof url !== 'string') return false;
        return matchesEndpoint(url, baseUrl, endpointPath);
      },
      undefined,
      // Revalidate WITHOUT blanking the cache. Writing `undefined` (the default)
      // empties the list for a beat, which unmounts/remounts list subtrees (a
      // visible flash); populateCache: false keeps the current data on screen
      // while the refetch runs in the background.
      { revalidate: true, populateCache: false }
    );
    console.log(`[SSE] Revalidated ${endpointPath} cache after ${eventName}`);
  }, [mutate, baseUrl]);

  /**
   * Invalidates session-scoped goal caches: both per-session caches
   * (e.g. /coaching_sessions/{id}/goals) and the batch endpoint cache
   * (e.g. /coaching_sessions/goals?coaching_relationship_id=...).
   */
  const invalidateSessionGoals = useCallback((eventName: string) => {
    const sessionGoalsPattern = `${baseUrl}/coaching_sessions/`;
    mutate(
      (key) => {
        const url = typeof key === 'string' ? key : Array.isArray(key) ? key[0] : null;
        if (typeof url !== 'string' || !url.startsWith(sessionGoalsPattern)) return false;
        // Match per-session caches: /coaching_sessions/{id}/goals
        if (url.endsWith('/goals')) return true;
        // Match batch cache: /coaching_sessions/goals?coaching_relationship_id=...
        if (url.includes('/coaching_sessions/goals?')) return true;
        return false;
      },
      undefined,
      // See invalidateEndpoint: don't blank the cache, just revalidate.
      { revalidate: true, populateCache: false }
    );
    console.log(`[SSE] Revalidated session-scoped goal caches after ${eventName}`);
  }, [mutate, baseUrl]);

  // Route the patch by the payload entity's coaching_session_id, not the
  // relationship-scoped envelope, since the list cache is session-keyed.
  const agreementsUrl = `${baseUrl}/agreements`;

  const isAgreementListKey = useCallback(
    (key: unknown): key is [string, { coaching_session_id?: Id }] =>
      Array.isArray(key) && typeof key[0] === 'string' && key[0] === agreementsUrl,
    [agreementsUrl],
  );

  // Payload entity shares the cached entities' raw (untransformed) shape, so it
  // drops in directly. Skip caches with no loaded list to avoid a partial write.
  const upsertAgreement = useCallback(
    (agreement: Agreement, eventName: string) => {
      mutate(
        (key) =>
          isAgreementListKey(key) &&
          key[1]?.coaching_session_id === agreement.coaching_session_id,
        (current: Agreement[] | undefined) =>
          current ? upsertAgreementInList(current, agreement) : current,
        { revalidate: false },
      );
      console.log(`[SSE] Patched agreement ${agreement.id} in cache after ${eventName}`);
    },
    [mutate, isAgreementListKey],
  );

  // Delete payload carries no session id, so scan every list cache (ids are unique).
  const removeAgreement = useCallback(
    (agreementId: Id, eventName: string) => {
      mutate(
        (key) => isAgreementListKey(key),
        (current: Agreement[] | undefined) =>
          current ? removeAgreementFromList(current, agreementId) : current,
        { revalidate: false },
      );
      console.log(`[SSE] Removed agreement ${agreementId} from cache after ${eventName}`);
    },
    [mutate, isAgreementListKey],
  );

  // ACTION EVENTS - Invalidate only /actions endpoint
  useSSEEventHandler(eventSource, 'action_created', () => {
    invalidateEndpoint('/actions', 'action_created');
  });

  useSSEEventHandler(eventSource, 'action_updated', () => {
    invalidateEndpoint('/actions', 'action_updated');
  });

  useSSEEventHandler(eventSource, 'action_deleted', () => {
    invalidateEndpoint('/actions', 'action_deleted');
  });

  // AGREEMENT EVENTS - Fine-grained: patch the session's cached list in place
  // from the entity in the payload (no refetch). Relationship-scoped on the wire,
  // but routed to the right session cache via the entity's coaching_session_id.
  useSSEEventHandler(eventSource, 'agreement_created', (event) => {
    upsertAgreement(event.data.agreement, 'agreement_created');
  });

  useSSEEventHandler(eventSource, 'agreement_updated', (event) => {
    upsertAgreement(event.data.agreement, 'agreement_updated');
  });

  useSSEEventHandler(eventSource, 'agreement_deleted', (event) => {
    removeAgreement(event.data.agreement_id, 'agreement_deleted');
  });

  // GOAL EVENTS - Invalidate /goals and session-scoped goal caches (join table)
  useSSEEventHandler(eventSource, 'goal_created', () => {
    invalidateEndpoint('/goals', 'goal_created');
    invalidateSessionGoals('goal_created');
  });

  useSSEEventHandler(eventSource, 'goal_updated', () => {
    invalidateEndpoint('/goals', 'goal_updated');
    invalidateSessionGoals('goal_updated');
  });

  useSSEEventHandler(eventSource, 'goal_deleted', () => {
    invalidateEndpoint('/goals', 'goal_deleted');
    invalidateSessionGoals('goal_deleted');
  });

  // COACHING SESSION GOAL EVENTS (join table) - Invalidate session-scoped goal caches
  useSSEEventHandler(eventSource, 'coaching_session_goal_created', () => {
    invalidateSessionGoals('coaching_session_goal_created');
  });

  useSSEEventHandler(eventSource, 'coaching_session_goal_deleted', () => {
    invalidateSessionGoals('coaching_session_goal_deleted');
  });

  // MEETING RECORDING EVENTS - Invalidate the meeting_recording endpoint for the session
  useSSEEventHandler(eventSource, 'meeting_recording_updated', () => {
    invalidateEndpoint('/meeting_recording', 'meeting_recording_updated');
  });

  // TRANSCRIPTION EVENTS - Invalidate transcriptions and transcript_segments endpoints
  // The /transcriptions pattern also matches .../transcriptions/{id}/transcription_segments,
  // which is intentional: when a transcription completes the segments were just written.
  useSSEEventHandler(eventSource, 'transcription_updated', () => {
    invalidateEndpoint('/transcriptions', 'transcription_updated');
  });

  // TOPIC EVENTS - Invalidate session-scoped topic lists
  // (/coaching_sessions/{id}/topics). Coarse-by-design: the event carries no
  // topic data, so we refetch. Covers the other participant's edits AND the
  // server-side carry-over copy on a new session's first read.
  useSSEEventHandler(eventSource, 'topics_changed', () => {
    invalidateEndpoint('/topics', 'topics_changed');
  });
}
