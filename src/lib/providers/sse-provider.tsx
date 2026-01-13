"use client";

import { type ReactNode, useState } from 'react';
import { createSSEConnectionStore } from '@/lib/stores/sse-connection-store';
import { SSEConnectionStoreContext } from '@/lib/contexts/sse-connection-context';
import { useAuthStore } from '@/lib/providers/auth-store-provider';
import { useSSEConnection } from '@/lib/hooks/use-sse-connection';
import { useSSECacheInvalidation } from '@/lib/hooks/use-sse-cache-invalidation';
import { useSSESystemEvents } from '@/lib/hooks/use-sse-system-events';

export interface SSEProviderProps {
  children: ReactNode;
}

function SSEConnectionManager() {
  const isLoggedIn = useAuthStore((store) => store.isLoggedIn);
  const eventSource = useSSEConnection(isLoggedIn);

  useSSECacheInvalidation(eventSource);
  useSSESystemEvents(eventSource);

  return null;
}

export const SSEProvider = ({ children }: SSEProviderProps) => {
  const [store] = useState(() => createSSEConnectionStore());

  return (
    <SSEConnectionStoreContext.Provider value={store}>
      <SSEConnectionManager />
      {children}
    </SSEConnectionStoreContext.Provider>
  );
};
