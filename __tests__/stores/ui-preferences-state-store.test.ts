import { describe, it, expect, beforeEach } from "vitest";

import {
  createUIPreferencesStateStore,
  clampTranscriptPaneWidth,
  DEFAULT_TRANSCRIPT_PANE_WIDTH,
  MIN_TRANSCRIPT_PANE_WIDTH,
  MAX_TRANSCRIPT_PANE_WIDTH,
} from "@/lib/stores/ui-preferences-state-store";

describe("clampTranscriptPaneWidth", () => {
  it("returns the input unchanged when within bounds", () => {
    expect(clampTranscriptPaneWidth(440)).toBe(440);
    expect(clampTranscriptPaneWidth(MIN_TRANSCRIPT_PANE_WIDTH)).toBe(MIN_TRANSCRIPT_PANE_WIDTH);
    expect(clampTranscriptPaneWidth(MAX_TRANSCRIPT_PANE_WIDTH)).toBe(MAX_TRANSCRIPT_PANE_WIDTH);
  });

  it("clamps below minimum up to the minimum", () => {
    expect(clampTranscriptPaneWidth(100)).toBe(MIN_TRANSCRIPT_PANE_WIDTH);
    expect(clampTranscriptPaneWidth(0)).toBe(MIN_TRANSCRIPT_PANE_WIDTH);
    expect(clampTranscriptPaneWidth(-200)).toBe(MIN_TRANSCRIPT_PANE_WIDTH);
  });

  it("clamps above maximum down to the maximum", () => {
    expect(clampTranscriptPaneWidth(1_000)).toBe(MAX_TRANSCRIPT_PANE_WIDTH);
  });

  it("falls back to the default for non-finite inputs", () => {
    expect(clampTranscriptPaneWidth(NaN)).toBe(DEFAULT_TRANSCRIPT_PANE_WIDTH);
    expect(clampTranscriptPaneWidth(Infinity)).toBe(DEFAULT_TRANSCRIPT_PANE_WIDTH);
    expect(clampTranscriptPaneWidth(-Infinity)).toBe(DEFAULT_TRANSCRIPT_PANE_WIDTH);
  });
});

describe("UIPreferencesStateStore", () => {
  let store: ReturnType<typeof createUIPreferencesStateStore>;

  beforeEach(() => {
    store = createUIPreferencesStateStore();
  });

  it("initializes with the default transcript pane width", () => {
    expect(store.getState().transcriptPaneWidth).toBe(DEFAULT_TRANSCRIPT_PANE_WIDTH);
  });

  it("updates the width to in-range values", () => {
    store.getState().setTranscriptPaneWidth(500);
    expect(store.getState().transcriptPaneWidth).toBe(500);
  });

  it("clamps out-of-range values written through the setter", () => {
    store.getState().setTranscriptPaneWidth(50);
    expect(store.getState().transcriptPaneWidth).toBe(MIN_TRANSCRIPT_PANE_WIDTH);

    store.getState().setTranscriptPaneWidth(9_999);
    expect(store.getState().transcriptPaneWidth).toBe(MAX_TRANSCRIPT_PANE_WIDTH);
  });

  it("resets to defaults", () => {
    store.getState().setTranscriptPaneWidth(600);
    store.getState().resetUIPreferences();
    expect(store.getState().transcriptPaneWidth).toBe(DEFAULT_TRANSCRIPT_PANE_WIDTH);
  });

  it("handles repeated updates", () => {
    store.getState().setTranscriptPaneWidth(420);
    store.getState().setTranscriptPaneWidth(560);
    store.getState().setTranscriptPaneWidth(380);
    expect(store.getState().transcriptPaneWidth).toBe(380);
  });
});
