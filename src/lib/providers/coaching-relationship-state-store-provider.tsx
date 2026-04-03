"use client";

import { type ReactNode, createContext, useState, useContext } from "react";
import { useStore } from "zustand";

import {
  type CoachingRelationshipStateStore,
  createCoachingRelationshipStateStore,
} from "@/lib/stores/coaching-relationship-state-store";

export type CoachingRelationshipStateStoreApi = ReturnType<
  typeof createCoachingRelationshipStateStore
>;

export const CoachingRelationshipStateStoreContext = createContext<
  CoachingRelationshipStateStoreApi | undefined
>(undefined);

export interface CoachingRelationshipStateStoreProviderProps {
  children: ReactNode;
}

export const CoachingRelationshipStateStoreProvider = ({
  children,
}: CoachingRelationshipStateStoreProviderProps) => {
  const [store] = useState(() => createCoachingRelationshipStateStore());

  return (
    <CoachingRelationshipStateStoreContext.Provider value={store}>
      {children}
    </CoachingRelationshipStateStoreContext.Provider>
  );
};

export const useCoachingRelationshipStateStore = <T,>(
  selector: (store: CoachingRelationshipStateStore) => T
): T => {
  const coachingRelationshipStateStoreContext = useContext(
    CoachingRelationshipStateStoreContext
  );

  if (!coachingRelationshipStateStoreContext) {
    throw new Error(
      `useCoachingRelationshipStateStore must be used within CoachingRelationshipStateStoreProvider`
    );
  }

  return useStore(coachingRelationshipStateStoreContext, selector);
};