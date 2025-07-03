"use client";

import { type ReactNode, createContext, useRef, useContext } from "react";
import { useStore } from "zustand";

import {
  type SimpleOrganizationStateStore,
  createSimpleOrganizationStateStore,
} from "@/lib/stores/simple-organization-state-store";

export type SimpleOrganizationStateStoreApi = ReturnType<
  typeof createSimpleOrganizationStateStore
>;

export const SimpleOrganizationStateStoreContext = createContext<
  SimpleOrganizationStateStoreApi | undefined
>(undefined);

export interface SimpleOrganizationStateStoreProviderProps {
  children: ReactNode;
}

export const SimpleOrganizationStateStoreProvider = ({
  children,
}: SimpleOrganizationStateStoreProviderProps) => {
  const storeRef = useRef<SimpleOrganizationStateStoreApi | null>(null);
  if (!storeRef.current) {
    storeRef.current = createSimpleOrganizationStateStore();
  }

  return (
    <SimpleOrganizationStateStoreContext.Provider value={storeRef.current}>
      {children}
    </SimpleOrganizationStateStoreContext.Provider>
  );
};

export const useSimpleOrganizationStateStore = <T,>(
  selector: (store: SimpleOrganizationStateStore) => T
): T => {
  const simpleOrganizationStateStoreContext = useContext(
    SimpleOrganizationStateStoreContext
  );

  if (!simpleOrganizationStateStoreContext) {
    throw new Error(
      `useSimpleOrganizationStateStore must be used within SimpleOrganizationStateStoreProvider`
    );
  }

  return useStore(simpleOrganizationStateStoreContext, selector);
};