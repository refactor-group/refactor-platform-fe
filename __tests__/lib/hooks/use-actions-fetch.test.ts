import { describe, it, expect } from "vitest";
import { assignmentFilterToRelationshipActionsParams } from "@/lib/hooks/use-actions-fetch";
import {
  AssigneeScope,
  AssignmentFilter,
  UserActionsAssigneeFilter,
} from "@/types/assigned-actions";
import { Some, None } from "@/types/option";

describe("assignmentFilterToRelationshipActionsParams", () => {
  describe("with Some(coachee) scope", () => {
    it("maps Assigned to assignee=coachee with assignee_filter=assigned", () => {
      const result = assignmentFilterToRelationshipActionsParams(
        AssignmentFilter.Assigned,
        Some(AssigneeScope.Coachee)
      );
      expect(result).toEqual({
        assignee: AssigneeScope.Coachee,
        assigneeFilter: UserActionsAssigneeFilter.Assigned,
      });
    });

    it("maps All to assignee=coachee with no assignee filter", () => {
      const result = assignmentFilterToRelationshipActionsParams(
        AssignmentFilter.All,
        Some(AssigneeScope.Coachee)
      );
      expect(result).toEqual({ assignee: AssigneeScope.Coachee });
      expect(result.assigneeFilter).toBeUndefined();
    });
  });

  describe("with Some(coach) scope", () => {
    it("maps Assigned to assignee=coach with assignee_filter=assigned", () => {
      const result = assignmentFilterToRelationshipActionsParams(
        AssignmentFilter.Assigned,
        Some(AssigneeScope.Coach)
      );
      expect(result).toEqual({
        assignee: AssigneeScope.Coach,
        assigneeFilter: UserActionsAssigneeFilter.Assigned,
      });
    });

    it("maps All to assignee=coach with no assignee filter", () => {
      const result = assignmentFilterToRelationshipActionsParams(
        AssignmentFilter.All,
        Some(AssigneeScope.Coach)
      );
      expect(result).toEqual({ assignee: AssigneeScope.Coach });
      expect(result.assigneeFilter).toBeUndefined();
    });
  });

  describe("with None scope (coachee broad view)", () => {
    it("maps Assigned to no assignee + assignee_filter=assigned", () => {
      const result = assignmentFilterToRelationshipActionsParams(
        AssignmentFilter.Assigned,
        None
      );
      expect(result).toEqual({
        assignee: undefined,
        assigneeFilter: UserActionsAssigneeFilter.Assigned,
      });
    });

    it("maps All to no assignee and no assignee filter", () => {
      const result = assignmentFilterToRelationshipActionsParams(
        AssignmentFilter.All,
        None
      );
      expect(result.assignee).toBeUndefined();
      expect(result.assigneeFilter).toBeUndefined();
    });
  });

  it("Unassigned ignores scope — returns only assignee_filter=unassigned", () => {
    const coachResult = assignmentFilterToRelationshipActionsParams(
      AssignmentFilter.Unassigned,
      Some(AssigneeScope.Coach)
    );
    const coacheeResult = assignmentFilterToRelationshipActionsParams(
      AssignmentFilter.Unassigned,
      Some(AssigneeScope.Coachee)
    );
    const noneResult = assignmentFilterToRelationshipActionsParams(
      AssignmentFilter.Unassigned,
      None
    );
    const expected = {
      assigneeFilter: UserActionsAssigneeFilter.Unassigned,
    };
    expect(coachResult).toEqual(expected);
    expect(coacheeResult).toEqual(expected);
    expect(noneResult).toEqual(expected);
    expect(coachResult.assignee).toBeUndefined();
  });

  it("returns distinct params for each filter value", () => {
    const assigned = assignmentFilterToRelationshipActionsParams(
      AssignmentFilter.Assigned,
      Some(AssigneeScope.Coachee)
    );
    const unassigned = assignmentFilterToRelationshipActionsParams(
      AssignmentFilter.Unassigned,
      Some(AssigneeScope.Coachee)
    );
    const all = assignmentFilterToRelationshipActionsParams(
      AssignmentFilter.All,
      Some(AssigneeScope.Coachee)
    );

    expect(assigned).not.toEqual(unassigned);
    expect(assigned).not.toEqual(all);
    expect(unassigned).not.toEqual(all);
  });
});
