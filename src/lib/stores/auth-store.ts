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

          login: (userId, userSession) => {
            set({ isLoggedIn: true, userId, userSession });
          },
          logout: () => {
            console.warn('🚪 [AUTH-STORE] logout() called');
            console.warn('🚪 [AUTH-STORE] Before logout - isLoggedIn:', get().isLoggedIn);
            // Reset the in-memory state
            set(defaultInitState);
            console.warn('🚪 [AUTH-STORE] After logout - isLoggedIn:', get().isLoggedIn);
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
