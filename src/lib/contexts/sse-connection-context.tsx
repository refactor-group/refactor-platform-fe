"use client";

import { createContext, useContext } from 'react';
import { type StoreApi, useStore } from 'zustand';
import { type SseConnectionStore } from '@/lib/stores/sse-connection-store';
import { useShallow } from 'zustand/shallow';

export const SseConnectionStoreContext = createContext<StoreApi<SseConnectionStore> | undefined>(undefined);

export const useSseConnectionStore = <T,>(
  selector: (store: SseConnectionStore) => T
): T => {
  const context = useContext(SseConnectionStoreContext);

  if (!context) {
    throw new Error('useSseConnectionStore must be used within SseProvider');
  }

  return useStore(context, useShallow(selector));
};
