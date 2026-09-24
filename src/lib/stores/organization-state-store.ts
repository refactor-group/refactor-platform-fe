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
  forgetOrganizationForUser: (userId: Id) => void;
  resetOrganizationState(): void;
}

export type OrganizationStateStore = OrganizationState &
  OrganizationStateActions;

// Bounds what a shared browser accumulates; the oldest choice is dropped first.
export const MAX_REMEMBERED_USERS = 10;

function withoutUser(remembered: Record<Id, Id>, userId: Id): Record<Id, Id> {
  return Object.fromEntries(
    Object.entries(remembered).filter(([id]) => id !== userId)
  );
}

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
            // Re-inserting moves the user to the most recent end.
            const entries = Object.entries({
              ...withoutUser(get().lastOrganizationIdByUser, userId),
              [userId]: organizationId,
            });
            set({
              lastOrganizationIdByUser: Object.fromEntries(
                entries.slice(-MAX_REMEMBERED_USERS)
              ),
            });
          },
          forgetOrganizationForUser: (userId: Id) => {
            set({
              lastOrganizationIdByUser: withoutUser(get().lastOrganizationIdByUser, userId),
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
