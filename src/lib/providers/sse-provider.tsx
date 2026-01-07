"use client";

import { type ReactNode, useState } from 'react';
import { createSseConnectionStore } from '@/lib/stores/sse-connection-store';
import { SseConnectionStoreContext } from '@/lib/contexts/sse-connection-context';
import { useAuthStore } from '@/lib/providers/auth-store-provider';
import { useSseConnection } from '@/lib/hooks/use-sse-connection';
import { useSseCacheInvalidation } from '@/lib/hooks/use-sse-cache-invalidation';
import { useSseSystemEvents } from '@/lib/hooks/use-sse-system-events';

export interface SseProviderProps {
  children: ReactNode;
}

function SseConnectionManager() {
  const isLoggedIn = useAuthStore((store) => store.isLoggedIn);
  const eventSource = useSseConnection(isLoggedIn);

  useSseCacheInvalidation(eventSource);
  useSseSystemEvents(eventSource);

  return null;
}

export const SseProvider = ({ children }: SseProviderProps) => {
  const [store] = useState(() => createSseConnectionStore());

  return (
    <SseConnectionStoreContext.Provider value={store}>
      <SseConnectionManager />
      {children}
    </SseConnectionStoreContext.Provider>
  );
};
