import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";

interface WeekGridState {
  weekOffset: number;
  personFilter: Option<Id>;
  selectedDay: Option<string>;
  recentlyMoved: Id[];
}

interface WeekGridActions {
  previousWeek: () => void;
  nextWeek: () => void;
  thisWeek: () => void;
  setPersonFilter: (id: Id) => void;
  clearPersonFilter: () => void;
  selectDay: (iso: string) => void;
  markMoved: (id: Id) => void;
  clearMoved: () => void;
  resetWeekGrid: () => void;
}

export type WeekGridStore = WeekGridState & WeekGridActions;

const initialState: WeekGridState = {
  weekOffset: 0,
  personFilter: None,
  selectedDay: None,
  recentlyMoved: [],
};

export const createWeekGridStore = () =>
  create<WeekGridStore>()(
    devtools(
      persist(
        (set) => ({
          ...initialState,
          previousWeek: () => set((s) => ({ weekOffset: s.weekOffset - 1, selectedDay: None })),
          nextWeek: () => set((s) => ({ weekOffset: s.weekOffset + 1, selectedDay: None })),
          thisWeek: () => set({ weekOffset: 0, selectedDay: None }),
          setPersonFilter: (id) => set({ personFilter: Some(id) }),
          clearPersonFilter: () => set({ personFilter: None }),
          selectDay: (iso) => set({ selectedDay: Some(iso) }),
          markMoved: (id) =>
            set((s) => (s.recentlyMoved.includes(id) ? s : { recentlyMoved: [...s.recentlyMoved, id] })),
          clearMoved: () => set({ recentlyMoved: [] }),
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
