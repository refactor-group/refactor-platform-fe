"use client";

import { type ReactNode, createContext, useState, useContext } from "react";
import { useStore } from "zustand";

import {
  type UiPreferencesStore,
  createUiPreferencesStore,
} from "@/lib/stores/ui-preferences-state-store";

export type UiPreferencesStoreApi = ReturnType<typeof createUiPreferencesStore>;

export const UiPreferencesStoreContext = createContext<
  UiPreferencesStoreApi | undefined
>(undefined);

export interface UiPreferencesStoreProviderProps {
  children: ReactNode;
}

export const UiPreferencesStoreProvider = ({
  children,
}: UiPreferencesStoreProviderProps) => {
  const [store] = useState(() => createUiPreferencesStore());

  return (
    <UiPreferencesStoreContext.Provider value={store}>
      {children}
    </UiPreferencesStoreContext.Provider>
  );
};

export const useUiPreferencesStore = <T,>(
  selector: (store: UiPreferencesStore) => T
): T => {
  const ctx = useContext(UiPreferencesStoreContext);

  if (!ctx) {
    throw new Error(
      "useUiPreferencesStore must be used within UiPreferencesStoreProvider"
    );
  }

  return useStore(ctx, selector);
};
