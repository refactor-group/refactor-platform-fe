import { Id } from "@/types/general";
import { defaultUserSession, UserSession } from "@/types/user-session";
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

interface AuthState {
  // Holds user id UUID from the backend DB schema for a User
  userId: Id;
  userSession: UserSession;
  isLoggedIn: boolean;
  isCurrentCoach: boolean;
  isACoach: boolean;
}

interface AuthActions {
  syncUserSession: (userId: Id, userSession: UserSession) => void;
  login: (userId: Id, userSession: UserSession) => void;
  logout: () => void;
  setTimezone: (timezone: string) => void;
  setIsCurrentCoach: (coachID: Id) => void;
  getIsCurrentCoach: () => boolean;
  setIsACoach: (isACoach: boolean) => void;
  getIsACoach: () => boolean;
}

export type AuthStore = AuthState & AuthActions;

export const defaultInitState: AuthState = {
  userId: "",
  userSession: defaultUserSession(),
  isLoggedIn: false,
  isCurrentCoach: false,
  isACoach: false,
};

export const createAuthStore = (initState: AuthState = defaultInitState) => {
  const authStore = create<AuthStore>()(
    devtools(
      persist(
        (set, get) => ({
          ...initState,

          // Only `POST /login` and `GET /users/{id}` for the signed-in user are
          // valid sources: they alone return every role the user holds. An
          // org-scoped payload filters `roles` to one organization, so seeding
          // from one would erase the user's other memberships — persisted.
          syncUserSession: (userId, userSession) => {
            set({ isLoggedIn: true, userId, userSession });
          },
          login: (userId, userSession) => {
            get().syncUserSession(userId, userSession);
          },
          logout: () => {
            set(defaultInitState);
          },
          setTimezone: (timezone) => {
            set((state) => ({
              userSession: { ...state.userSession, timezone }
            }));
          },
          setIsCurrentCoach: (coachId) => {
            var userId = get().userId;
            set({ isCurrentCoach: !!(userId && coachId && userId == coachId) });
          },
          getIsCurrentCoach: () => {
            return get().isCurrentCoach;
          },
          setIsACoach: (isACoach: boolean) => {
            set({ isACoach });
          },
          getIsACoach: () => {
            return get().isACoach;
          },
        }),
        {
          name: "auth-store",
          storage: createJSONStorage(() => localStorage),
          version: 2, // Increment version to force rehydration with new setTimezone function
        }
      )
    )
  );
  return authStore;
};
