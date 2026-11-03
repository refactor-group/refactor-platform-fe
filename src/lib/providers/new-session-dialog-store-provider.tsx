"use client";

import { type ReactNode, createContext, useContext, useState } from "react";
import { useStore } from "zustand";
import {
  type NewSessionDialogStore,
  createNewSessionDialogStore,
} from "@/lib/stores/new-session-dialog-store";

export type NewSessionDialogStoreApi = ReturnType<typeof createNewSessionDialogStore>;

export const NewSessionDialogStoreContext = createContext<NewSessionDialogStoreApi | undefined>(undefined);

export const NewSessionDialogStoreProvider = ({ children }: { children: ReactNode }) => {
  const [store] = useState(() => createNewSessionDialogStore());
  return <NewSessionDialogStoreContext.Provider value={store}>{children}</NewSessionDialogStoreContext.Provider>;
};

export const useNewSessionDialogStore = <T,>(selector: (store: NewSessionDialogStore) => T): T => {
  const ctx = useContext(NewSessionDialogStoreContext);
  if (!ctx) {
    throw new Error("useNewSessionDialogStore must be used within NewSessionDialogStoreProvider");
  }
  return useStore(ctx, selector);
};
