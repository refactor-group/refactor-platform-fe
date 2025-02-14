import {
  CoachingRelationshipWithUserNames,
  defaultCoachingRelationshipsWithUserNames,
  defaultCoachingRelationshipWithUserNames,
  getCoachingRelationshipById,
} from "@/types/coaching_relationship_with_user_names";
import { Id } from "@/types/general";
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

interface CoachingRelationshipState {
  currentCoachingRelationshipId: Id;
  currentCoachingRelationship: CoachingRelationshipWithUserNames;
  currentCoachingRelationships: CoachingRelationshipWithUserNames[];
}

interface CoachingRelationshipStateActions {
  getCurrentCoachingRelationship: (
    coachingRelationshipId: Id
  ) => CoachingRelationshipWithUserNames;
  setCurrentCoachingRelationshipId: (newCoachingRelationshipId: Id) => void;
  setCurrentCoachingRelationship: (
    newCoachingRelationship: CoachingRelationshipWithUserNames
  ) => void;
  setCurrentCoachingRelationships: (
    newCoachingRelationships: CoachingRelationshipWithUserNames[]
  ) => void;
  resetCoachingRelationshipState(): void;
}

export type CoachingRelationshipStateStore = CoachingRelationshipState &
  CoachingRelationshipStateActions;

export const defaultInitState: CoachingRelationshipState = {
  currentCoachingRelationshipId: "",
  currentCoachingRelationship: defaultCoachingRelationshipWithUserNames(),
  currentCoachingRelationships: defaultCoachingRelationshipsWithUserNames(),
};

export const createCoachingRelationshipStateStore = (
  initState: CoachingRelationshipState = defaultInitState
) => {
  const relStateStore = create<CoachingRelationshipStateStore>()(
    devtools(
      persist(
        (set, get) => ({
          ...initState,

          // Expects the array of CoachingRelationshipsWithUserNames to be fetched and set
          getCurrentCoachingRelationship: (
            coachingRelationshipId: Id
          ): CoachingRelationshipWithUserNames => {
            return get().currentCoachingRelationships
              ? getCoachingRelationshipById(
                coachingRelationshipId,
                get().currentCoachingRelationships
              )
              : defaultCoachingRelationshipWithUserNames();
          },
          setCurrentCoachingRelationshipId: (newCoachingRelationshipId) => {
            set({ currentCoachingRelationshipId: newCoachingRelationshipId });
          },
          setCurrentCoachingRelationship: (newCoachingRelationship) => {
            set({ currentCoachingRelationship: newCoachingRelationship });
          },
          // Reminder: This isn't being used
          setCurrentCoachingRelationships: (
            newCoachingRelationships: CoachingRelationshipWithUserNames[]
          ) => {
            set({ currentCoachingRelationships: newCoachingRelationships });
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
