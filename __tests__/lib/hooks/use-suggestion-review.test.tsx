// Frozen acceptance test for fe#477 phase 3: the review hook behind accept,
// dismiss and restore, and the toast copy for each failure.

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, err } from "neverthrow";
import { DateTime } from "ts-luxon";
import { toast } from "sonner";
import {
  useSuggestionReview,
  suggestionFailureMessage,
} from "@/lib/hooks/use-suggestion-review";
import { TranscriptSuggestionApi } from "@/lib/api/transcript-suggestions";
import { DueSource, type ActionSuggestion } from "@/types/transcript-suggestion";
import { Some, None } from "@/types/option";
import { createMockAction } from "../../test-utils";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/lib/api/transcript-suggestions", () => ({
  TranscriptSuggestionApi: {
    accept: vi.fn(),
    dismiss: vi.fn(),
    restore: vi.fn(),
  },
}));

const suggestion: ActionSuggestion = {
  id: "sug-1",
  coaching_session_id: "s-1",
  proposal: { ...createMockAction(), due_phrase: None },
  quote: "q",
  segment: { id: "seg-1", start_ms: 0, speaker_role: None, speaker_label: "Guest 1" },
  duplicate_of: None,
  default_due: { at: DateTime.now(), source: Some(DueSource.NextSession) },
  created_at: DateTime.now(),
};

const edits = { body: "Edited", due_by: None, assignee_ids: ["coachee-1"] };

function setup() {
  const refreshSuggestions = vi.fn();
  const refreshActions = vi.fn();
  const { result } = renderHook(() =>
    useSuggestionReview({ coachingSessionId: "s-1", refreshSuggestions, refreshActions })
  );
  return { result, refreshSuggestions, refreshActions };
}

describe("useSuggestionReview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts, refreshes suggestions and actions, and returns the new action", async () => {
    const created = createMockAction({ id: "act-new" });
    vi.mocked(TranscriptSuggestionApi.accept).mockResolvedValue(ok(created));
    const { result, refreshSuggestions, refreshActions } = setup();

    let accepted;
    await act(async () => {
      accepted = await result.current.accept(suggestion, Some(edits));
    });

    expect(TranscriptSuggestionApi.accept).toHaveBeenCalledWith("s-1", "sug-1", Some(edits));
    expect(accepted).toEqual(Some(created));
    expect(refreshSuggestions).toHaveBeenCalled();
    expect(refreshActions).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("toasts and refreshes when the suggestion was already handled", async () => {
    vi.mocked(TranscriptSuggestionApi.accept).mockResolvedValue(err({ kind: "no_longer_pending" }));
    const { result, refreshSuggestions, refreshActions } = setup();

    let accepted;
    await act(async () => {
      accepted = await result.current.accept(suggestion, None);
    });

    expect(accepted).toEqual(None);
    expect(toast.error).toHaveBeenCalledWith("Someone already handled this suggestion.");
    expect(refreshSuggestions).toHaveBeenCalled();
    expect(refreshActions).not.toHaveBeenCalled();
  });

  it("dismisses and refreshes suggestions", async () => {
    vi.mocked(TranscriptSuggestionApi.dismiss).mockResolvedValue(ok(undefined));
    const { result, refreshSuggestions } = setup();

    let dismissed;
    await act(async () => {
      dismissed = await result.current.dismiss(suggestion);
    });

    expect(TranscriptSuggestionApi.dismiss).toHaveBeenCalledWith("s-1", "sug-1");
    expect(dismissed).toBe(true);
    expect(refreshSuggestions).toHaveBeenCalled();
  });

  it("reports a forbidden dismiss", async () => {
    vi.mocked(TranscriptSuggestionApi.dismiss).mockResolvedValue(err({ kind: "forbidden" }));
    const { result } = setup();

    let dismissed;
    await act(async () => {
      dismissed = await result.current.dismiss(suggestion);
    });

    expect(dismissed).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Only your coach can change this suggestion.");
  });

  it("shows the backend's validation message on a failed accept with edits", async () => {
    vi.mocked(TranscriptSuggestionApi.accept).mockResolvedValue(
      err({ kind: "invalid", message: Some("Body must not be empty") })
    );
    const { result } = setup();

    let accepted;
    await act(async () => {
      accepted = await result.current.accept(suggestion, Some(edits));
    });

    expect(accepted).toEqual(None);
    expect(toast.error).toHaveBeenCalledWith("Body must not be empty");
  });

  it("no longer offers a separate save", () => {
    const { result } = setup();
    expect("save" in result.current).toBe(false);
  });
});

describe("suggestionFailureMessage", () => {
  it("words every failure", () => {
    expect(suggestionFailureMessage("accept", { kind: "no_longer_pending" })).toBe(
      "Someone already handled this suggestion."
    );
    expect(suggestionFailureMessage("accept", { kind: "forbidden" })).toBe(
      "Only your coach can change this suggestion."
    );
    expect(suggestionFailureMessage("dismiss", { kind: "not_found" })).toBe(
      "This suggestion is no longer available."
    );
    expect(suggestionFailureMessage("accept", { kind: "invalid", message: None })).toBe(
      "Couldn't accept the suggestion. Check it and try again."
    );
    expect(suggestionFailureMessage("accept", { kind: "network" })).toBe(
      "Couldn't accept the suggestion. Connection to service was lost."
    );
    expect(suggestionFailureMessage("dismiss", { kind: "unexpected", status: Some(500) })).toBe(
      "Couldn't dismiss the suggestion."
    );
  });
});
