// Frozen acceptance test for fe#477 phase 1: the transcript suggestions API client.
// Asserts exact paths, methods and bodies, and that HTTP failures come back typed.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import {
  TranscriptSuggestionApi,
  actionSuggestionsUrl,
  type SuggestionFailure,
} from "@/lib/api/transcript-suggestions";
import { sessionGuard } from "@/lib/auth/session-guard";
import { Some, None } from "@/types/option";

vi.mock("@/lib/auth/session-guard", () => ({
  sessionGuard: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:3000" } },
}));

const BASE = "http://localhost:3000/coaching_sessions/s-1/transcript_suggestions";

const wireSuggestion = {
  id: "sug-1",
  coaching_session_id: "s-1",
  proposal: {
    id: "00000000-0000-0000-0000-000000000000",
    coaching_session_id: "s-1",
    goal_id: null,
    body: "Send the hiring plan",
    user_id: "coach-1",
    status: "NotStarted",
    status_changed_at: "2026-10-11T15:00:00Z",
    due_by: null,
    created_at: "2026-10-11T15:00:00Z",
    updated_at: "2026-10-11T15:00:00Z",
    assignee_ids: ["coachee-1"],
    due_phrase: null,
  },
  quote: "I'll send the hiring plan.",
  segment: { id: "seg-1", start_ms: 1000, speaker_role: "coachee", speaker_label: "Caleb" },
  duplicate_of: null,
  default_due: { at: "2026-10-18T15:00:00Z", source: "next_session" },
  created_at: "2026-10-11T15:05:00Z",
};

const wireAction = {
  id: "act-9",
  coaching_session_id: "s-1",
  goal_id: null,
  body: "Send the hiring plan",
  user_id: "coachee-1",
  status: "NotStarted",
  status_changed_at: "2026-10-11T15:10:00Z",
  due_by: "2026-10-18T15:00:00Z",
  created_at: "2026-10-11T15:10:00Z",
  updated_at: "2026-10-11T15:10:00Z",
  assignee_ids: ["coachee-1"],
};

const edits = {
  body: "Send the revised hiring plan",
  due_by: Some(DateTime.fromISO("2026-10-17T00:00:00Z", { zone: "utc" })),
  assignee_ids: ["coachee-1"],
};

const wireEdits = {
  body: "Send the revised hiring plan",
  due_by: DateTime.fromISO("2026-10-17T00:00:00Z", { zone: "utc" }).toISO(),
  assignee_ids: ["coachee-1"],
};

const httpError = (status: number, data: unknown = {}) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status, statusText: "", data, headers: {}, config: {} },
  });

const networkError = () =>
  Object.assign(new Error("Network Error"), { isAxiosError: true, response: undefined });

const ok = (data: unknown, status = 200) => ({ status, data: { status_code: status, data } });

const failureOf = async (
  call: Promise<{ isErr(): boolean; isOk(): boolean } & { error?: unknown }>
): Promise<SuggestionFailure> => {
  const result = await call;
  expect(result.isErr()).toBe(true);
  return (result as unknown as { error: SuggestionFailure }).error;
};

describe("actionSuggestionsUrl", () => {
  it("is the session's suggestions list filtered to actions", () => {
    expect(actionSuggestionsUrl("s-1")).toBe(`${BASE}?target=action`);
  });
});

describe("TranscriptSuggestionApi.listActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GETs the action suggestions and parses them", async () => {
    vi.mocked(sessionGuard.get).mockResolvedValue(ok([wireSuggestion]));
    const list = await TranscriptSuggestionApi.listActions("s-1");
    expect(sessionGuard.get).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sessionGuard.get).mock.calls[0][0]).toBe(`${BASE}?target=action`);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("sug-1");
    expect(list[0].proposal.due_by).toEqual(None);
  });

  it("throws when an item has drifted from the contract", async () => {
    vi.mocked(sessionGuard.get).mockResolvedValue(
      ok([{ ...wireSuggestion, default_due: { at: "x", source: "someday" } }])
    );
    await expect(TranscriptSuggestionApi.listActions("s-1")).rejects.toThrow();
  });
});

describe("TranscriptSuggestionApi mutations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("update PUTs the serialized edits to the suggestion and returns it parsed", async () => {
    vi.mocked(sessionGuard.put).mockResolvedValue(ok(wireSuggestion));
    const result = await TranscriptSuggestionApi.update("s-1", "sug-1", edits);
    expect(sessionGuard.put).toHaveBeenCalledWith(`${BASE}/sug-1`, wireEdits);
    expect(result.isOk()).toBe(true);
    expect(result.isOk() && result.value.id).toBe("sug-1");
  });

  it("accept with edits POSTs them and returns the created action", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue(ok(wireAction, 201));
    const result = await TranscriptSuggestionApi.accept("s-1", "sug-1", Some(edits));
    expect(sessionGuard.post).toHaveBeenCalledWith(`${BASE}/sug-1/accept`, wireEdits);
    expect(result.isOk()).toBe(true);
    const action = result.isOk() ? result.value : null;
    expect(action?.id).toBe("act-9");
    expect(action?.assignee_ids).toEqual(["coachee-1"]);
    expect(action?.due_by.some).toBe(true);
  });

  it("accept without edits POSTs no body", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue(ok(wireAction, 201));
    await TranscriptSuggestionApi.accept("s-1", "sug-1", None);
    expect(vi.mocked(sessionGuard.post).mock.calls[0]).toEqual([`${BASE}/sug-1/accept`]);
  });

  it("dismiss POSTs to the dismiss route with no body", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue({ status: 204, data: "" });
    const result = await TranscriptSuggestionApi.dismiss("s-1", "sug-1");
    expect(vi.mocked(sessionGuard.post).mock.calls[0]).toEqual([`${BASE}/sug-1/dismiss`]);
    expect(result.isOk()).toBe(true);
  });

  it("restore POSTs to the restore route with no body", async () => {
    vi.mocked(sessionGuard.post).mockResolvedValue({ status: 204, data: "" });
    const result = await TranscriptSuggestionApi.restore("s-1", "sug-1");
    expect(vi.mocked(sessionGuard.post).mock.calls[0]).toEqual([`${BASE}/sug-1/restore`]);
    expect(result.isOk()).toBe(true);
  });
});

describe("typed failures", () => {
  beforeEach(() => vi.clearAllMocks());

  it("409 on accept is no_longer_pending", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(httpError(409));
    expect(await failureOf(TranscriptSuggestionApi.accept("s-1", "sug-1", None))).toEqual({
      kind: "no_longer_pending",
    });
  });

  it("403 on dismiss is forbidden", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(httpError(403));
    expect(await failureOf(TranscriptSuggestionApi.dismiss("s-1", "sug-1"))).toEqual({
      kind: "forbidden",
    });
  });

  it("404 on restore is not_found", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(httpError(404));
    expect(await failureOf(TranscriptSuggestionApi.restore("s-1", "sug-1"))).toEqual({
      kind: "not_found",
    });
  });

  it("422 on update is invalid and carries the backend message when present", async () => {
    vi.mocked(sessionGuard.put).mockRejectedValue(
      httpError(422, { error: "unprocessable_entity", message: "Body must not be empty" })
    );
    expect(await failureOf(TranscriptSuggestionApi.update("s-1", "sug-1", edits))).toEqual({
      kind: "invalid",
      message: Some("Body must not be empty"),
    });
  });

  it("422 without a message is invalid with None", async () => {
    vi.mocked(sessionGuard.put).mockRejectedValue(httpError(422, "plain text"));
    expect(await failureOf(TranscriptSuggestionApi.update("s-1", "sug-1", edits))).toEqual({
      kind: "invalid",
      message: None,
    });
  });

  it("no response is network", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(networkError());
    expect(await failureOf(TranscriptSuggestionApi.accept("s-1", "sug-1", None))).toEqual({
      kind: "network",
    });
  });

  it("any other status is unexpected with that status", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(httpError(500));
    expect(await failureOf(TranscriptSuggestionApi.dismiss("s-1", "sug-1"))).toEqual({
      kind: "unexpected",
      status: Some(500),
    });
  });

  it("a non-axios throw is unexpected with no status", async () => {
    vi.mocked(sessionGuard.post).mockRejectedValue(new TypeError("boom"));
    expect(await failureOf(TranscriptSuggestionApi.dismiss("s-1", "sug-1"))).toEqual({
      kind: "unexpected",
      status: None,
    });
  });
});
