"use client";

import { type ReactNode, useRef } from 'react';
import { type StoreApi } from 'zustand';
import { type SseConnectionStore, createSseConnectionStore } from '@/lib/stores/sse-connection-store';
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
  const storeRef = useRef<StoreApi<SseConnectionStore>>();

  if (!storeRef.current) {
    storeRef.current = createSseConnectionStore();
  }

  return (
    <SseConnectionStoreContext.Provider value={storeRef.current}>
      <SseConnectionManager />
      {children}
    </SseConnectionStoreContext.Provider>
  );
};
