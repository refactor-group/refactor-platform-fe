import { describe, it, expect } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { SWRConfig, type Cache } from "swr";
import {
  relationshipActionsUrl,
  useForgetActionsOnOrganizationChange,
} from "@/lib/api/relationship-actions";
import {
  AssigneeScope,
  UserActionsAssigneeFilter,
} from "@/types/assigned-actions";

describe("relationshipActionsUrl", () => {
  const orgId = "org-123";
  const relId = "rel-456";

  it("includes assignee param in single-relationship URL (regression: was previously dropped)", () => {
    const params = {
      assignee: AssigneeScope.Coachee,
      assignee_filter: UserActionsAssigneeFilter.Assigned,
    };

    const batchUrl = relationshipActionsUrl(orgId, params);
    const singleUrl = relationshipActionsUrl(orgId, {
      ...params,
      coaching_relationship_id: relId,
    });

    // Both paths must include assignee=coachee so the backend filters
    // to coachee-only actions. The single-relationship path previously
    // used sharedQueryString which omitted the assignee param, causing
    // both "My Actions" and "Coachee Actions" to show identical results.
    expect(batchUrl).toContain("assignee=coachee");
    expect(singleUrl).toContain("assignee=coachee");
  });

  it("supports assignee=coach for My Actions path", () => {
    const params = {
      assignee: AssigneeScope.Coach,
      assignee_filter: UserActionsAssigneeFilter.Assigned,
    };

    const batchUrl = relationshipActionsUrl(orgId, params);
    const singleUrl = relationshipActionsUrl(orgId, {
      ...params,
      coaching_relationship_id: relId,
    });

    expect(batchUrl).toContain("assignee=coach");
    expect(singleUrl).toContain("assignee=coach");
  });
});

describe("useForgetActionsOnOrganizationChange", () => {
  const params = { assignee_filter: UserActionsAssigneeFilter.Assigned };
  // SWR keeps the original key on each entry (`_k`); filter mutations match on it.
  const seeded = (key: string, data: unknown) =>
    [key, { data, _k: key, error: undefined, isValidating: false, isLoading: false }] as const;

  it("forgets the action lists of the organization left, and only those", () => {
    const cache = new Map<string, unknown>([
      seeded(relationshipActionsUrl("org-a", params), ["a"]),
      seeded(relationshipActionsUrl("org-a", { ...params, coaching_relationship_id: "rel-1" }), ["a1"]),
      seeded(relationshipActionsUrl("org-b", params), ["b"]),
      seeded("https://example.test/organizations/org-a", { id: "org-a" }),
    ]);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(SWRConfig, { value: { provider: () => cache as Cache } }, children);

    const { rerender } = renderHook(
      ({ orgId }) => useForgetActionsOnOrganizationChange(orgId),
      { wrapper, initialProps: { orgId: "org-a" as string | null } }
    );
    rerender({ orgId: "org-b" });

    const dataAt = (key: string) => (cache.get(key) as { data: unknown } | undefined)?.data;
    return waitFor(() => {
      expect(dataAt(relationshipActionsUrl("org-a", params))).toBeUndefined();
      expect(
        dataAt(relationshipActionsUrl("org-a", { ...params, coaching_relationship_id: "rel-1" }))
      ).toBeUndefined();
      expect(dataAt(relationshipActionsUrl("org-b", params))).toEqual(["b"]);
      expect(dataAt("https://example.test/organizations/org-a")).toEqual({ id: "org-a" });
    });
  });
});
