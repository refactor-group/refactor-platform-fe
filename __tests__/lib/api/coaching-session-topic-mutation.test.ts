// Hook-level test for useCoachingSessionTopicMutation. Scope is intentionally
// narrow: the exact URL/payload of each API call is owned by
// coaching-session-topics.test.ts. Here we only assert the hook's OWN mapping
// logic that no other layer exercises — `create` wraps a bare body.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCoachingSessionTopicMutation } from "@/lib/api/coaching-session-topics";
import { EntityApi } from "@/lib/api/entity-api";
import { TestProviders } from "@/test-utils/providers";

vi.mock("@/lib/api/entity-api", () => ({
  EntityApi: {
    listNestedFn: vi.fn(),
    createFn: vi.fn().mockResolvedValue({}),
    updateFn: vi.fn().mockResolvedValue({}),
    deleteFn: vi.fn().mockResolvedValue({}),
    useEntityList: vi.fn(),
    // Pass-through mutation wrapper: invoke the provided api method directly.
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
  sessionGuard: { patch: vi.fn().mockResolvedValue({ data: { data: [] } }), post: vi.fn() },
}));

vi.mock("@/site.config", () => ({
  siteConfig: { env: { backendServiceURL: "http://localhost:3000" } },
}));

const TOPICS = "http://localhost:3000/coaching_sessions/s1/topics";

describe("useCoachingSessionTopicMutation — hook-specific mapping", () => {
  beforeEach(() => vi.clearAllMocks());

  const render = () =>
    renderHook(() => useCoachingSessionTopicMutation("s1"), {
      wrapper: TestProviders,
    });

  it("create wraps a bare body (never sends a priority)", async () => {
    const { result } = render();
    await act(async () => {
      await result.current.create("Talk about the reorg");
    });
    expect(EntityApi.createFn).toHaveBeenCalledWith(TOPICS, {
      body: "Talk about the reorg",
    });
  });
});
