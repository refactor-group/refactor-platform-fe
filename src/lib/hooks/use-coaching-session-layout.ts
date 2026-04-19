"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";

import { FocusedPanel, isFocusedPanel } from "@/types/coaching-session-layout";

/**
 * URL is the source of truth for the coaching session's panel visibility
 * and focus mode. The hook reads state from `useSearchParams` and writes
 * it back via `router.replace`, so links and refreshes both round-trip
 * cleanly.
 *
 * URL params owned here:
 *   `?focus=notes|transcript`  → which panel is maximized
 *   `?transcript=1`            → whether the transcript panel is open
 *
 * The existing `?panel=` param (Goals/Agreements/Actions section) is
 * owned elsewhere and left untouched.
 *
 * The Goals-collapsed state is transient (not URL-backed) — it starts
 * from a derived default but the user can override it by clicking the
 * rail. See `defaultGoalsCollapsed` below.
 */

const TRANSCRIPT_PARAM = "transcript";
const FOCUS_PARAM = "focus";

export interface CoachingSessionLayout {
  focusedPanel: FocusedPanel;
  isTranscriptOpen: boolean;
  /**
   * Whether the Goals panel is currently collapsed to its thin rail.
   * Auto-collapses when the transcript opens or a focus mode activates,
   * and the user can override at any time via `toggleGoalsCollapsed`.
   */
  isGoalsCollapsed: boolean;

  // Derived
  isNotesMaximized: boolean;
  isTranscriptMaximized: boolean;

  // Actions
  openTranscript: () => void;
  closeTranscript: () => void;
  toggleTranscript: () => void;
  toggleNotesMaximized: () => void;
  toggleTranscriptMaximized: () => void;
  toggleGoalsCollapsed: () => void;
}

export function useCoachingSessionLayout(): CoachingSessionLayout {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { focusedPanel, isTranscriptOpen } = readLayoutFromParams(searchParams);

  // Goals-collapsed is transient UI state — not URL-backed — so the user's
  // manual expansion survives unrelated re-renders, but a fresh
  // transcript-open action still defaults to collapsed.
  const [isGoalsCollapsed, setGoalsCollapsed] = useState<boolean>(
    defaultGoalsCollapsed(focusedPanel, isTranscriptOpen)
  );

  // Reset collapse state to match the derived default whenever the layout
  // context changes. Opening the transcript auto-collapses Goals (matching
  // the default), but once the user expands manually, subsequent re-renders
  // don't override that until the context genuinely shifts again.
  useEffect(() => {
    setGoalsCollapsed(defaultGoalsCollapsed(focusedPanel, isTranscriptOpen));
  }, [focusedPanel, isTranscriptOpen]);

  const toggleGoalsCollapsed = useCallback(() => {
    setGoalsCollapsed((prev) => !prev);
  }, []);

  const writeLayout = useCallback(
    (nextFocus: FocusedPanel, nextTranscriptOpen: boolean) => {
      const url = buildLayoutUrl(pathname, searchParams, nextFocus, nextTranscriptOpen);
      router.replace(url, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const openTranscript = useCallback(() => {
    // Opening the transcript clears Notes-focused mode — otherwise the panel
    // would open behind a maximized Notes and the click would appear to do
    // nothing. Transcript-focused mode is preserved (that's the panel we're
    // opening).
    const nextFocus =
      focusedPanel === FocusedPanel.Notes ? FocusedPanel.None : focusedPanel;
    writeLayout(nextFocus, true);
  }, [writeLayout, focusedPanel]);

  const closeTranscript = useCallback(() => {
    // Closing the panel also clears transcript-focused mode — you cannot
    // be "maximizing" a panel that isn't shown.
    const nextFocus =
      focusedPanel === FocusedPanel.Transcript ? FocusedPanel.None : focusedPanel;
    writeLayout(nextFocus, false);
  }, [writeLayout, focusedPanel]);

  const toggleTranscript = useCallback(() => {
    if (isTranscriptOpen) closeTranscript();
    else openTranscript();
  }, [isTranscriptOpen, openTranscript, closeTranscript]);

  const toggleNotesMaximized = useCallback(() => {
    const isOn = focusedPanel === FocusedPanel.Notes;
    // The transcript's open/closed intent is preserved through the toggle —
    // the user's desire to see the transcript shouldn't be forgotten just
    // because Notes is temporarily taking the floor. Restoring returns
    // the 3-col layout with the transcript still open.
    writeLayout(isOn ? FocusedPanel.None : FocusedPanel.Notes, isTranscriptOpen);
  }, [writeLayout, focusedPanel, isTranscriptOpen]);

  const toggleTranscriptMaximized = useCallback(() => {
    const isOn = focusedPanel === FocusedPanel.Transcript;
    // Maximizing the transcript requires the panel to be open; restoring
    // leaves it open.
    writeLayout(isOn ? FocusedPanel.None : FocusedPanel.Transcript, true);
  }, [writeLayout, focusedPanel]);

  return {
    focusedPanel,
    isTranscriptOpen,
    isGoalsCollapsed,
    isNotesMaximized: focusedPanel === FocusedPanel.Notes,
    isTranscriptMaximized: focusedPanel === FocusedPanel.Transcript,
    openTranscript,
    closeTranscript,
    toggleTranscript,
    toggleNotesMaximized,
    toggleTranscriptMaximized,
    toggleGoalsCollapsed,
  };
}

function readLayoutFromParams(
  searchParams: ReadonlyURLSearchParams
): { focusedPanel: FocusedPanel; isTranscriptOpen: boolean } {
  const rawFocus = searchParams.get(FOCUS_PARAM);
  const focusedPanel =
    rawFocus && isFocusedPanel(rawFocus) ? rawFocus : FocusedPanel.None;
  const isTranscriptOpen = searchParams.get(TRANSCRIPT_PARAM) === "1";
  return { focusedPanel, isTranscriptOpen };
}

function buildLayoutUrl(
  pathname: string,
  existing: ReadonlyURLSearchParams,
  focusedPanel: FocusedPanel,
  isTranscriptOpen: boolean
): string {
  const next = new URLSearchParams(existing);
  writeFocusParam(next, focusedPanel);
  writeTranscriptParam(next, isTranscriptOpen);
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function writeFocusParam(params: URLSearchParams, focusedPanel: FocusedPanel): void {
  if (focusedPanel === FocusedPanel.None) params.delete(FOCUS_PARAM);
  else params.set(FOCUS_PARAM, focusedPanel);
}

function writeTranscriptParam(params: URLSearchParams, isOpen: boolean): void {
  if (isOpen) params.set(TRANSCRIPT_PARAM, "1");
  else params.delete(TRANSCRIPT_PARAM);
}

/**
 * Default collapse decision when the layout context changes. Matches the
 * long-standing "rail when something else takes the floor" behavior — a
 * focus mode is active, or the transcript is sharing the workspace.
 */
function defaultGoalsCollapsed(
  focusedPanel: FocusedPanel,
  isTranscriptOpen: boolean
): boolean {
  return focusedPanel !== FocusedPanel.None || isTranscriptOpen;
}
