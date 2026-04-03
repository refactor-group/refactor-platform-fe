import { describe, it, expect } from "vitest";
import {
  assignmentFilterToUserActionsParams,
  assignmentFilterToCoacheeActionsParams,
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

describe("assignmentFilterToCoacheeActionsParams", () => {
  it("maps Assigned to assignee=coachee with no assignee filter", () => {
    const result = assignmentFilterToCoacheeActionsParams(AssignmentFilter.Assigned);
    expect(result).toEqual({ assignee: AssigneeScope.Coachee });
    expect(result.assigneeFilter).toBeUndefined();
  });

  it("maps Unassigned to assignee=coachee with assignee_filter=unassigned", () => {
    const result = assignmentFilterToCoacheeActionsParams(AssignmentFilter.Unassigned);
    expect(result).toEqual({
      assignee: AssigneeScope.Coachee,
      assigneeFilter: UserActionsAssigneeFilter.Unassigned,
    });
  });

  it("maps All to assignee=coachee with no assignee filter", () => {
    const result = assignmentFilterToCoacheeActionsParams(AssignmentFilter.All);
    expect(result).toEqual({ assignee: AssigneeScope.Coachee });
    expect(result.assigneeFilter).toBeUndefined();
  });
});
