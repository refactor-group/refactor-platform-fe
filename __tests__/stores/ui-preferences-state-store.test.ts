import { describe, it, expect, beforeEach } from "vitest";
import { createUiPreferencesStore } from "@/lib/stores/ui-preferences-state-store";

describe("UiPreferencesStore", () => {
  let store: ReturnType<typeof createUiPreferencesStore>;

  beforeEach(() => {
    localStorage.clear();
    store = createUiPreferencesStore();
  });

  it("initializes with an empty viewedTranscripts map", () => {
    expect(store.getState().viewedTranscripts).toEqual({});
  });

  it("upserts a viewed transcription id for a session", () => {
    store.getState().markTranscriptViewed("session-1", "trans-a");
    expect(store.getState().viewedTranscripts).toEqual({
      "session-1": "trans-a",
    });
  });

  it("overwrites the prior transcription id when re-called for the same session", () => {
    store.getState().markTranscriptViewed("session-1", "trans-a");
    store.getState().markTranscriptViewed("session-1", "trans-b");
    expect(store.getState().viewedTranscripts).toEqual({
      "session-1": "trans-b",
    });
  });

  it("keeps independent sessions isolated", () => {
    store.getState().markTranscriptViewed("session-1", "trans-a");
    store.getState().markTranscriptViewed("session-2", "trans-x");
    expect(store.getState().viewedTranscripts).toEqual({
      "session-1": "trans-a",
      "session-2": "trans-x",
    });
  });

  it("resetUiPreferences clears the viewedTranscripts map", () => {
    store.getState().markTranscriptViewed("session-1", "trans-a");
    store.getState().resetUiPreferences();
    expect(store.getState().viewedTranscripts).toEqual({});
  });

  it("persists to localStorage on update", () => {
    store.getState().markTranscriptViewed("session-1", "trans-a");
    const raw = localStorage.getItem("ui-preferences-store");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    expect(parsed.state.viewedTranscripts).toEqual({
      "session-1": "trans-a",
    });
  });

  it("hydrates from localStorage on store init", () => {
    localStorage.setItem(
      "ui-preferences-store",
      JSON.stringify({
        state: { viewedTranscripts: { "session-9": "trans-z" } },
        version: 1,
      })
    );
    const hydrated = createUiPreferencesStore();
    expect(hydrated.getState().viewedTranscripts).toEqual({
      "session-9": "trans-z",
    });
  });
});
