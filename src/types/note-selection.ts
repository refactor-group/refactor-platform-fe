import type { PanelSection } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";

// A note's selected text destined for a single form field (body or title).
// The nonce lets a consumer apply the same text once per distinct selection.
export interface NoteField {
  text: string;
  nonce: number;
}

// Page → panel signal: a NoteField destined for a specific section's
// add-flow. Extending NoteField makes the seed conversion (a NoteSelection IS
// a NoteField plus a section) type-checked rather than reconstructed by hand.
export interface NoteSelection extends NoteField {
  section: PanelSection;
}
