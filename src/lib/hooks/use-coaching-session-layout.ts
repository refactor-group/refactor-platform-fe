"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";

import { FocusedPane, isFocusedPane } from "@/types/coaching-session-layout";

/**
 * URL is the source of truth for all coaching session layout state.
 * The hook reads state from `useSearchParams` and writes it back via
 * `router.replace`, so links and refreshes both round-trip cleanly.
 *
 * URL params owned here:
 *   `?focus=notes|transcript`  → which pane is maximized
 *   `?transcript=1`            → whether the transcript pane is open
 *
 * The existing `?panel=` param is owned elsewhere and left untouched.
 */

const TRANSCRIPT_PARAM = "transcript";
const FOCUS_PARAM = "focus";

export interface CoachingSessionLayout {
  focusedPane: FocusedPane;
  isTranscriptOpen: boolean;

  // Derived
  isGoalsCollapsed: boolean;
  isNotesMaximized: boolean;
  isTranscriptMaximized: boolean;

  // Actions
  openTranscript: () => void;
  closeTranscript: () => void;
  toggleTranscript: () => void;
  toggleNotesMaximized: () => void;
  toggleTranscriptMaximized: () => void;
}

export function useCoachingSessionLayout(): CoachingSessionLayout {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { focusedPane, isTranscriptOpen } = readLayoutFromParams(searchParams);

  const writeLayout = useCallback(
    (nextFocus: FocusedPane, nextTranscriptOpen: boolean) => {
      const url = buildLayoutUrl(pathname, searchParams, nextFocus, nextTranscriptOpen);
      router.replace(url, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const openTranscript = useCallback(() => {
    // Opening the transcript clears Notes-focused mode — otherwise the pane
    // would open behind a maximized Notes and the click would appear to do
    // nothing. Transcript-focused mode is preserved (that's the pane we're
    // opening).
    const nextFocus =
      focusedPane === FocusedPane.Notes ? FocusedPane.None : focusedPane;
    writeLayout(nextFocus, true);
  }, [writeLayout, focusedPane]);

  const closeTranscript = useCallback(() => {
    // Closing the pane also clears transcript-focused mode — you cannot be
    // "maximizing" a pane that isn't shown.
    const nextFocus = focusedPane === FocusedPane.Transcript ? FocusedPane.None : focusedPane;
    writeLayout(nextFocus, false);
  }, [writeLayout, focusedPane]);

  const toggleTranscript = useCallback(() => {
    if (isTranscriptOpen) closeTranscript();
    else openTranscript();
  }, [isTranscriptOpen, openTranscript, closeTranscript]);

  const toggleNotesMaximized = useCallback(() => {
    const isOn = focusedPane === FocusedPane.Notes;
    // Maximizing Notes closes the transcript; restoring leaves transcript closed.
    writeLayout(isOn ? FocusedPane.None : FocusedPane.Notes, false);
  }, [writeLayout, focusedPane]);

  const toggleTranscriptMaximized = useCallback(() => {
    const isOn = focusedPane === FocusedPane.Transcript;
    // Maximizing the transcript requires the pane to be open; restoring leaves it open.
    writeLayout(isOn ? FocusedPane.None : FocusedPane.Transcript, true);
  }, [writeLayout, focusedPane]);

  return {
    focusedPane,
    isTranscriptOpen,
    isGoalsCollapsed: deriveGoalsCollapsed(focusedPane, isTranscriptOpen),
    isNotesMaximized: focusedPane === FocusedPane.Notes,
    isTranscriptMaximized: focusedPane === FocusedPane.Transcript,
    openTranscript,
    closeTranscript,
    toggleTranscript,
    toggleNotesMaximized,
    toggleTranscriptMaximized,
  };
}

function readLayoutFromParams(
  searchParams: ReadonlyURLSearchParams
): { focusedPane: FocusedPane; isTranscriptOpen: boolean } {
  const rawFocus = searchParams.get(FOCUS_PARAM);
  const focusedPane =
    rawFocus && isFocusedPane(rawFocus) ? rawFocus : FocusedPane.None;
  const isTranscriptOpen = searchParams.get(TRANSCRIPT_PARAM) === "1";
  return { focusedPane, isTranscriptOpen };
}

function buildLayoutUrl(
  pathname: string,
  existing: ReadonlyURLSearchParams,
  focusedPane: FocusedPane,
  isTranscriptOpen: boolean
): string {
  const next = new URLSearchParams(existing);
  writeFocusParam(next, focusedPane);
  writeTranscriptParam(next, isTranscriptOpen);
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

function writeFocusParam(params: URLSearchParams, focusedPane: FocusedPane): void {
  if (focusedPane === FocusedPane.None) params.delete(FOCUS_PARAM);
  else params.set(FOCUS_PARAM, focusedPane);
}

function writeTranscriptParam(params: URLSearchParams, isOpen: boolean): void {
  if (isOpen) params.set(TRANSCRIPT_PARAM, "1");
  else params.delete(TRANSCRIPT_PARAM);
}

function deriveGoalsCollapsed(
  focusedPane: FocusedPane,
  isTranscriptOpen: boolean
): boolean {
  // Goals collapses to its rail whenever any other pane is taking the floor:
  // either a focus mode is active, or the transcript is sharing space.
  return focusedPane !== FocusedPane.None || isTranscriptOpen;
}
