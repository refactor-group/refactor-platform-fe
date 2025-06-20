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
  login: (userId: Id, userSession: UserSession) => void;
  logout: () => void;
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

          login: (userId, userSession) => {
            set({ isLoggedIn: true, userId, userSession });
          },
          logout: () => {
            set(defaultInitState);
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
        }
      )
    )
  );
  return authStore;
};
