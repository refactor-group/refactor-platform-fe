"use client";

import { type ReactNode, createContext, useRef, useContext } from "react";
import { useStore } from "zustand";

import {
  type OrganizationStateStore,
  createOrganizationStateStore,
} from "@/lib/stores/organization-state-store";

export type OrganizationStateStoreApi = ReturnType<
  typeof createOrganizationStateStore
>;

export const OrganizationStateStoreContext = createContext<
  OrganizationStateStoreApi | undefined
>(undefined);

export interface OrganizationStateStoreProviderProps {
  children: ReactNode;
}

export const OrganizationStateStoreProvider = ({
  children,
}: OrganizationStateStoreProviderProps) => {
  const storeRef = useRef<OrganizationStateStoreApi | null>(null);
  if (!storeRef.current) {
    storeRef.current = createOrganizationStateStore();
  }

  return (
    <OrganizationStateStoreContext.Provider value={storeRef.current}>
      {children}
    </OrganizationStateStoreContext.Provider>
  );
};

export const useOrganizationStateStore = <T,>(
  selector: (store: OrganizationStateStore) => T
): T => {
  const organizationStateStoreContext = useContext(
    OrganizationStateStoreContext
  );

  if (!organizationStateStoreContext) {
    throw new Error(
      `useOrganizationStateStore must be used within OrganizationStateStoreProvider`
    );
  }

  return useStore(organizationStateStoreContext, selector);
};