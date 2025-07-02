import { Id } from "@/types/general";
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

interface SimpleOrganizationState {
  currentOrganizationId: Id;
}

interface SimpleOrganizationStateActions {
  setCurrentOrganizationId: (organizationId: Id) => void;
  resetOrganizationState(): void;
}

export type SimpleOrganizationStateStore = SimpleOrganizationState &
  SimpleOrganizationStateActions;

export const defaultInitState: SimpleOrganizationState = {
  currentOrganizationId: "",
};

export const createSimpleOrganizationStateStore = (
  initState: SimpleOrganizationState = defaultInitState
) => {
  const orgStateStore = create<SimpleOrganizationStateStore>()(
    devtools(
      persist(
        (set, get) => ({
          ...initState,

          setCurrentOrganizationId: (organizationId: Id) => {
            set({ currentOrganizationId: organizationId });
          },
          resetOrganizationState(): void {
            set(defaultInitState);
          },
        }),
        {
          name: "simple-organization-state-store",
          storage: createJSONStorage(() => sessionStorage),
        }
      )
    )
  );
  return orgStateStore;
};