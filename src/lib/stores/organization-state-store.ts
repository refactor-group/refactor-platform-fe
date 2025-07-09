import { Id } from "@/types/general";
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

interface OrganizationState {
  currentOrganizationId: Id;
}

interface OrganizationStateActions {
  setCurrentOrganizationId: (organizationId: Id) => void;
  resetOrganizationState(): void;
}

export type OrganizationStateStore = OrganizationState &
  OrganizationStateActions;

export const defaultInitState: OrganizationState = {
  currentOrganizationId: "",
};

export const createOrganizationStateStore = (
  initState: OrganizationState = defaultInitState
) => {
  const orgStateStore = create<OrganizationStateStore>()(
    devtools(
      persist(
        (set, get) => ({
          ...initState,

          setCurrentOrganizationId: (organizationId: Id) => {
            set({ currentOrganizationId: organizationId });
          },
          resetOrganizationState(): void {
            // Then reset the in-memory state
            set(defaultInitState);
          },
        }),
        {
          name: "organization-state-store",
          storage: createJSONStorage(() => sessionStorage),
          version: 1, // Increment version to force clear of old incompatible data
        }
      )
    )
  );
  return orgStateStore;
};
