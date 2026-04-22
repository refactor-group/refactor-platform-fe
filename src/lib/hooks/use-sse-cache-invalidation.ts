"use client";

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { siteConfig } from '@/site.config';
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
      { revalidate: true }
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
      { revalidate: true }
    );
    console.log(`[SSE] Revalidated session-scoped goal caches after ${eventName}`);
  }, [mutate, baseUrl]);

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

  // AGREEMENT EVENTS - Invalidate only /agreements endpoint
  useSSEEventHandler(eventSource, 'agreement_created', () => {
    invalidateEndpoint('/agreements', 'agreement_created');
  });

  useSSEEventHandler(eventSource, 'agreement_updated', () => {
    invalidateEndpoint('/agreements', 'agreement_updated');
  });

  useSSEEventHandler(eventSource, 'agreement_deleted', () => {
    invalidateEndpoint('/agreements', 'agreement_deleted');
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
}
