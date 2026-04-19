import { describe, it, expect, beforeEach } from "vitest";

import {
  createUIPreferencesStateStore,
  clampTranscriptPanelWidth,
  DEFAULT_TRANSCRIPT_PANEL_WIDTH,
  MIN_TRANSCRIPT_PANEL_WIDTH,
  MAX_TRANSCRIPT_PANEL_WIDTH,
} from "@/lib/stores/ui-preferences-state-store";

describe("clampTranscriptPanelWidth", () => {
  it("returns the input unchanged when within bounds", () => {
    expect(clampTranscriptPanelWidth(440)).toBe(440);
    expect(clampTranscriptPanelWidth(MIN_TRANSCRIPT_PANEL_WIDTH)).toBe(MIN_TRANSCRIPT_PANEL_WIDTH);
    expect(clampTranscriptPanelWidth(MAX_TRANSCRIPT_PANEL_WIDTH)).toBe(MAX_TRANSCRIPT_PANEL_WIDTH);
  });

  it("clamps below minimum up to the minimum", () => {
    expect(clampTranscriptPanelWidth(100)).toBe(MIN_TRANSCRIPT_PANEL_WIDTH);
    expect(clampTranscriptPanelWidth(0)).toBe(MIN_TRANSCRIPT_PANEL_WIDTH);
    expect(clampTranscriptPanelWidth(-200)).toBe(MIN_TRANSCRIPT_PANEL_WIDTH);
  });

  it("clamps above maximum down to the maximum", () => {
    expect(clampTranscriptPanelWidth(1_000)).toBe(MAX_TRANSCRIPT_PANEL_WIDTH);
  });

  it("falls back to the default for non-finite inputs", () => {
    expect(clampTranscriptPanelWidth(NaN)).toBe(DEFAULT_TRANSCRIPT_PANEL_WIDTH);
    expect(clampTranscriptPanelWidth(Infinity)).toBe(DEFAULT_TRANSCRIPT_PANEL_WIDTH);
    expect(clampTranscriptPanelWidth(-Infinity)).toBe(DEFAULT_TRANSCRIPT_PANEL_WIDTH);
  });
});

describe("UIPreferencesStateStore", () => {
  let store: ReturnType<typeof createUIPreferencesStateStore>;

  beforeEach(() => {
    store = createUIPreferencesStateStore();
  });

  it("initializes with the default transcript panel width", () => {
    expect(store.getState().transcriptPanelWidth).toBe(DEFAULT_TRANSCRIPT_PANEL_WIDTH);
  });

  it("updates the width to in-range values", () => {
    store.getState().setTranscriptPanelWidth(500);
    expect(store.getState().transcriptPanelWidth).toBe(500);
  });

  it("clamps out-of-range values written through the setter", () => {
    store.getState().setTranscriptPanelWidth(50);
    expect(store.getState().transcriptPanelWidth).toBe(MIN_TRANSCRIPT_PANEL_WIDTH);

    store.getState().setTranscriptPanelWidth(9_999);
    expect(store.getState().transcriptPanelWidth).toBe(MAX_TRANSCRIPT_PANEL_WIDTH);
  });

  it("resets to defaults", () => {
    store.getState().setTranscriptPanelWidth(600);
    store.getState().resetUIPreferences();
    expect(store.getState().transcriptPanelWidth).toBe(DEFAULT_TRANSCRIPT_PANEL_WIDTH);
  });

  it("handles repeated updates", () => {
    store.getState().setTranscriptPanelWidth(420);
    store.getState().setTranscriptPanelWidth(560);
    store.getState().setTranscriptPanelWidth(380);
    expect(store.getState().transcriptPanelWidth).toBe(380);
  });
});
