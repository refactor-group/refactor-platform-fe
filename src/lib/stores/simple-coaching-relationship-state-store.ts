import { Id } from "@/types/general";
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

interface SimpleCoachingRelationshipState {
  currentCoachingRelationshipId: Id;
}

interface SimpleCoachingRelationshipStateActions {
  setCurrentCoachingRelationshipId: (relationshipId: Id) => void;
  resetCoachingRelationshipState(): void;
}

export type SimpleCoachingRelationshipStateStore = SimpleCoachingRelationshipState &
  SimpleCoachingRelationshipStateActions;

export const defaultInitState: SimpleCoachingRelationshipState = {
  currentCoachingRelationshipId: "",
};

export const createSimpleCoachingRelationshipStateStore = (
  initState: SimpleCoachingRelationshipState = defaultInitState
) => {
  const relStateStore = create<SimpleCoachingRelationshipStateStore>()(
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
          name: "simple-coaching-relationship-state-store",
          storage: createJSONStorage(() => sessionStorage),
        }
      )
    )
  );
  return relStateStore;
};