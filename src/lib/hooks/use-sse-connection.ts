"use client";

import { useEffect, useRef } from 'react';
import { siteConfig } from '@/site.config';
import { useSseConnectionStore } from '@/lib/contexts/sse-connection-context';
import { logoutCleanupRegistry } from '@/lib/hooks/logout-cleanup-registry';

export function useSseConnection(isLoggedIn: boolean) {
  const eventSourceRef = useRef<EventSource | null>(null);

  // Get store instance directly - Zustand actions are stable and don't need to be in dependencies
  const store = useSseConnectionStore((state) => state);

  useEffect(() => {
    if (!isLoggedIn) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      store.setDisconnected();
      return;
    }

    store.setConnecting();

    const source = new EventSource(`${siteConfig.env.backendServiceURL}/sse`, {
      withCredentials: true,
    });

    source.onopen = () => {
      console.log('[SSE] Connection established');
      store.setConnected();
    };

    source.onerror = (error) => {
      console.error('[SSE] Connection error:', error);

      // Check readyState to distinguish network errors from HTTP errors
      if (source.readyState === EventSource.CONNECTING) {
        // Browser is attempting reconnection (network error)
        store.setReconnecting();
        console.log('[SSE] Connection lost, browser attempting reconnection...');
      } else {
        // EventSource.CLOSED - permanent failure (HTTP error like 401, 403, 500)
        store.setError('Connection failed - check authentication or server status');
        source.close();
      }
    };

    eventSourceRef.current = source;

    const unregisterCleanup = logoutCleanupRegistry.register(() => {
      console.log('[SSE] Cleaning up connection on logout');
      source.close();
    });

    return () => {
      source.close();
      store.setDisconnected();
      unregisterCleanup();
    };
    // Zustand actions are stable and never change, so we only depend on isLoggedIn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]);

  return eventSourceRef.current;
}
