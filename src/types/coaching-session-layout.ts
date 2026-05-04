/**
 * Layout state for the coaching session page.
 *
 * The page has three panels — Goals, Transcript, Notes. `FocusedPanel`
 * models a single-winner focus mode: at most one panel can be maximized
 * at a time, which lets callers treat the three maximized-state
 * combinations as a single union instead of juggling independent
 * booleans.
 *
 * Goals collapsed/expanded starts from a default derived from the other
 * state fields (see `defaultGoalsCollapsed` in `use-coaching-session-layout`)
 * but is user-overridable — clicking the rail expands Goals even while
 * the transcript is open.
 */
export enum FocusedPanel {
  None = "none",
  Notes = "notes",
  Transcript = "transcript",
}

export function isFocusedPanel(value: string): value is FocusedPanel {
  return (
    value === FocusedPanel.None ||
    value === FocusedPanel.Notes ||
    value === FocusedPanel.Transcript
  );
}
