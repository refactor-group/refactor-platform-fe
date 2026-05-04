import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import { SessionTimeWindow } from "@/components/ui/dashboard/coaching-sessions-filters";
import type { Id } from "@/types/general";

interface CoachingSessionsCardFilterState {
  timeWindow: SessionTimeWindow;
  relationshipFilter: Id | undefined;
}

interface CoachingSessionsCardFilterActions {
  setTimeWindow: (window: SessionTimeWindow) => void;
  setRelationshipFilter: (id: Id | undefined) => void;
  resetCoachingSessionsCardFilters: () => void;
}

export type CoachingSessionsCardFilterStore =
  CoachingSessionsCardFilterState & CoachingSessionsCardFilterActions;

export const defaultInitState: CoachingSessionsCardFilterState = {
  timeWindow: SessionTimeWindow.Day,
  relationshipFilter: undefined,
};

export const createCoachingSessionsCardFilterStore = (
  initState: CoachingSessionsCardFilterState = defaultInitState
) => {
  return create<CoachingSessionsCardFilterStore>()(
    devtools(
      persist(
        (set) => ({
          ...initState,

          setTimeWindow: (window: SessionTimeWindow) => {
            set({ timeWindow: window });
          },
          setRelationshipFilter: (id: Id | undefined) => {
            set({ relationshipFilter: id });
          },
          resetCoachingSessionsCardFilters: () => {
            set(defaultInitState);
          },
        }),
        {
          name: "coaching-sessions-card-filter-store",
          storage: createJSONStorage(() => sessionStorage),
          version: 1,
        }
      )
    )
  );
};
