"use client";

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { siteConfig } from '@/site.config';
import { useSSEEventHandler } from './use-sse-event-handler';

export function useSSECacheInvalidation(eventSource: EventSource | null) {
  const { mutate } = useSWRConfig();
  const baseUrl = siteConfig.env.backendServiceURL;

  const invalidateAllCaches = useCallback(() => {
    mutate(
      (key) => {
        // Handle string keys
        if (typeof key === 'string' && key.includes(baseUrl)) return true;
        // Handle array keys (SWR supports both formats)
        if (Array.isArray(key) && key[0] && key[0].includes(baseUrl)) return true;
        return false;
      },
      undefined,
      { revalidate: true }
    );
  }, [mutate, baseUrl]);

  useSSEEventHandler(eventSource, 'action_created', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after action_created');
  });

  useSSEEventHandler(eventSource, 'action_updated', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after action_updated');
  });

  useSSEEventHandler(eventSource, 'action_deleted', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after action_deleted');
  });

  useSSEEventHandler(eventSource, 'agreement_created', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after agreement_created');
  });

  useSSEEventHandler(eventSource, 'agreement_updated', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after agreement_updated');
  });

  useSSEEventHandler(eventSource, 'agreement_deleted', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after agreement_deleted');
  });

  useSSEEventHandler(eventSource, 'overarching_goal_created', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after overarching_goal_created');
  });

  useSSEEventHandler(eventSource, 'overarching_goal_updated', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after overarching_goal_updated');
  });

  useSSEEventHandler(eventSource, 'overarching_goal_deleted', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after overarching_goal_deleted');
  });
}
