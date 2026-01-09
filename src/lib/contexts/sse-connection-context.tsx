"use client";

import { createContext, useContext } from 'react';
import { type StoreApi, useStore } from 'zustand';
import { type SSEConnectionStore } from '@/lib/stores/sse-connection-store';
import { useShallow } from 'zustand/shallow';

export const SSEConnectionStoreContext = createContext<StoreApi<SSEConnectionStore> | null>(null);

export const useSSEConnectionStore = <T,>(
  selector: (store: SSEConnectionStore) => T
): T => {
  const context = useContext(SSEConnectionStoreContext);

  if (!context) {
    throw new Error('useSSEConnectionStore must be used within SSEProvider');
  }

  return useStore(context, useShallow(selector));
};
