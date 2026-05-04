"use client";

import { type ReactNode, createContext, useState, useContext } from "react";
import { useStore } from "zustand";

import {
  type CoachingSessionsCardFilterStore,
  createCoachingSessionsCardFilterStore,
} from "@/lib/stores/coaching-sessions-card-filter-store";

export type CoachingSessionsCardFilterStoreApi = ReturnType<
  typeof createCoachingSessionsCardFilterStore
>;

export const CoachingSessionsCardFilterStoreContext = createContext<
  CoachingSessionsCardFilterStoreApi | undefined
>(undefined);

export interface CoachingSessionsCardFilterStoreProviderProps {
  children: ReactNode;
}

export const CoachingSessionsCardFilterStoreProvider = ({
  children,
}: CoachingSessionsCardFilterStoreProviderProps) => {
  const [store] = useState(() => createCoachingSessionsCardFilterStore());

  return (
    <CoachingSessionsCardFilterStoreContext.Provider value={store}>
      {children}
    </CoachingSessionsCardFilterStoreContext.Provider>
  );
};

export const useCoachingSessionsCardFilterStore = <T,>(
  selector: (store: CoachingSessionsCardFilterStore) => T
): T => {
  const ctx = useContext(CoachingSessionsCardFilterStoreContext);

  if (!ctx) {
    throw new Error(
      `useCoachingSessionsCardFilterStore must be used within CoachingSessionsCardFilterStoreProvider`
    );
  }

  return useStore(ctx, selector);
};
