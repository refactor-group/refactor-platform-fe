"use client";

import { type ReactNode, createContext, useRef, useContext } from "react";
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
  const storeRef = useRef<CoachingRelationshipStateStoreApi | null>(null);
  if (!storeRef.current) {
    storeRef.current = createCoachingRelationshipStateStore();
  }

  return (
    <CoachingRelationshipStateStoreContext.Provider value={storeRef.current}>
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