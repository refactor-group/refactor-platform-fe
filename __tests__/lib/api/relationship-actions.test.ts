import { describe, it, expect } from "vitest";
import { relationshipActionsUrl } from "@/lib/api/relationship-actions";
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
