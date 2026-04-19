/**
 * Layout state for the coaching session page.
 *
 * The page has three panes — Goals, Transcript, Notes. `FocusedPane` models
 * a single-winner focus mode: at most one pane can be maximized at a time,
 * which lets callers treat the three maximized-state combinations as a single
 * union instead of juggling independent booleans.
 *
 * Goals collapsed/expanded is derived from the other two state fields rather
 * than stored separately — see `isGoalsCollapsed` in
 * `use-coaching-session-layout`.
 */
export enum FocusedPane {
  None = "none",
  Notes = "notes",
  Transcript = "transcript",
}

export function isFocusedPane(value: string): value is FocusedPane {
  return (
    value === FocusedPane.None ||
    value === FocusedPane.Notes ||
    value === FocusedPane.Transcript
  );
}
