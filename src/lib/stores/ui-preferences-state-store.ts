import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

interface UiPreferencesState {
  // Per-session record of the last transcription id the user has viewed.
  // Used to clear the transcript-ready badge dot once the panel is opened
  // and to suppress repeat "transcript ready" toasts on remount/reload.
  viewedTranscripts: Record<string, string>;
}

interface UiPreferencesActions {
  markTranscriptViewed: (sessionId: string, transcriptionId: string) => void;
  resetUiPreferences: () => void;
}

export type UiPreferencesStore = UiPreferencesState & UiPreferencesActions;

export const defaultInitState: UiPreferencesState = {
  viewedTranscripts: {},
};

export const createUiPreferencesStore = (
  initState: UiPreferencesState = defaultInitState
) => {
  return create<UiPreferencesStore>()(
    devtools(
      persist(
        (set) => ({
          ...initState,

          markTranscriptViewed: (sessionId, transcriptionId) => {
            set((prev) => ({
              viewedTranscripts: {
                ...prev.viewedTranscripts,
                [sessionId]: transcriptionId,
              },
            }));
          },

          resetUiPreferences: () => {
            set(defaultInitState);
          },
        }),
        {
          // Persisted in localStorage (survives logout, tab close, browser
          // restart). UI preferences describe how the user likes their UI,
          // not session state — they should outlive the session.
          name: "ui-preferences-store",
          storage: createJSONStorage(() => localStorage),
          version: 1,
        }
      )
    )
  );
};
