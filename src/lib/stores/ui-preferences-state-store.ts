import { create } from "zustand";
import { createJSONStorage, devtools, persist } from "zustand/middleware";

/**
 * User-facing UI preferences (pane widths, layout toggles, etc.).
 *
 * Unlike the other state stores in this directory, this one persists to
 * `localStorage` rather than `sessionStorage`. Rationale: these are
 * workflow preferences — how the user likes their UI — not session-scoped
 * auth or entity state. They should survive logout, tab close, and
 * browser restart so the user doesn't have to re-tune their layout every
 * time they come back.
 */

/** Default docked-view transcript column width, in CSS pixels. */
export const DEFAULT_TRANSCRIPT_PANE_WIDTH = 440;
/** Readability floor for the transcript column. */
export const MIN_TRANSCRIPT_PANE_WIDTH = 280;
/** Keeps ~400px available for Notes on standard 1440px desktops. */
export const MAX_TRANSCRIPT_PANE_WIDTH = 700;

interface UIPreferencesState {
  transcriptPaneWidth: number;
}

interface UIPreferencesActions {
  setTranscriptPaneWidth: (width: number) => void;
  resetUIPreferences: () => void;
}

export type UIPreferencesStateStore = UIPreferencesState & UIPreferencesActions;

export const defaultInitState: UIPreferencesState = {
  transcriptPaneWidth: DEFAULT_TRANSCRIPT_PANE_WIDTH,
};

export const createUIPreferencesStateStore = (
  initState: UIPreferencesState = defaultInitState
) => {
  return create<UIPreferencesStateStore>()(
    devtools(
      persist(
        (set) => ({
          ...initState,

          setTranscriptPaneWidth: (width: number) => {
            set({ transcriptPaneWidth: clampTranscriptPaneWidth(width) });
          },
          resetUIPreferences: () => {
            set(defaultInitState);
          },
        }),
        {
          name: "ui-preferences-state-store",
          storage: createJSONStorage(() => localStorage),
          version: 1,
        }
      )
    )
  );
};

/**
 * Clamps a raw pane width to the allowed range, silently correcting
 * out-of-range or non-finite values rather than throwing. Callers can
 * pass unvalidated input (e.g. a raw pointer-move delta) and trust that
 * the store never ends up in an invalid state.
 */
export function clampTranscriptPaneWidth(width: number): number {
  if (!Number.isFinite(width)) return DEFAULT_TRANSCRIPT_PANE_WIDTH;
  if (width < MIN_TRANSCRIPT_PANE_WIDTH) return MIN_TRANSCRIPT_PANE_WIDTH;
  if (width > MAX_TRANSCRIPT_PANE_WIDTH) return MAX_TRANSCRIPT_PANE_WIDTH;
  return width;
}
