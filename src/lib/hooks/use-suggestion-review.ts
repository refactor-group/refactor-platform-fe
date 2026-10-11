"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import {
  TranscriptSuggestionApi,
  type SuggestionFailure,
} from "@/lib/api/transcript-suggestions";
import type { Action } from "@/types/action";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";
import type { ActionEdits, ActionSuggestion } from "@/types/transcript-suggestion";

export type SuggestionOp = "accept" | "dismiss" | "save";

export function suggestionFailureMessage(op: SuggestionOp, f: SuggestionFailure): string {
  switch (f.kind) {
    case "no_longer_pending":
      return "Someone already handled this suggestion.";
    case "forbidden":
      return "Only your coach can change this suggestion.";
    case "not_found":
      return "This suggestion is no longer available.";
    case "invalid":
      return f.message.some
        ? f.message.val
        : `Couldn't ${op} the suggestion. Check it and try again.`;
    case "network":
      return `Couldn't ${op} the suggestion. Connection to service was lost.`;
    case "unexpected":
      return `Couldn't ${op} the suggestion.`;
    default: {
      const _exhaustive: never = f;
      throw new Error(`Unhandled suggestion failure: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** True when the failure means the local suggestion list is out of date. */
function isStale(f: SuggestionFailure): boolean {
  return f.kind === "no_longer_pending" || f.kind === "forbidden" || f.kind === "not_found";
}

export interface UseSuggestionReviewArgs {
  coachingSessionId: Id;
  refreshSuggestions: () => void;
  refreshActions: () => void;
}

export function useSuggestionReview({
  coachingSessionId,
  refreshSuggestions,
  refreshActions,
}: UseSuggestionReviewArgs) {
  const reportFailure = useCallback(
    (op: SuggestionOp, f: SuggestionFailure) => {
      toast.error(suggestionFailureMessage(op, f));
      if (isStale(f)) refreshSuggestions();
    },
    [refreshSuggestions]
  );

  const accept = useCallback(
    async (s: ActionSuggestion, edits: Option<ActionEdits>): Promise<Option<Action>> => {
      const result = await TranscriptSuggestionApi.accept(coachingSessionId, s.id, edits);
      if (result.isErr()) {
        reportFailure("accept", result.error);
        return None;
      }
      refreshSuggestions();
      refreshActions();
      return Some(result.value);
    },
    [coachingSessionId, refreshSuggestions, refreshActions, reportFailure]
  );

  const dismiss = useCallback(
    async (s: ActionSuggestion): Promise<boolean> => {
      const result = await TranscriptSuggestionApi.dismiss(coachingSessionId, s.id);
      if (result.isErr()) {
        reportFailure("dismiss", result.error);
        return false;
      }
      refreshSuggestions();
      return true;
    },
    [coachingSessionId, refreshSuggestions, reportFailure]
  );

  const save = useCallback(
    async (s: ActionSuggestion, edits: ActionEdits): Promise<boolean> => {
      const result = await TranscriptSuggestionApi.update(coachingSessionId, s.id, edits);
      if (result.isErr()) {
        reportFailure("save", result.error);
        return false;
      }
      refreshSuggestions();
      return true;
    },
    [coachingSessionId, refreshSuggestions, reportFailure]
  );

  return { accept, dismiss, save };
}
