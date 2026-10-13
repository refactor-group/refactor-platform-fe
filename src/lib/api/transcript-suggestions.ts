// Interacts with a coaching session's transcript suggestion endpoints

import { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { useSWRConfig } from "swr";
import { err, ok, type Result } from "neverthrow";
import { siteConfig } from "@/site.config";
import { sessionGuard } from "@/lib/auth/session-guard";
import { EntityApi, type ApiResponse } from "@/lib/api/entity-api";
import { useApiSWR } from "@/lib/hooks/use-api-swr";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";
import {
  transformActionWithAssignees,
  type Action,
  type ActionWithAssigneesWire,
} from "@/types/action";
import {
  isScanStatus,
  parseActionSuggestion,
  serializeActionEdits,
  type ActionEdits,
  ScanStatus,
  SuggestionStatus,
  type ActionSuggestion,
} from "@/types/transcript-suggestion";

const suggestionsUrl = (sessionId: Id): string =>
  `${siteConfig.env.backendServiceURL}/coaching_sessions/${sessionId}/transcript_suggestions`;

const suggestionUrl = (sessionId: Id, suggestionId: Id): string =>
  `${suggestionsUrl(sessionId)}/${suggestionId}`;

/** The session's suggestions filtered to actions. */
export const actionSuggestionsUrl = (sessionId: Id): string =>
  `${suggestionsUrl(sessionId)}?target=action`;

/** The session's dismissed action suggestions. */
export const dismissedActionSuggestionsUrl = (sessionId: Id): string =>
  `${suggestionsUrl(sessionId)}?target=action&status=dismissed`;

/** Where the session's transcript scan for actions stands. */
export const scanStatusUrl = (sessionId: Id): string =>
  `${suggestionsUrl(sessionId)}/scan?target=action`;

function listUrl(sessionId: Id, status: SuggestionStatus): string {
  switch (status) {
    case SuggestionStatus.Pending:
      return actionSuggestionsUrl(sessionId);
    case SuggestionStatus.Dismissed:
      return dismissedActionSuggestionsUrl(sessionId);
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled suggestion status: ${_exhaustive}`);
    }
  }
}

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

/** A scan that did not start, reduced to what the scan button needs. */
export type ScanFailure =
  | { kind: "refused"; message: Option<string> }
  | { kind: "network" }
  | { kind: "unexpected"; status: Option<number> };

function toScanFailure(error: unknown): ScanFailure {
  if (!axios.isAxiosError(error)) return { kind: "unexpected", status: None };
  if (!error.response) return { kind: "network" };
  const { status, data } = error.response;
  return status === 409 || status === 422
    ? { kind: "refused", message: messageOf(data) }
    : { kind: "unexpected", status: Some(status) };
}

function parseScanStatus(value: unknown): ScanStatus {
  const { status } = (typeof value === "object" && value !== null ? value : {}) as {
    status?: unknown;
  };
  if (!isScanStatus(status)) {
    throw new Error(`Unknown scan status: ${String(status)}`);
  }
  return status;
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
  listActions: async (
    sessionId: Id,
    status: SuggestionStatus = SuggestionStatus.Pending
  ): Promise<ActionSuggestion[]> => {
    const res = await sessionGuard.get<ApiResponse<unknown[]>>(listUrl(sessionId, status));
    return res.data.data.map(parseActionSuggestion);
  },

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

  scanStatus: async (sessionId: Id): Promise<ScanStatus> => {
    const res = await sessionGuard.get<ApiResponse<unknown>>(scanStatusUrl(sessionId));
    return parseScanStatus(res.data.data);
  },

  startScan: async (sessionId: Id): Promise<Result<ScanStatus, ScanFailure>> => {
    try {
      const res = await sessionGuard.post<ApiResponse<unknown>>(scanStatusUrl(sessionId));
      return ok(parseScanStatus(res.data.data));
    } catch (error) {
      return err(toScanFailure(error));
    }
  },
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

/** Fetches a session's dismissed action suggestions, oldest first. */
export const useDismissedActionSuggestionList = (sessionId: Id) => {
  const { entities, isLoading, isError, refresh } =
    EntityApi.useEntityList<ActionSuggestion>(
      dismissedActionSuggestionsUrl(sessionId),
      () => TranscriptSuggestionApi.listActions(sessionId, SuggestionStatus.Dismissed),
      sessionId
    );

  return {
    suggestions: entities,
    isLoading,
    isError,
    refresh,
  };
};

/** How often a running scan is re-read, in case its finishing event never arrives. */
export const SCAN_POLL_MS = 15_000;

const isRunning = (status: ScanStatus): boolean =>
  status === ScanStatus.Pending || status === ScanStatus.Processing;

/** Polls only while a scan is queued or running; the server event usually ends it sooner. */
export const scanPollInterval = (status: ScanStatus): number =>
  isRunning(status) ? SCAN_POLL_MS : 0;

/**
 * Where the session's transcript scan for actions stands; None while loading or on error.
 *
 * A running scan is also re-read every `SCAN_POLL_MS`, so a lost live-update connection never
 * leaves the button spinning, and the suggestion lists are re-read when it finishes.
 */
export const useScanStatus = (
  sessionId: Id
): { status: Option<ScanStatus>; refresh: () => void } => {
  // Kept as state, not passed as SWR's function form: SWR asks that once on mount, before any
  // data, and never reschedules a poll it decided against.
  const [pollMs, setPollMs] = useState(0);
  const { data, error, mutate } = useApiSWR<ScanStatus>(
    scanStatusUrl(sessionId),
    () => TranscriptSuggestionApi.scanStatus(sessionId),
    { refreshInterval: pollMs }
  );
  // Follows whatever status the hook holds, including one served from cache with no request.
  const wantedPollMs = data === undefined ? 0 : scanPollInterval(data);
  if (wantedPollMs !== pollMs) setPollMs(wantedPollMs);

  const { mutate: revalidate } = useSWRConfig();
  const wasRunning = useRef(false);
  useEffect(() => {
    if (data === undefined) return;
    const running = isRunning(data);
    if (wasRunning.current && !running) {
      const lists = [actionSuggestionsUrl(sessionId), dismissedActionSuggestionsUrl(sessionId)];
      // Revalidate without blanking: the cards stay up until the fresh lists arrive.
      void revalidate((key) => Array.isArray(key) && lists.includes(key[0]), undefined, {
        revalidate: true,
        populateCache: false,
      });
    }
    wasRunning.current = running;
  }, [data, sessionId, revalidate]);
  const refresh = useCallback(() => {
    void mutate();
  }, [mutate]);

  return { status: error || data === undefined ? None : Some(data), refresh };
};
