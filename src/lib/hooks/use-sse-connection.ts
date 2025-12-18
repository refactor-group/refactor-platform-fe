"use client";

import { useEffect, useRef } from 'react';
import { siteConfig } from '@/site.config';
import { useSseConnectionStore } from '@/lib/contexts/sse-connection-context';
import { logoutCleanupRegistry } from '@/lib/hooks/logout-cleanup-registry';

export function useSseConnection(isLoggedIn: boolean) {
  const eventSourceRef = useRef<EventSource | null>(null);

  const {
    setConnecting,
    setConnected,
    setReconnecting,
    setError,
    setDisconnected,
  } = useSseConnectionStore((store) => ({
    setConnecting: store.setConnecting,
    setConnected: store.setConnected,
    setReconnecting: store.setReconnecting,
    setError: store.setError,
    setDisconnected: store.setDisconnected,
  }));

  useEffect(() => {
    if (!isLoggedIn) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      setDisconnected();
      return;
    }

    setConnecting();

    const source = new EventSource(`${siteConfig.env.backendServiceURL}/sse`, {
      withCredentials: true,
    });

    source.onopen = () => {
      console.log('[SSE] Connection established');
      setConnected();
    };

    source.onerror = (error) => {
      console.error('[SSE] Connection error:', error);

      // Check readyState to distinguish network errors from HTTP errors
      if (source.readyState === EventSource.CONNECTING) {
        // Browser is attempting reconnection (network error)
        setReconnecting();
        console.log('[SSE] Connection lost, browser attempting reconnection...');
      } else {
        // EventSource.CLOSED - permanent failure (HTTP error like 401, 403, 500)
        setError('Connection failed - check authentication or server status');
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
      setDisconnected();
      unregisterCleanup();
    };
  }, [isLoggedIn, setConnecting, setConnected, setReconnecting, setError, setDisconnected]);

  return eventSourceRef.current;
}
