// FROZEN ACCEPTANCE TEST (overseer-handoff-workflow).
// These assertions define the Phase 1 wire contract for CoachingSessionTopicApi.
// This file is set read-only (chmod 0444) and is on the freeze list: an
// IMPLEMENTER must NOT edit it. Only the overseer may unlock it, and only to
// correct a genuine spec/harness error — never to fit the implementation.
//
// Pattern mirrors __tests__/lib/api/goals.test.ts: mock EntityApi + siteConfig +
// sessionGuard, then assert the API module builds the exact URL / payload.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CoachingSessionTopicApi,
  useCoachingSessionTopicList,
} from "@/lib/api/coaching-session-topics";
import { TopicRelevance } from "@/types/coaching-session-topic";
import { EntityApi } from "@/lib/api/entity-api";
import { sessionGuard } from "@/lib/auth/session-guard";
import { renderHook } from "@testing-library/react";
import { TestProviders } from "@/test-utils/providers";

vi.mock("@/lib/api/entity-api", () => ({
  EntityApi: {
    listNestedFn: vi.fn(),
    getFn: vi.fn(),
    createFn: vi.fn(),
    updateFn: vi.fn(),
    deleteFn: vi.fn(),
    useEntityList: vi.fn(),
    useEntityMutation: vi.fn(),
  },
}));

// reorder uses PATCH, which EntityApi does not provide a helper for, so the
// module calls sessionGuard.patch directly.
vi.mock("@/lib/auth/session-guard", () => ({
  sessionGuard: { patch: vi.fn() },
}));

vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:3000" } },
}));

const BASE = "http://localhost:3000/coaching_sessions";

describe("CoachingSessionTopicApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("list fetches topics nested under the coaching session (server-ordered)", async () => {
    vi.mocked(EntityApi.listNestedFn).mockResolvedValue([]);
    await CoachingSessionTopicApi.list("s1");
    expect(EntityApi.listNestedFn).toHaveBeenCalledWith(BASE, "s1", "topics", {});
  });

  it("create POSTs just the body to the nested topics collection", async () => {
    vi.mocked(EntityApi.createFn).mockResolvedValue({});
    await CoachingSessionTopicApi.create("s1", "Talk about the reorg");
    expect(EntityApi.createFn).toHaveBeenCalledWith(`${BASE}/s1/topics`, {
      body: "Talk about the reorg",
    });
  });

  it("update PUTs only changed fields, serializing the rating enum to its snake_case wire value", async () => {
    vi.mocked(EntityApi.updateFn).mockResolvedValue({});
    await CoachingSessionTopicApi.update("s1", "t1", {
      relevance: TopicRelevance.Central,
    });
    expect(EntityApi.updateFn).toHaveBeenCalledWith(`${BASE}/s1/topics/t1`, {
      relevance: "central",
    });
  });

  it("update PUTs a body edit", async () => {
    vi.mocked(EntityApi.updateFn).mockResolvedValue({});
    await CoachingSessionTopicApi.update("s1", "t1", { body: "edited body" });
    expect(EntityApi.updateFn).toHaveBeenCalledWith(`${BASE}/s1/topics/t1`, {
      body: "edited body",
    });
  });

  it("delete DELETEs the nested topic", async () => {
    vi.mocked(EntityApi.deleteFn).mockResolvedValue({});
    await CoachingSessionTopicApi.delete("s1", "t1");
    expect(EntityApi.deleteFn).toHaveBeenCalledWith(`${BASE}/s1/topics/t1`);
  });

  it("reorder PATCHes the full ordered id list to the reorder endpoint", async () => {
    vi.mocked(sessionGuard.patch).mockResolvedValue({
      data: { data: [] },
    } as never);
    await CoachingSessionTopicApi.reorder("s1", ["t3", "t1", "t2"]);
    expect(sessionGuard.patch).toHaveBeenCalledWith(`${BASE}/s1/topics/reorder`, {
      topic_ids: ["t3", "t1", "t2"],
    });
  });
});

describe("useCoachingSessionTopicList", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keys SWR on the session-scoped topics URL (so mutations invalidate it)", () => {
    vi.mocked(EntityApi.useEntityList).mockReturnValue({
      entities: [],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    });
    renderHook(() => useCoachingSessionTopicList("s1"), {
      wrapper: TestProviders,
    });
    const call = vi.mocked(EntityApi.useEntityList).mock.calls[0];
    expect(call[0]).toBe(`${BASE}/s1/topics`);
    expect(typeof call[1]).toBe("function");
  });
});
