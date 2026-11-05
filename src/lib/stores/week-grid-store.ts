import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";

interface WeekGridState {
  weekOffset: number;
  personFilter: Option<Id>;
}

interface WeekGridActions {
  previousWeek: () => void;
  nextWeek: () => void;
  thisWeek: () => void;
  setPersonFilter: (id: Id) => void;
  clearPersonFilter: () => void;
  resetWeekGrid: () => void;
}

export type WeekGridStore = WeekGridState & WeekGridActions;

const initialState: WeekGridState = { weekOffset: 0, personFilter: None };

export const createWeekGridStore = () =>
  create<WeekGridStore>()(
    devtools(
      persist(
        (set) => ({
          ...initialState,
          previousWeek: () => set((s) => ({ weekOffset: s.weekOffset - 1 })),
          nextWeek: () => set((s) => ({ weekOffset: s.weekOffset + 1 })),
          thisWeek: () => set({ weekOffset: 0 }),
          setPersonFilter: (id) => set({ personFilter: Some(id) }),
          clearPersonFilter: () => set({ personFilter: None }),
          resetWeekGrid: () => set(initialState),
        }),
        {
          name: "week-grid-store",
          storage: createJSONStorage(() => sessionStorage),
          partialize: (s) => ({ personFilter: s.personFilter }),
        }
      )
    )
  );
