import { useCallback, useEffect, useRef, useState } from "react";
import { type Option, Some, None } from "@/types/option";
import type { NoteSelection } from "@/types/note-selection";
import { PanelSection } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";

export interface UseAddFromNotesParams {
  /** Whether the panel column is currently collapsed. */
  isGoalsCollapsed: boolean;
  /** Expands the panel column. */
  toggleGoalsCollapsed: () => void;
  /** Writes ?panel=<section> to the URL. */
  pinSection: (section: PanelSection) => void;
}

export interface UseAddFromNotesResult {
  selection: Option<NoteSelection>;
  addFromNote: (section: PanelSection, text: string) => void;
}

/**
 * Bridges the notes "Add as …" affordance to the panel: a trimmed selection
 * becomes a {@link NoteSelection} carrying its target section, bumping a
 * monotonic nonce so the panel reacts once per selection. The section is
 * pinned to the URL once per nonce, but only after the panel is expanded —
 * gating on `!isGoalsCollapsed` avoids clobbering the layout's
 * focus/transcript params on the same tick.
 */
export function useAddFromNotes({
  isGoalsCollapsed,
  toggleGoalsCollapsed,
  pinSection,
}: UseAddFromNotesParams): UseAddFromNotesResult {
  const [selection, setSelection] = useState<Option<NoteSelection>>(None);
  const nonceRef = useRef(0);
  const pinnedNonce = useRef(0);

  const addFromNote = useCallback(
    (section: PanelSection, text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (isGoalsCollapsed) toggleGoalsCollapsed();
      nonceRef.current += 1;
      setSelection(Some({ section, text: trimmed, nonce: nonceRef.current }));
    },
    [isGoalsCollapsed, toggleGoalsCollapsed]
  );

  useEffect(() => {
    if (!selection.some || isGoalsCollapsed) return;
    if (selection.val.nonce === pinnedNonce.current) return;
    pinnedNonce.current = selection.val.nonce;
    pinSection(selection.val.section);
  }, [selection, isGoalsCollapsed, pinSection]);

  return { selection, addFromNote };
}
