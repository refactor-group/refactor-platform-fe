import { Id } from "@/types/general";
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

interface OrganizationState {
  currentOrganizationId: Id;
  lastOrganizationIdByUser: Record<Id, Id>;
}

interface OrganizationStateActions {
  setCurrentOrganizationId: (organizationId: Id) => void;
  rememberOrganizationForUser: (userId: Id, organizationId: Id) => void;
  resetOrganizationState(): void;
}

export type OrganizationStateStore = OrganizationState &
  OrganizationStateActions;

export const defaultInitState: OrganizationState = {
  currentOrganizationId: "",
  lastOrganizationIdByUser: {},
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
          rememberOrganizationForUser: (userId: Id, organizationId: Id) => {
            if (!userId || !organizationId) return;
            set({
              lastOrganizationIdByUser: {
                ...get().lastOrganizationIdByUser,
                [userId]: organizationId,
              },
            });
          },
          resetOrganizationState(): void {
            // Logout clears everything except the per-user choices.
            set({
              ...defaultInitState,
              lastOrganizationIdByUser: get().lastOrganizationIdByUser,
            });
          },
        }),
        {
          name: "organization-state-store",
          storage: createJSONStorage(() => localStorage),
          version: 2, // Switched from sessionStorage to localStorage for cross-session persistence
        }
      )
    )
  );
  return orgStateStore;
};
