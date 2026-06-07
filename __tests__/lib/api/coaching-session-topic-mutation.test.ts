import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCoachingSessionTopicMutation } from "@/lib/api/coaching-session-topics";
import { TopicRelevance } from "@/types/coaching-session-topic";
import { EntityApi } from "@/lib/api/entity-api";
import { sessionGuard } from "@/lib/auth/session-guard";
import { TestProviders } from "@/test-utils/providers";

vi.mock("@/lib/api/entity-api", () => ({
  EntityApi: {
    listNestedFn: vi.fn(),
    createFn: vi.fn().mockResolvedValue({}),
    updateFn: vi.fn().mockResolvedValue({}),
    deleteFn: vi.fn().mockResolvedValue({}),
    useEntityList: vi.fn(),
    // Pass-through mutation wrapper: invoke the provided api method directly so
    // the test asserts which underlying call the hook wires each action to.
    useEntityMutation: vi.fn((_baseUrl, api) => ({
      create: api.create,
      update: api.update,
      delete: api.delete,
      isLoading: false,
      error: null,
    })),
  },
}));

vi.mock("@/lib/auth/session-guard", () => ({
  sessionGuard: { patch: vi.fn().mockResolvedValue({ data: { data: [] } }) },
}));

vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:3000" } },
}));

const TOPICS = "http://localhost:3000/coaching_sessions/s1/topics";

describe("useCoachingSessionTopicMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  const render = () =>
    renderHook(() => useCoachingSessionTopicMutation("s1"), {
      wrapper: TestProviders,
    });

  it("create POSTs just the body to the nested topics collection", async () => {
    const { result } = render();
    await act(async () => {
      await result.current.create("Talk about the reorg");
    });
    expect(EntityApi.createFn).toHaveBeenCalledWith(TOPICS, {
      body: "Talk about the reorg",
    });
    expect(EntityApi.updateFn).not.toHaveBeenCalled();
    expect(EntityApi.deleteFn).not.toHaveBeenCalled();
  });

  it("update PUTs only changed fields under the topic id", async () => {
    const { result } = render();
    await act(async () => {
      await result.current.update("t1", { relevance: TopicRelevance.Central });
    });
    expect(EntityApi.updateFn).toHaveBeenCalledWith(`${TOPICS}/t1`, {
      relevance: "central",
    });
    expect(EntityApi.createFn).not.toHaveBeenCalled();
  });

  it("delete DELETEs the nested topic", async () => {
    const { result } = render();
    await act(async () => {
      await result.current.delete("t1");
    });
    expect(EntityApi.deleteFn).toHaveBeenCalledWith(`${TOPICS}/t1`);
    expect(EntityApi.createFn).not.toHaveBeenCalled();
  });

  it("reorder PATCHes the full ordered id list to the reorder endpoint", async () => {
    const { result } = render();
    await act(async () => {
      await result.current.reorder(["t3", "t1", "t2"]);
    });
    expect(sessionGuard.patch).toHaveBeenCalledWith(`${TOPICS}/reorder`, {
      topic_ids: ["t3", "t1", "t2"],
    });
  });
});
