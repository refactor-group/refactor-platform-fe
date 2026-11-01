import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import {
  assignmentFilterToRelationshipActionsParams,
  useActionsFetch,
} from "@/lib/hooks/use-actions-fetch";
import {
  AssigneeScope,
  AssignmentFilter,
  CoachViewMode,
  UserActionsAssigneeFilter,
} from "@/types/assigned-actions";
import { Some, None } from "@/types/option";
import { createMockRelationship } from "../../test-utils";

const h = vi.hoisted(() => ({
  relationships: {
    relationships: [] as unknown[],
    isLoading: false,
    isError: undefined as unknown,
  },
  fetch: vi.fn(),
}));

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ userId: "user-1" }),
}));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => h.relationships,
}));
vi.mock("@/lib/api/relationship-actions", () => ({
  useBatchRelationshipActions: (...args: unknown[]) => h.fetch(...args),
  useForgetActionsOnOrganizationChange: vi.fn(),
}));

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

describe("useActionsFetch", () => {
  const coaching = createMockRelationship({ coach_id: "user-1", coachee_id: "user-2" });
  const coached = createMockRelationship({ coach_id: "user-3", coachee_id: "user-1" });
  const myActions = () =>
    renderHook(() => useActionsFetch(CoachViewMode.MyActions, undefined, AssignmentFilter.Assigned));

  beforeEach(() => {
    h.relationships = { relationships: [coaching], isLoading: false, isError: undefined };
    h.fetch.mockReset().mockReturnValue({ actions: [], isLoading: false, isError: false, refresh: vi.fn() });
  });

  it("scopes to the coach role when the user coaches someone in the organization", () => {
    myActions();
    expect(h.fetch).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ assignee: AssigneeScope.Coach }),
      undefined
    );
  });

  it("leaves the scope to the backend when the user is only coached", () => {
    h.relationships.relationships = [coached];
    myActions();
    expect(h.fetch).toHaveBeenCalledWith("org-1", expect.objectContaining({ assignee: undefined }), undefined);
  });

  it("waits for the relationships before fetching, so the scope never flips", () => {
    h.relationships = { relationships: [], isLoading: true, isError: undefined };
    const { result } = myActions();

    expect(h.fetch.mock.calls.every(([orgId]) => orgId === null)).toBe(true);
    expect(result.current.isLoading).toBe(true);
  });

  it("reports an error without fetching when the relationships fail", () => {
    h.relationships = { relationships: [], isLoading: false, isError: new Error("boom") };
    const { result } = myActions();

    expect(h.fetch.mock.calls.every(([orgId]) => orgId === null)).toBe(true);
    expect(result.current.isError).toBe(true);
  });

  it("passes SWR options through", () => {
    const options = { revalidateOnFocus: false };
    renderHook(() => useActionsFetch(CoachViewMode.MyActions, undefined, AssignmentFilter.Assigned, options));
    expect(h.fetch).toHaveBeenCalledWith("org-1", expect.anything(), options);
  });
});
