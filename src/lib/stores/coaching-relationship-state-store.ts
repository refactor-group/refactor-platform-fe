import { Id } from "@/types/general";
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

interface CoachingRelationshipState {
  currentCoachingRelationshipId: Id;
}

interface CoachingRelationshipStateActions {
  setCurrentCoachingRelationshipId: (relationshipId: Id) => void;
  resetCoachingRelationshipState(): void;
}

export type CoachingRelationshipStateStore = CoachingRelationshipState &
  CoachingRelationshipStateActions;

export const defaultInitState: CoachingRelationshipState = {
  currentCoachingRelationshipId: "",
};

export const createCoachingRelationshipStateStore = (
  initState: CoachingRelationshipState = defaultInitState
) => {
  const relStateStore = create<CoachingRelationshipStateStore>()(
    devtools(
      persist(
        (set, get) => ({
          ...initState,

          setCurrentCoachingRelationshipId: (relationshipId: Id) => {
            set({ currentCoachingRelationshipId: relationshipId });
          },
          resetCoachingRelationshipState(): void {
            set(defaultInitState);
          },
        }),
        {
          name: "coaching-relationship-state-store",
          storage: createJSONStorage(() => sessionStorage),
        }
      )
    )
  );
  return relStateStore;
};