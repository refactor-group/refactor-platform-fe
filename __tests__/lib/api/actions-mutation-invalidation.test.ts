import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useActionMutation } from "@/lib/api/actions";
import { relationshipActionsUrl } from "@/lib/api/relationship-actions";
import { UserActionsAssigneeFilter } from "@/types/assigned-actions";
import { siteConfig } from "@/site.config";

const h = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("swr", async (importOriginal) => ({
  ...(await importOriginal<typeof import("swr")>()),
  useSWRConfig: () => ({ mutate: h.mutate }),
}));
vi.mock("@/lib/api/entity-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/entity-api")>();
  const ok = () => Promise.resolve({ id: "action-1" });
  return {
    ...actual,
    EntityApi: {
      ...actual.EntityApi,
      useEntityMutation: () => ({
        create: ok,
        createNested: ok,
        update: ok,
        delete: ok,
        deleteNested: ok,
        isLoading: false,
        error: null,
      }),
    },
  };
});

const matcherFrom = (call: unknown[]) => call[0] as (key: unknown) => boolean;

describe("useActionMutation", () => {
  beforeEach(() => h.mutate.mockReset());

  it.each(["create", "update", "delete"] as const)(
    "revalidates nested action lists after %s",
    async (operation) => {
      const { result } = renderHook(() => useActionMutation());
      await (result.current[operation] as (...args: unknown[]) => Promise<unknown>)("action-1", {});

      const batchUrl = relationshipActionsUrl("org-1", {
        assignee: "user-1",
        assignee_filter: UserActionsAssigneeFilter.Assigned,
      });
      const matches = matcherFrom(h.mutate.mock.calls[0]);
      expect(matches(batchUrl)).toBe(true);
      expect(matches(`${siteConfig.env.backendServiceURL}/coaching_sessions`)).toBe(false);
      expect(h.mutate.mock.calls[0][2]).toEqual({ revalidate: true, populateCache: false });
    }
  );
});
