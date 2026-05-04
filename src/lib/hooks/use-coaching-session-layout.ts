"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";

import { FocusedPanel, isFocusedPanel } from "@/types/coaching-session-layout";

// ── Coaching session layout state machine ──────────────────────────────
//
// Models the valid shapes of the coaching session page as a discriminated
// union. Follows the same idiom as `goal-flow.ts` — a tagged union for
// states, inline transition functions, and a hook that exposes derived
// fields plus action callbacks.
//
// URL is still the source of truth for `focusedPanel` and
// `isTranscriptOpen`. The Docked state's `goalsExpanded` flag is a
// transient in-memory override (not URL-backed) — it only matters while
// the transcript is docked and there's no other reason to persist it
// across sessions or deep links.

export enum LayoutShape {
  Default = "default",                         // [ goals | notes ]
  NotesMaximized = "notes-maximized",          // [ rail  | notes ]
  TranscriptMaximized = "transcript-maximized", // [ rail  | transcript ]
  Docked = "docked",                           // [ rail|goals | transcript | notes ]
}

export type LayoutState =
  | { shape: LayoutShape.Default }
  | {
      shape: LayoutShape.NotesMaximized;
      /** True when the user had the transcript open before maximizing Notes. Restoring returns to Docked. */
      transcriptPending: boolean;
    }
  | { shape: LayoutShape.TranscriptMaximized }
  | {
      shape: LayoutShape.Docked;
      /** User-controlled override — defaults to `false` (collapsed rail). */
      goalsExpanded: boolean;
    };

// ── Pure transitions ──────────────────────────────────────────────────
// Each transition is a pure function exported for unit testing. The
// hook composes them with URL + in-memory I/O.

export function afterOpenTranscript(state: LayoutState): LayoutState {
  switch (state.shape) {
    case LayoutShape.Default:
      return { shape: LayoutShape.Docked, goalsExpanded: false };
    case LayoutShape.NotesMaximized:
      return { shape: LayoutShape.Docked, goalsExpanded: false };
    case LayoutShape.TranscriptMaximized:
      return state; // already visible
    case LayoutShape.Docked:
      return state; // already visible
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function afterCloseTranscript(state: LayoutState): LayoutState {
  switch (state.shape) {
    case LayoutShape.Default:
      return state;
    case LayoutShape.NotesMaximized:
      // Clear the pending-transcript flag; staying maximized.
      return { shape: LayoutShape.NotesMaximized, transcriptPending: false };
    case LayoutShape.TranscriptMaximized:
      return { shape: LayoutShape.Default };
    case LayoutShape.Docked:
      return { shape: LayoutShape.Default };
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function afterToggleNotesMaximized(state: LayoutState): LayoutState {
  switch (state.shape) {
    case LayoutShape.Default:
      return { shape: LayoutShape.NotesMaximized, transcriptPending: false };
    case LayoutShape.NotesMaximized:
      // Restoring: if the transcript was pending, go back to Docked.
      return state.transcriptPending
        ? { shape: LayoutShape.Docked, goalsExpanded: false }
        : { shape: LayoutShape.Default };
    case LayoutShape.TranscriptMaximized:
      // Switch focus from transcript to notes; remember transcript was open.
      return { shape: LayoutShape.NotesMaximized, transcriptPending: true };
    case LayoutShape.Docked:
      return { shape: LayoutShape.NotesMaximized, transcriptPending: true };
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function afterToggleTranscriptMaximized(state: LayoutState): LayoutState {
  switch (state.shape) {
    case LayoutShape.Default:
      return { shape: LayoutShape.TranscriptMaximized };
    case LayoutShape.NotesMaximized:
      return { shape: LayoutShape.TranscriptMaximized };
    case LayoutShape.TranscriptMaximized:
      // Restoring: keep transcript open (Docked), default-collapse goals.
      return { shape: LayoutShape.Docked, goalsExpanded: false };
    case LayoutShape.Docked:
      return { shape: LayoutShape.TranscriptMaximized };
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function afterToggleGoalsCollapsed(state: LayoutState): LayoutState {
  switch (state.shape) {
    case LayoutShape.Default:
      // Collapsing from Default leaves only Notes visible → auto-maximize Notes.
      return { shape: LayoutShape.NotesMaximized, transcriptPending: false };
    case LayoutShape.NotesMaximized:
      // Expanding from NotesMax exits focus, returning to two-col Default
      // (preserving transcriptPending as whether to re-open transcript — but
      // the symmetric choice is to drop pending too, since the user is
      // actively re-engaging Goals; keep current behavior: drop it).
      return { shape: LayoutShape.Default };
    case LayoutShape.TranscriptMaximized:
      // Expanding exits focus; transcript stays open (Docked).
      return { shape: LayoutShape.Docked, goalsExpanded: true };
    case LayoutShape.Docked:
      // In 3-col docked, just flip the user's expanded override.
      return { shape: LayoutShape.Docked, goalsExpanded: !state.goalsExpanded };
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

// ── Public hook return ────────────────────────────────────────────────

export interface CoachingSessionLayout {
  state: LayoutState;

  // Derived surface kept for backwards-compatibility with existing consumers.
  focusedPanel: FocusedPanel;
  isTranscriptOpen: boolean;
  isGoalsCollapsed: boolean;
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

// ── Hook ──────────────────────────────────────────────────────────────

const TRANSCRIPT_PARAM = "transcript";
const FOCUS_PARAM = "focus";

export function useCoachingSessionLayout(): CoachingSessionLayout {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const slots = readSlotsFromParams(searchParams);
  const [goalsExpandedOverride, setGoalsExpandedOverride] = useState<boolean>(false);

  // Reset the override whenever the URL-derived shape changes. This makes
  // deep links and transcript open/close return to the default collapse
  // behavior, while preserving overrides through unrelated re-renders.
  useEffect(() => {
    setGoalsExpandedOverride(false);
  }, [slots.focusedPanel, slots.isTranscriptOpen]);

  const state = stateFromSlots(slots, goalsExpandedOverride);

  const commit = useCallback(
    (next: LayoutState) => {
      const nextSlots = slotsFromState(next);
      const currentSlots = readSlotsFromParams(searchParams);
      // Only write the URL when the slot-backed state actually changed.
      // Docked.goalsExpanded lives in memory, so toggling it alone is a
      // no-op at the URL level.
      if (
        nextSlots.focusedPanel !== currentSlots.focusedPanel ||
        nextSlots.isTranscriptOpen !== currentSlots.isTranscriptOpen
      ) {
        writeSlotsToUrl(router, pathname, searchParams, nextSlots);
      }
      if (next.shape === LayoutShape.Docked) {
        setGoalsExpandedOverride(next.goalsExpanded);
      } else {
        setGoalsExpandedOverride(false);
      }
    },
    [router, pathname, searchParams]
  );

  const openTranscript = useCallback(
    () => commit(afterOpenTranscript(state)),
    [commit, state]
  );
  const closeTranscript = useCallback(
    () => commit(afterCloseTranscript(state)),
    [commit, state]
  );
  const toggleTranscript = useCallback(() => {
    if (slots.isTranscriptOpen) closeTranscript();
    else openTranscript();
  }, [slots.isTranscriptOpen, openTranscript, closeTranscript]);
  const toggleNotesMaximized = useCallback(
    () => commit(afterToggleNotesMaximized(state)),
    [commit, state]
  );
  const toggleTranscriptMaximized = useCallback(
    () => commit(afterToggleTranscriptMaximized(state)),
    [commit, state]
  );
  const toggleGoalsCollapsed = useCallback(
    () => commit(afterToggleGoalsCollapsed(state)),
    [commit, state]
  );

  return useMemo<CoachingSessionLayout>(
    () => ({
      state,
      focusedPanel: focusedPanelFor(state),
      isTranscriptOpen: isTranscriptOpenFor(state),
      isGoalsCollapsed: isGoalsCollapsedFor(state),
      isNotesMaximized: state.shape === LayoutShape.NotesMaximized,
      isTranscriptMaximized: state.shape === LayoutShape.TranscriptMaximized,
      openTranscript,
      closeTranscript,
      toggleTranscript,
      toggleNotesMaximized,
      toggleTranscriptMaximized,
      toggleGoalsCollapsed,
    }),
    [
      state,
      openTranscript,
      closeTranscript,
      toggleTranscript,
      toggleNotesMaximized,
      toggleTranscriptMaximized,
      toggleGoalsCollapsed,
    ]
  );
}

// ── URL slot (de)serialization ────────────────────────────────────────

interface LayoutSlots {
  focusedPanel: FocusedPanel;
  isTranscriptOpen: boolean;
}

function readSlotsFromParams(searchParams: ReadonlyURLSearchParams): LayoutSlots {
  const rawFocus = searchParams.get(FOCUS_PARAM);
  const focusedPanel =
    rawFocus && isFocusedPanel(rawFocus) ? rawFocus : FocusedPanel.None;
  const isTranscriptOpen = searchParams.get(TRANSCRIPT_PARAM) === "1";
  return { focusedPanel, isTranscriptOpen };
}

function writeSlotsToUrl(
  router: ReturnType<typeof useRouter>,
  pathname: string,
  existing: ReadonlyURLSearchParams,
  slots: LayoutSlots
): void {
  const next = new URLSearchParams(existing);
  if (slots.focusedPanel === FocusedPanel.None) next.delete(FOCUS_PARAM);
  else next.set(FOCUS_PARAM, slots.focusedPanel);
  if (slots.isTranscriptOpen) next.set(TRANSCRIPT_PARAM, "1");
  else next.delete(TRANSCRIPT_PARAM);
  const qs = next.toString();
  router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
}

// ── State <-> slots conversions ──────────────────────────────────────

/**
 * Derives the LayoutState from URL-backed slots plus the in-memory
 * goals-expanded override (only meaningful for the Docked shape).
 *
 * Illegal slot combinations are normalized (e.g. `focus=transcript`
 * without `transcript=1` → TranscriptMaximized, transcript implied open).
 */
export function stateFromSlots(
  slots: LayoutSlots,
  goalsExpandedOverride: boolean
): LayoutState {
  if (slots.focusedPanel === FocusedPanel.Transcript) {
    return { shape: LayoutShape.TranscriptMaximized };
  }
  if (slots.focusedPanel === FocusedPanel.Notes) {
    return {
      shape: LayoutShape.NotesMaximized,
      transcriptPending: slots.isTranscriptOpen,
    };
  }
  if (slots.isTranscriptOpen) {
    return { shape: LayoutShape.Docked, goalsExpanded: goalsExpandedOverride };
  }
  return { shape: LayoutShape.Default };
}

function slotsFromState(state: LayoutState): LayoutSlots {
  switch (state.shape) {
    case LayoutShape.Default:
      return { focusedPanel: FocusedPanel.None, isTranscriptOpen: false };
    case LayoutShape.NotesMaximized:
      return {
        focusedPanel: FocusedPanel.Notes,
        isTranscriptOpen: state.transcriptPending,
      };
    case LayoutShape.TranscriptMaximized:
      return { focusedPanel: FocusedPanel.Transcript, isTranscriptOpen: true };
    case LayoutShape.Docked:
      return { focusedPanel: FocusedPanel.None, isTranscriptOpen: true };
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

// ── Derivations for the public surface ────────────────────────────────

function focusedPanelFor(state: LayoutState): FocusedPanel {
  if (state.shape === LayoutShape.NotesMaximized) return FocusedPanel.Notes;
  if (state.shape === LayoutShape.TranscriptMaximized) return FocusedPanel.Transcript;
  return FocusedPanel.None;
}

function isTranscriptOpenFor(state: LayoutState): boolean {
  switch (state.shape) {
    case LayoutShape.Default:
      return false;
    case LayoutShape.NotesMaximized:
      return state.transcriptPending;
    case LayoutShape.TranscriptMaximized:
      return true;
    case LayoutShape.Docked:
      return true;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

function isGoalsCollapsedFor(state: LayoutState): boolean {
  switch (state.shape) {
    case LayoutShape.Default:
      return false;
    case LayoutShape.NotesMaximized:
      return true;
    case LayoutShape.TranscriptMaximized:
      return true;
    case LayoutShape.Docked:
      return !state.goalsExpanded;
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}
