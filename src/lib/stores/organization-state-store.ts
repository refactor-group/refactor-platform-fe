import { Id } from "@/types/general";
import { getOrganizationById } from "@/types/organization";
import {
  defaultOrganization,
  defaultOrganizations,
  Organization,
} from "@/types/organization";
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

interface OrganizationState {
  currentOrganizationId: Id;
  currentOrganization: Organization;
  currentOrganizations: Organization[];
}

interface OrganizationStateActions {
  getCurrentOrganization: (organizationId: Id) => Organization;
  setCurrentOrganizationId: (newOrganizationId: Id) => void;
  setCurrentOrganization: (newOrganization: Organization) => void;
  setCurrentOrganizations: (newOrganizations: Organization[]) => void;
  resetOrganizationState(): void;
}

export type OrganizationStateStore = OrganizationState &
  OrganizationStateActions;

export const defaultInitState: OrganizationState = {
  currentOrganizationId: "",
  currentOrganization: defaultOrganization(),
  currentOrganizations: defaultOrganizations(),
};

export const createOrganizationStateStore = (
  initState: OrganizationState = defaultInitState
) => {
  const orgStateStore = create<OrganizationStateStore>()(
    devtools(
      persist(
        (set, get) => ({
          ...initState,

          // Expects the array of Organizations to be fetched and set
          getCurrentOrganization: (organizationId: Id): Organization => {
            return get().currentOrganizations
              ? getOrganizationById(organizationId, get().currentOrganizations)
              : defaultOrganization();
          },
          setCurrentOrganizationId: (newOrganizationId) => {
            set({ currentOrganizationId: newOrganizationId });
          },
          setCurrentOrganization: (newOrganization) => {
            set({
              currentOrganization: newOrganization,
              currentOrganizationId: newOrganization.id,
            });
          },
          setCurrentOrganizations: (newOrganizations: Organization[]) => {
            set({ currentOrganizations: newOrganizations });
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
