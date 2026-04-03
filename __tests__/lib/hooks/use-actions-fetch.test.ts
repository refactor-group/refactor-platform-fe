import { describe, it, expect } from "vitest";
import {
  assignmentFilterToUserActionsParams,
  assignmentFilterToRelationshipActionsParams,
} from "@/lib/hooks/use-actions-fetch";
import {
  AssigneeScope,
  AssignmentFilter,
  UserActionsAssigneeFilter,
  UserActionsScope,
} from "@/types/assigned-actions";

describe("assignmentFilterToUserActionsParams", () => {
  it("maps Assigned to scope=assigned with no assignee filter", () => {
    const result = assignmentFilterToUserActionsParams(AssignmentFilter.Assigned);
    expect(result).toEqual({ scope: UserActionsScope.Assigned });
    expect(result.assigneeFilter).toBeUndefined();
  });

  it("maps Unassigned to scope=sessions with assignee_filter=unassigned", () => {
    const result = assignmentFilterToUserActionsParams(AssignmentFilter.Unassigned);
    expect(result).toEqual({
      scope: UserActionsScope.Sessions,
      assigneeFilter: UserActionsAssigneeFilter.Unassigned,
    });
  });

  it("maps All to scope=sessions with no assignee filter", () => {
    const result = assignmentFilterToUserActionsParams(AssignmentFilter.All);
    expect(result).toEqual({ scope: UserActionsScope.Sessions });
    expect(result.assigneeFilter).toBeUndefined();
  });
});

describe("assignmentFilterToRelationshipActionsParams", () => {
  it("maps Assigned to assignee=coachee with assignee_filter=assigned", () => {
    const result = assignmentFilterToRelationshipActionsParams(AssignmentFilter.Assigned);
    expect(result).toEqual({
      assignee: AssigneeScope.Coachee,
      assigneeFilter: UserActionsAssigneeFilter.Assigned,
    });
  });

  it("maps Unassigned to assignee_filter=unassigned with no assignee scope", () => {
    const result = assignmentFilterToRelationshipActionsParams(AssignmentFilter.Unassigned);
    expect(result).toEqual({
      assigneeFilter: UserActionsAssigneeFilter.Unassigned,
    });
    expect(result.assignee).toBeUndefined();
  });

  it("maps All to assignee=coachee with no assignee filter", () => {
    const result = assignmentFilterToRelationshipActionsParams(AssignmentFilter.All);
    expect(result).toEqual({ assignee: AssigneeScope.Coachee });
    expect(result.assigneeFilter).toBeUndefined();
  });

  it("returns distinct params for each filter value", () => {
    const assigned = assignmentFilterToRelationshipActionsParams(AssignmentFilter.Assigned);
    const unassigned = assignmentFilterToRelationshipActionsParams(AssignmentFilter.Unassigned);
    const all = assignmentFilterToRelationshipActionsParams(AssignmentFilter.All);

    // All three produce different param shapes
    expect(assigned).not.toEqual(unassigned);
    expect(assigned).not.toEqual(all);
    expect(unassigned).not.toEqual(all);

    // Assigned scopes to coachee AND filters to assigned
    expect(assigned.assignee).toBe(AssigneeScope.Coachee);
    expect(assigned.assigneeFilter).toBe(UserActionsAssigneeFilter.Assigned);

    // Unassigned omits assignee scope (unassigned actions have no assignee to scope by)
    expect(unassigned.assignee).toBeUndefined();
    expect(unassigned.assigneeFilter).toBe(UserActionsAssigneeFilter.Unassigned);

    // All scopes to coachee with no assignee filter (returns everything for coachee)
    expect(all.assignee).toBe(AssigneeScope.Coachee);
    expect(all.assigneeFilter).toBeUndefined();
  });
});
