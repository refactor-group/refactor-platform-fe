"use client";

import { type ReactNode, createContext, useRef, useContext } from "react";
import { useStore } from "zustand";

import {
  type SimpleCoachingRelationshipStateStore,
  createSimpleCoachingRelationshipStateStore,
} from "@/lib/stores/simple-coaching-relationship-state-store";

export type SimpleCoachingRelationshipStateStoreApi = ReturnType<
  typeof createSimpleCoachingRelationshipStateStore
>;

export const SimpleCoachingRelationshipStateStoreContext = createContext<
  SimpleCoachingRelationshipStateStoreApi | undefined
>(undefined);

export interface SimpleCoachingRelationshipStateStoreProviderProps {
  children: ReactNode;
}

export const SimpleCoachingRelationshipStateStoreProvider = ({
  children,
}: SimpleCoachingRelationshipStateStoreProviderProps) => {
  const storeRef = useRef<SimpleCoachingRelationshipStateStoreApi>();
  if (!storeRef.current) {
    storeRef.current = createSimpleCoachingRelationshipStateStore();
  }

  return (
    <SimpleCoachingRelationshipStateStoreContext.Provider value={storeRef.current}>
      {children}
    </SimpleCoachingRelationshipStateStoreContext.Provider>
  );
};

export const useSimpleCoachingRelationshipStateStore = <T,>(
  selector: (store: SimpleCoachingRelationshipStateStore) => T
): T => {
  const simpleCoachingRelationshipStateStoreContext = useContext(
    SimpleCoachingRelationshipStateStoreContext
  );

  if (!simpleCoachingRelationshipStateStoreContext) {
    throw new Error(
      `useSimpleCoachingRelationshipStateStore must be used within SimpleCoachingRelationshipStateStoreProvider`
    );
  }

  return useStore(simpleCoachingRelationshipStateStoreContext, selector);
};