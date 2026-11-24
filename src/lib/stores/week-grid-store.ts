import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";

interface WeekGridState {
  weekOffset: number;
  personFilter: Option<Id>;
  selectedDay: Option<string>;
  recentlyMoved: Id[];
  /** A session just jumped to, flashed once to show where it is. */
  highlighted: Option<Id>;
}

export interface SessionJump {
  weekOffset: number;
  day: string;
  sessionId: Id;
}

interface WeekGridActions {
  previousWeek: () => void;
  nextWeek: () => void;
  thisWeek: () => void;
  jumpToSession: (jump: SessionJump) => void;
  clearHighlight: () => void;
  setPersonFilter: (id: Id) => void;
  clearPersonFilter: () => void;
  selectDay: (iso: string) => void;
  markMoved: (id: Id) => void;
  unmarkMoved: (id: Id) => void;
  clearMoved: () => void;
  resetWeekGrid: () => void;
}

export type WeekGridStore = WeekGridState & WeekGridActions;

const initialState: WeekGridState = {
  weekOffset: 0,
  personFilter: None,
  selectedDay: None,
  recentlyMoved: [],
  highlighted: None,
};

export const createWeekGridStore = () =>
  create<WeekGridStore>()(
    devtools(
      persist(
        (set) => ({
          ...initialState,
          previousWeek: () => set((s) => ({ weekOffset: s.weekOffset - 1, selectedDay: None, highlighted: None })),
          nextWeek: () => set((s) => ({ weekOffset: s.weekOffset + 1, selectedDay: None, highlighted: None })),
          thisWeek: () => set({ weekOffset: 0, selectedDay: None, highlighted: None }),
          jumpToSession: ({ weekOffset, day, sessionId }) =>
            set({ weekOffset, selectedDay: Some(day), highlighted: Some(sessionId) }),
          clearHighlight: () => set({ highlighted: None }),
          setPersonFilter: (id) => set({ personFilter: Some(id) }),
          clearPersonFilter: () => set({ personFilter: None }),
          selectDay: (iso) => set({ selectedDay: Some(iso) }),
          markMoved: (id) =>
            set((s) => (s.recentlyMoved.includes(id) ? s : { recentlyMoved: [...s.recentlyMoved, id] })),
          unmarkMoved: (id) => set((s) => ({ recentlyMoved: s.recentlyMoved.filter((m) => m !== id) })),
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
