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
  // Week (±7 days) instead of Day. Coaching cadence is weekly, so a 24-hour
  // window left common cases (like a session two days out) silently invisible
  // until the user discovered the Filters popover. Week matches users'
  // natural mental scheduling unit and surfaces near-term sessions on first
  // load. The fetch cost difference is negligible at typical session counts.
  timeWindow: SessionTimeWindow.Week,
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
          // Persisted in sessionStorage (cleared on tab close, survives in-tab
          // navigation + reload). Explicitly reset on logout via
          // `useLogoutUser` so a different user logging in on the same tab
          // doesn't inherit the previous user's filter selection. The card's
          // cleanup effect (`coaching-sessions-card.tsx`) is a secondary
          // safety net for the rare case where a `relationshipFilter` id
          // becomes stale within a single session (e.g. relationship deleted
          // in another tab).
          name: "coaching-sessions-card-filter-store",
          storage: createJSONStorage(() => sessionStorage),
          version: 1,
        }
      )
    )
  );
};
