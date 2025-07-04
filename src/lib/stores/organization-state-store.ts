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
            set(defaultInitState);
          },
        }),
        {
          name: "organization-state-store",
          storage: createJSONStorage(() => sessionStorage),
        }
      )
    )
  );
  return orgStateStore;
};