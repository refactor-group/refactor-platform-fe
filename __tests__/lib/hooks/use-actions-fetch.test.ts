import { describe, it, expect } from "vitest";
import { assignmentFilterToRelationshipActionsParams } from "@/lib/hooks/use-actions-fetch";
import {
  AssigneeScope,
  AssignmentFilter,
  UserActionsAssigneeFilter,
} from "@/types/assigned-actions";

describe("assignmentFilterToRelationshipActionsParams", () => {
  describe("with coachee scope", () => {
    it("maps Assigned to assignee=coachee with assignee_filter=assigned", () => {
      const result = assignmentFilterToRelationshipActionsParams(
        AssignmentFilter.Assigned,
        AssigneeScope.Coachee
      );
      expect(result).toEqual({
        assignee: AssigneeScope.Coachee,
        assigneeFilter: UserActionsAssigneeFilter.Assigned,
      });
    });

    it("maps All to assignee=coachee with no assignee filter", () => {
      const result = assignmentFilterToRelationshipActionsParams(
        AssignmentFilter.All,
        AssigneeScope.Coachee
      );
      expect(result).toEqual({ assignee: AssigneeScope.Coachee });
      expect(result.assigneeFilter).toBeUndefined();
    });
  });

  describe("with coach scope", () => {
    it("maps Assigned to assignee=coach with assignee_filter=assigned", () => {
      const result = assignmentFilterToRelationshipActionsParams(
        AssignmentFilter.Assigned,
        AssigneeScope.Coach
      );
      expect(result).toEqual({
        assignee: AssigneeScope.Coach,
        assigneeFilter: UserActionsAssigneeFilter.Assigned,
      });
    });

    it("maps All to assignee=coach with no assignee filter", () => {
      const result = assignmentFilterToRelationshipActionsParams(
        AssignmentFilter.All,
        AssigneeScope.Coach
      );
      expect(result).toEqual({ assignee: AssigneeScope.Coach });
      expect(result.assigneeFilter).toBeUndefined();
    });
  });

  it("Unassigned ignores scope — returns only assignee_filter=unassigned", () => {
    const coachResult = assignmentFilterToRelationshipActionsParams(
      AssignmentFilter.Unassigned,
      AssigneeScope.Coach
    );
    const coacheeResult = assignmentFilterToRelationshipActionsParams(
      AssignmentFilter.Unassigned,
      AssigneeScope.Coachee
    );
    const expected = {
      assigneeFilter: UserActionsAssigneeFilter.Unassigned,
    };
    expect(coachResult).toEqual(expected);
    expect(coacheeResult).toEqual(expected);
    expect(coachResult.assignee).toBeUndefined();
  });

  it("returns distinct params for each filter value", () => {
    const assigned = assignmentFilterToRelationshipActionsParams(
      AssignmentFilter.Assigned,
      AssigneeScope.Coachee
    );
    const unassigned = assignmentFilterToRelationshipActionsParams(
      AssignmentFilter.Unassigned,
      AssigneeScope.Coachee
    );
    const all = assignmentFilterToRelationshipActionsParams(
      AssignmentFilter.All,
      AssigneeScope.Coachee
    );

    expect(assigned).not.toEqual(unassigned);
    expect(assigned).not.toEqual(all);
    expect(unassigned).not.toEqual(all);
  });
});
