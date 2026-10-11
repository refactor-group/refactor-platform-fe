// Interacts with a coaching session's transcript suggestion endpoints

import axios from "axios";
import { err, ok, type Result } from "neverthrow";
import { siteConfig } from "@/site.config";
import { sessionGuard } from "@/lib/auth/session-guard";
import { EntityApi, type ApiResponse } from "@/lib/api/entity-api";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";
import {
  transformActionWithAssignees,
  type Action,
  type ActionWithAssigneesWire,
} from "@/types/action";
import {
  parseActionSuggestion,
  serializeActionEdits,
  type ActionEdits,
  type ActionSuggestion,
} from "@/types/transcript-suggestion";

const suggestionsUrl = (sessionId: Id): string =>
  `${siteConfig.env.backendServiceURL}/coaching_sessions/${sessionId}/transcript_suggestions`;

const suggestionUrl = (sessionId: Id, suggestionId: Id): string =>
  `${suggestionsUrl(sessionId)}/${suggestionId}`;

/** The session's suggestions filtered to actions. */
export const actionSuggestionsUrl = (sessionId: Id): string =>
  `${suggestionsUrl(sessionId)}?target=action`;

/** A failed suggestion mutation, reduced to what the review UI needs. */
export type SuggestionFailure =
  | { kind: "no_longer_pending" }
  | { kind: "forbidden" }
  | { kind: "not_found" }
  | { kind: "invalid"; message: Option<string> }
  | { kind: "network" }
  | { kind: "unexpected"; status: Option<number> };

function messageOf(data: unknown): Option<string> {
  if (typeof data !== "object" || data === null) return None;
  const { message } = data as { message?: unknown };
  return typeof message === "string" ? Some(message) : None;
}

function toSuggestionFailure(error: unknown): SuggestionFailure {
  if (!axios.isAxiosError(error)) return { kind: "unexpected", status: None };
  if (!error.response) return { kind: "network" };
  const { status, data } = error.response;
  switch (status) {
    case 409:
      return { kind: "no_longer_pending" };
    case 403:
      return { kind: "forbidden" };
    case 404:
      return { kind: "not_found" };
    case 422:
      return { kind: "invalid", message: messageOf(data) };
    default:
      return { kind: "unexpected", status: Some(status) };
  }
}

async function attempt<T>(
  call: () => Promise<T>
): Promise<Result<T, SuggestionFailure>> {
  try {
    return ok(await call());
  } catch (error) {
    return err(toSuggestionFailure(error));
  }
}

export const TranscriptSuggestionApi = {
  listActions: async (sessionId: Id): Promise<ActionSuggestion[]> => {
    const res = await sessionGuard.get<ApiResponse<unknown[]>>(
      actionSuggestionsUrl(sessionId)
    );
    return res.data.data.map(parseActionSuggestion);
  },

  update: (
    sessionId: Id,
    suggestionId: Id,
    edits: ActionEdits
  ): Promise<Result<ActionSuggestion, SuggestionFailure>> =>
    attempt(async () => {
      const res = await sessionGuard.put<ApiResponse<unknown>>(
        suggestionUrl(sessionId, suggestionId),
        serializeActionEdits(edits)
      );
      return parseActionSuggestion(res.data.data);
    }),

  accept: (
    sessionId: Id,
    suggestionId: Id,
    edits: Option<ActionEdits>
  ): Promise<Result<Action, SuggestionFailure>> =>
    attempt(async () => {
      const url = `${suggestionUrl(sessionId, suggestionId)}/accept`;
      const res = edits.some
        ? await sessionGuard.post<ApiResponse<ActionWithAssigneesWire>>(
            url,
            serializeActionEdits(edits.val)
          )
        : await sessionGuard.post<ApiResponse<ActionWithAssigneesWire>>(url);
      return transformActionWithAssignees(res.data.data);
    }),

  dismiss: (
    sessionId: Id,
    suggestionId: Id
  ): Promise<Result<void, SuggestionFailure>> =>
    attempt(async () => {
      await sessionGuard.post(`${suggestionUrl(sessionId, suggestionId)}/dismiss`);
    }),

  restore: (
    sessionId: Id,
    suggestionId: Id
  ): Promise<Result<void, SuggestionFailure>> =>
    attempt(async () => {
      await sessionGuard.post(`${suggestionUrl(sessionId, suggestionId)}/restore`);
    }),
};

/**
 * Fetches a session's action suggestions. The list arrives oldest first;
 * do not re-sort it.
 */
export const useActionSuggestionList = (sessionId: Id) => {
  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<ActionSuggestion>(
      actionSuggestionsUrl(sessionId),
      () => TranscriptSuggestionApi.listActions(sessionId),
      sessionId
    );

  return {
    suggestions: entities,
    isLoading,
    isError,
    refresh,
  };
};
