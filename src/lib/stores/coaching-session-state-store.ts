import {
  CoachingSession,
  defaultCoachingSession,
  defaultCoachingSessions,
  getCoachingSessionById,
} from "@/types/coaching-session";
import { Id } from "@/types/general";
import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

interface CoachingSessionState {
  currentCoachingSessionId: Id;
  currentCoachingSession: CoachingSession;
  currentCoachingSessions: CoachingSession[];
}

interface CoachingSessionsStateActions {
  getCurrentCoachingSession: (coachingSessionId: Id) => CoachingSession;
  getCurrentCoachingSessionId: () => Id;
  setCurrentCoachingSessionId: (newCoachingSessionId: Id) => void;
  setCurrentCoachingSession: (newCoachingSession: CoachingSession) => void;
  setCurrentCoachingSessions: (newCoachingSessions: CoachingSession[]) => void;
  resetCoachingSessionState(): void;
}

export type CoachingSessionStateStore = CoachingSessionState &
  CoachingSessionsStateActions;

export const defaultInitState: CoachingSessionState = {
  currentCoachingSessionId: "",
  currentCoachingSession: defaultCoachingSession(),
  currentCoachingSessions: defaultCoachingSessions(),
};

export const createCoachingSessionStateStore = (
  initState: CoachingSessionState = defaultInitState
) => {
  const sessionStateStore = create<CoachingSessionStateStore>()(
    devtools(
      persist(
        (set, get) => ({
          ...initState,

          // Expects the array of CoachingSessions to be fetched and set
          getCurrentCoachingSession: (
            coachingSessionId: Id
          ): CoachingSession => {
            return get().currentCoachingSessions
              ? getCoachingSessionById(
                coachingSessionId,
                get().currentCoachingSessions
              )
              : defaultCoachingSession();
          },
          getCurrentCoachingSessionId: () => {
            return get().currentCoachingSessionId;
          },
          setCurrentCoachingSessionId: (newCoachingSessionId) => {
            set({ currentCoachingSessionId: newCoachingSessionId });
          },
          setCurrentCoachingSession: (newCoachingSession) => {
            set({
              currentCoachingSession: newCoachingSession,
              currentCoachingSessionId: newCoachingSession.id,
            });
          },
          setCurrentCoachingSessions: (
            newCoachingSessions: CoachingSession[]
          ) => {
            set({ currentCoachingSessions: newCoachingSessions });
          },
          resetCoachingSessionState(): void {
            set(defaultInitState);
          },
        }),
        {
          name: "coaching-session-state-store",
          storage: createJSONStorage(() => sessionStorage),
        }
      )
    )
  );
  return sessionStateStore;
};
