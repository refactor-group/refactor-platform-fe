"use client";

import { type ReactNode, createContext, useState, useContext } from "react";
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
  const [store] = useState(() => createOrganizationStateStore());

  return (
    <OrganizationStateStoreContext.Provider value={store}>
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