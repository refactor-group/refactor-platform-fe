import { describe, it, expect } from "vitest";
import { assignmentFilterToApiParams } from "@/lib/hooks/use-actions-fetch";
import {
  AssignmentFilter,
  UserActionsAssigneeFilter,
  UserActionsScope,
} from "@/types/assigned-actions";

describe("assignmentFilterToApiParams", () => {
  it("maps Assigned to scope=assigned with no assignee filter", () => {
    const result = assignmentFilterToApiParams(AssignmentFilter.Assigned);
    expect(result).toEqual({ scope: UserActionsScope.Assigned });
    expect(result.assigneeFilter).toBeUndefined();
  });

  it("maps Unassigned to scope=sessions with assignee_filter=unassigned", () => {
    const result = assignmentFilterToApiParams(AssignmentFilter.Unassigned);
    expect(result).toEqual({
      scope: UserActionsScope.Sessions,
      assigneeFilter: UserActionsAssigneeFilter.Unassigned,
    });
  });

  it("maps All to scope=sessions with no assignee filter", () => {
    const result = assignmentFilterToApiParams(AssignmentFilter.All);
    expect(result).toEqual({ scope: UserActionsScope.Sessions });
    expect(result.assigneeFilter).toBeUndefined();
  });
});
