"use client";

import { type ReactNode, createContext, useContext, useState } from "react";
import { useStore } from "zustand";
import { type WeekGridStore, createWeekGridStore } from "@/lib/stores/week-grid-store";

type WeekGridStoreApi = ReturnType<typeof createWeekGridStore>;

const WeekGridStoreContext = createContext<WeekGridStoreApi | undefined>(undefined);

export const WeekGridStoreProvider = ({ children }: { children: ReactNode }) => {
  const [store] = useState(() => createWeekGridStore());
  return <WeekGridStoreContext.Provider value={store}>{children}</WeekGridStoreContext.Provider>;
};

export const useWeekGridStore = <T,>(selector: (store: WeekGridStore) => T): T => {
  const ctx = useContext(WeekGridStoreContext);
  if (!ctx) {
    throw new Error("useWeekGridStore must be used within WeekGridStoreProvider");
  }
  return useStore(ctx, selector);
};
