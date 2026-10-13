// Frozen acceptance test for fe#477 phase 4: restoring a dismissed suggestion.

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ok, err } from "neverthrow";
import { DateTime } from "ts-luxon";
import { toast } from "sonner";
import { useSuggestionReview, suggestionFailureMessage } from "@/lib/hooks/use-suggestion-review";
import { TranscriptSuggestionApi } from "@/lib/api/transcript-suggestions";
import { DueSource, type ActionSuggestion } from "@/types/transcript-suggestion";
import { None, Some } from "@/types/option";
import { createMockAction } from "../../test-utils";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/lib/api/transcript-suggestions", () => ({
  TranscriptSuggestionApi: { accept: vi.fn(), dismiss: vi.fn(), restore: vi.fn(), update: vi.fn() },
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

function setup() {
  const refreshSuggestions = vi.fn();
  const refreshActions = vi.fn();
  const { result } = renderHook(() =>
    useSuggestionReview({ coachingSessionId: "s-1", refreshSuggestions, refreshActions })
  );
  return { result, refreshSuggestions };
}

describe("useSuggestionReview.restore", () => {
  beforeEach(() => vi.clearAllMocks());

  it("restores and refreshes suggestions", async () => {
    vi.mocked(TranscriptSuggestionApi.restore).mockResolvedValue(ok(undefined));
    const { result, refreshSuggestions } = setup();

    let restored;
    await act(async () => {
      restored = await result.current.restore(suggestion);
    });

    expect(TranscriptSuggestionApi.restore).toHaveBeenCalledWith("s-1", "sug-1");
    expect(restored).toBe(true);
    expect(refreshSuggestions).toHaveBeenCalled();
  });

  it("toasts a failed restore", async () => {
    vi.mocked(TranscriptSuggestionApi.restore).mockResolvedValue(
      err({ kind: "unexpected", status: Some(500) })
    );
    const { result } = setup();

    let restored;
    await act(async () => {
      restored = await result.current.restore(suggestion);
    });

    expect(restored).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("Couldn't restore the suggestion.");
  });

  it("words restore failures", () => {
    expect(suggestionFailureMessage("restore", { kind: "network" })).toBe(
      "Couldn't restore the suggestion. Connection to service was lost."
    );
  });
});
