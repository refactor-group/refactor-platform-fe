import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface WeekGridState {
  weekOffset: number;
}

interface WeekGridActions {
  previousWeek: () => void;
  nextWeek: () => void;
  thisWeek: () => void;
}

export type WeekGridStore = WeekGridState & WeekGridActions;

export const createWeekGridStore = () =>
  create<WeekGridStore>()(
    devtools((set) => ({
      weekOffset: 0,
      previousWeek: () => set((s) => ({ weekOffset: s.weekOffset - 1 })),
      nextWeek: () => set((s) => ({ weekOffset: s.weekOffset + 1 })),
      thisWeek: () => set({ weekOffset: 0 }),
    }))
  );
