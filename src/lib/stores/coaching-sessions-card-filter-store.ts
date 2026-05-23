import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";
import type { Id } from "@/types/general";

interface CoachingSessionsCardFilterState {
  relationshipFilter: Id | undefined;
}

interface CoachingSessionsCardFilterActions {
  setRelationshipFilter: (id: Id | undefined) => void;
  resetCoachingSessionsCardFilters: () => void;
}

export type CoachingSessionsCardFilterStore =
  CoachingSessionsCardFilterState & CoachingSessionsCardFilterActions;

export const defaultInitState: CoachingSessionsCardFilterState = {
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
          version: 2,
          // v1 → v2: dropped legacy `timeWindow` field (replaced by calendar
          // bucket pagination, which makes a single time-range filter
          // redundant). Migration strips the stale key from persisted state
          // so old tabs hydrate cleanly without console errors.
          migrate: (persistedState, version) => {
            if (version < 2 && persistedState && typeof persistedState === "object") {
              const { timeWindow: _legacyTimeWindow, ...rest } =
                persistedState as Record<string, unknown>;
              return { ...defaultInitState, ...rest };
            }
            return persistedState as CoachingSessionsCardFilterState;
          },
        }
      )
    )
  );
};
