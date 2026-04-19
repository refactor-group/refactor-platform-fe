"use client";

import { type ReactNode, createContext, useContext, useState } from "react";
import { useStore } from "zustand";

import {
  type UIPreferencesStateStore,
  createUIPreferencesStateStore,
} from "@/lib/stores/ui-preferences-state-store";

export type UIPreferencesStateStoreApi = ReturnType<
  typeof createUIPreferencesStateStore
>;

export const UIPreferencesStateStoreContext = createContext<
  UIPreferencesStateStoreApi | undefined
>(undefined);

export interface UIPreferencesStateStoreProviderProps {
  children: ReactNode;
}

export const UIPreferencesStateStoreProvider = ({
  children,
}: UIPreferencesStateStoreProviderProps) => {
  const [store] = useState(() => createUIPreferencesStateStore());

  return (
    <UIPreferencesStateStoreContext.Provider value={store}>
      {children}
    </UIPreferencesStateStoreContext.Provider>
  );
};

export const useUIPreferencesStateStore = <T,>(
  selector: (store: UIPreferencesStateStore) => T
): T => {
  const context = useContext(UIPreferencesStateStoreContext);

  if (!context) {
    throw new Error(
      "useUIPreferencesStateStore must be used within UIPreferencesStateStoreProvider"
    );
  }

  return useStore(context, selector);
};
