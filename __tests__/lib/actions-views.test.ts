import { describe, it, expect } from "vitest";
import { actionsViewLabel, actionsViewsFor, relationshipsInView } from "@/lib/actions-views";
import { ActionsViewMode } from "@/types/assigned-actions";
import { RelationshipKind } from "@/types/coaching-relationship";
import { COACHEE_VIEWER, COLLEAGUE_VIEWER, createMockRelationship } from "../test-utils";

const coaching = createMockRelationship({ id: "coaching" });
const coached = createMockRelationship({ id: "coached", viewer: COACHEE_VIEWER });
const colleague = createMockRelationship({
  id: "colleague",
  kind: RelationshipKind.Colleague,
  viewer: COLLEAGUE_VIEWER,
});
const notMine = createMockRelationship({ id: "not-mine", viewer: null });

describe("actionsViewsFor", () => {
  it.each([
    ["coach and colleague", [coaching, colleague, coached], [ActionsViewMode.MyActions, ActionsViewMode.CoacheeActions, ActionsViewMode.ColleagueActions]],
    ["coach only", [coaching, coached], [ActionsViewMode.MyActions, ActionsViewMode.CoacheeActions]],
    ["colleague only", [colleague], [ActionsViewMode.MyActions, ActionsViewMode.ColleagueActions]],
    ["coachee only", [coached], [ActionsViewMode.MyActions]],
    ["in no relationship", [notMine], [ActionsViewMode.MyActions]],
  ])("gives a viewer who is %s their views", (_, relationships, views) => {
    expect(actionsViewsFor(relationships)).toEqual(views);
  });
});

describe("relationshipsInView", () => {
  const all = [coaching, coached, colleague];

  it.each([
    [ActionsViewMode.MyActions, ["coaching", "coached", "colleague"]],
    [ActionsViewMode.CoacheeActions, ["coaching"]],
    [ActionsViewMode.ColleagueActions, ["colleague"]],
  ])("narrows %s to the relationships its scope reads", (view, ids) => {
    expect(relationshipsInView(view, all).map((r) => r.id)).toEqual(ids);
  });
});

describe("actionsViewLabel", () => {
  it("names the colleagues' view in the plural", () => {
    expect(actionsViewLabel(ActionsViewMode.ColleagueActions)).toBe("Colleagues' Actions");
  });
});
