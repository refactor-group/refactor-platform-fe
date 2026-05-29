import type { PanelSection } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";

// A note's selected text destined for a single form field (body or title).
// The nonce lets a consumer apply the same text once per distinct selection.
export interface NoteField {
  text: string;
  nonce: number;
}

// Page → panel signal: which add-flow to open, with the selected text.
export interface NoteSelection {
  section: PanelSection;
  text: string;
  nonce: number;
}
