import { describe, it, expect } from "vitest";

import {
  LayoutShape,
  type LayoutState,
  afterOpenTranscript,
  afterCloseTranscript,
  afterToggleNotesMaximized,
  afterToggleTranscriptMaximized,
  afterToggleGoalsCollapsed,
  stateFromSlots,
} from "../use-coaching-session-layout";
import { FocusedPanel } from "@/types/coaching-session-layout";

// Pure unit tests for the state machine's transition functions.
// These run without React, without the URL, without mocks — each
// transition is (LayoutState) → LayoutState and that's what we assert.

const DEFAULT_STATE: LayoutState = { shape: LayoutShape.Default };
const NOTES_MAX_NO_TX: LayoutState = {
  shape: LayoutShape.NotesMaximized,
  transcriptPending: false,
};
const NOTES_MAX_TX_PENDING: LayoutState = {
  shape: LayoutShape.NotesMaximized,
  transcriptPending: true,
};
const TRANSCRIPT_MAX: LayoutState = { shape: LayoutShape.TranscriptMaximized };
const DOCKED_COLLAPSED: LayoutState = {
  shape: LayoutShape.Docked,
  goalsExpanded: false,
};
const DOCKED_EXPANDED: LayoutState = {
  shape: LayoutShape.Docked,
  goalsExpanded: true,
};

describe("afterOpenTranscript", () => {
  it("Default → Docked (collapsed)", () => {
    expect(afterOpenTranscript(DEFAULT_STATE)).toEqual(DOCKED_COLLAPSED);
  });

  it("NotesMaximized → Docked (clears Notes focus)", () => {
    expect(afterOpenTranscript(NOTES_MAX_NO_TX)).toEqual(DOCKED_COLLAPSED);
    expect(afterOpenTranscript(NOTES_MAX_TX_PENDING)).toEqual(DOCKED_COLLAPSED);
  });

  it("TranscriptMaximized → no-op (already visible)", () => {
    expect(afterOpenTranscript(TRANSCRIPT_MAX)).toEqual(TRANSCRIPT_MAX);
  });

  it("Docked → no-op (already visible)", () => {
    expect(afterOpenTranscript(DOCKED_COLLAPSED)).toEqual(DOCKED_COLLAPSED);
    expect(afterOpenTranscript(DOCKED_EXPANDED)).toEqual(DOCKED_EXPANDED);
  });
});

describe("afterCloseTranscript", () => {
  it("Default → no-op", () => {
    expect(afterCloseTranscript(DEFAULT_STATE)).toEqual(DEFAULT_STATE);
  });

  it("NotesMaximized clears the transcriptPending flag", () => {
    expect(afterCloseTranscript(NOTES_MAX_TX_PENDING)).toEqual(NOTES_MAX_NO_TX);
    expect(afterCloseTranscript(NOTES_MAX_NO_TX)).toEqual(NOTES_MAX_NO_TX);
  });

  it("TranscriptMaximized → Default", () => {
    expect(afterCloseTranscript(TRANSCRIPT_MAX)).toEqual(DEFAULT_STATE);
  });

  it("Docked → Default", () => {
    expect(afterCloseTranscript(DOCKED_COLLAPSED)).toEqual(DEFAULT_STATE);
    expect(afterCloseTranscript(DOCKED_EXPANDED)).toEqual(DEFAULT_STATE);
  });
});

describe("afterToggleNotesMaximized", () => {
  it("Default → NotesMaximized (no pending transcript)", () => {
    expect(afterToggleNotesMaximized(DEFAULT_STATE)).toEqual(NOTES_MAX_NO_TX);
  });

  it("NotesMaximized restores to Default when no pending transcript", () => {
    expect(afterToggleNotesMaximized(NOTES_MAX_NO_TX)).toEqual(DEFAULT_STATE);
  });

  it("NotesMaximized restores to Docked when transcript was pending", () => {
    expect(afterToggleNotesMaximized(NOTES_MAX_TX_PENDING)).toEqual(DOCKED_COLLAPSED);
  });

  it("TranscriptMaximized → NotesMaximized with transcriptPending=true", () => {
    expect(afterToggleNotesMaximized(TRANSCRIPT_MAX)).toEqual(NOTES_MAX_TX_PENDING);
  });

  it("Docked → NotesMaximized with transcriptPending=true (preserves transcript)", () => {
    expect(afterToggleNotesMaximized(DOCKED_COLLAPSED)).toEqual(NOTES_MAX_TX_PENDING);
    expect(afterToggleNotesMaximized(DOCKED_EXPANDED)).toEqual(NOTES_MAX_TX_PENDING);
  });
});

describe("afterToggleTranscriptMaximized", () => {
  it("Default → TranscriptMaximized", () => {
    expect(afterToggleTranscriptMaximized(DEFAULT_STATE)).toEqual(TRANSCRIPT_MAX);
  });

  it("NotesMaximized → TranscriptMaximized", () => {
    expect(afterToggleTranscriptMaximized(NOTES_MAX_NO_TX)).toEqual(TRANSCRIPT_MAX);
    expect(afterToggleTranscriptMaximized(NOTES_MAX_TX_PENDING)).toEqual(TRANSCRIPT_MAX);
  });

  it("TranscriptMaximized restores to Docked (transcript stays open)", () => {
    expect(afterToggleTranscriptMaximized(TRANSCRIPT_MAX)).toEqual(DOCKED_COLLAPSED);
  });

  it("Docked → TranscriptMaximized", () => {
    expect(afterToggleTranscriptMaximized(DOCKED_COLLAPSED)).toEqual(TRANSCRIPT_MAX);
    expect(afterToggleTranscriptMaximized(DOCKED_EXPANDED)).toEqual(TRANSCRIPT_MAX);
  });
});

describe("afterToggleGoalsCollapsed", () => {
  it("Default → NotesMaximized (auto-maximize, Notes is the only visible other)", () => {
    expect(afterToggleGoalsCollapsed(DEFAULT_STATE)).toEqual(NOTES_MAX_NO_TX);
  });

  it("NotesMaximized → Default (expand exits focus)", () => {
    expect(afterToggleGoalsCollapsed(NOTES_MAX_NO_TX)).toEqual(DEFAULT_STATE);
    expect(afterToggleGoalsCollapsed(NOTES_MAX_TX_PENDING)).toEqual(DEFAULT_STATE);
  });

  it("TranscriptMaximized → Docked expanded (expand exits focus, transcript stays)", () => {
    expect(afterToggleGoalsCollapsed(TRANSCRIPT_MAX)).toEqual(DOCKED_EXPANDED);
  });

  it("Docked flips goalsExpanded in place", () => {
    expect(afterToggleGoalsCollapsed(DOCKED_COLLAPSED)).toEqual(DOCKED_EXPANDED);
    expect(afterToggleGoalsCollapsed(DOCKED_EXPANDED)).toEqual(DOCKED_COLLAPSED);
  });
});

describe("stateFromSlots", () => {
  it("(None, false) → Default", () => {
    expect(
      stateFromSlots(
        { focusedPanel: FocusedPanel.None, isTranscriptOpen: false },
        false
      )
    ).toEqual(DEFAULT_STATE);
  });

  it("(Notes, false) → NotesMaximized without pending", () => {
    expect(
      stateFromSlots(
        { focusedPanel: FocusedPanel.Notes, isTranscriptOpen: false },
        false
      )
    ).toEqual(NOTES_MAX_NO_TX);
  });

  it("(Notes, true) → NotesMaximized with pending", () => {
    expect(
      stateFromSlots(
        { focusedPanel: FocusedPanel.Notes, isTranscriptOpen: true },
        false
      )
    ).toEqual(NOTES_MAX_TX_PENDING);
  });

  it("(Transcript, anything) → TranscriptMaximized (normalizes illegal transcript=false)", () => {
    expect(
      stateFromSlots(
        { focusedPanel: FocusedPanel.Transcript, isTranscriptOpen: true },
        false
      )
    ).toEqual(TRANSCRIPT_MAX);
    expect(
      stateFromSlots(
        { focusedPanel: FocusedPanel.Transcript, isTranscriptOpen: false },
        false
      )
    ).toEqual(TRANSCRIPT_MAX);
  });

  it("(None, true) with no override → Docked collapsed", () => {
    expect(
      stateFromSlots(
        { focusedPanel: FocusedPanel.None, isTranscriptOpen: true },
        false
      )
    ).toEqual(DOCKED_COLLAPSED);
  });

  it("(None, true) with override → Docked expanded", () => {
    expect(
      stateFromSlots(
        { focusedPanel: FocusedPanel.None, isTranscriptOpen: true },
        true
      )
    ).toEqual(DOCKED_EXPANDED);
  });
});
