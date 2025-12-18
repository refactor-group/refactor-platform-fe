"use client";

import { useCallback } from 'react';
import { useSWRConfig } from 'swr';
import { siteConfig } from '@/site.config';
import { useSseEventHandler } from './use-sse-event-handler';

export function useSseCacheInvalidation(eventSource: EventSource | null) {
  const { mutate } = useSWRConfig();
  const baseUrl = siteConfig.env.backendServiceURL;

  const invalidateAllCaches = useCallback(() => {
    mutate((key) => typeof key === 'string' && key.includes(baseUrl));
  }, [mutate, baseUrl]);

  useSseEventHandler(eventSource, 'action_created', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after action_created');
  });

  useSseEventHandler(eventSource, 'action_updated', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after action_updated');
  });

  useSseEventHandler(eventSource, 'action_deleted', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after action_deleted');
  });

  useSseEventHandler(eventSource, 'agreement_created', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after agreement_created');
  });

  useSseEventHandler(eventSource, 'agreement_updated', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after agreement_updated');
  });

  useSseEventHandler(eventSource, 'agreement_deleted', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after agreement_deleted');
  });

  useSseEventHandler(eventSource, 'overarching_goal_created', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after overarching_goal_created');
  });

  useSseEventHandler(eventSource, 'overarching_goal_updated', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after overarching_goal_updated');
  });

  useSseEventHandler(eventSource, 'overarching_goal_deleted', () => {
    invalidateAllCaches();
    console.log('[SSE] Revalidated caches after overarching_goal_deleted');
  });
}
