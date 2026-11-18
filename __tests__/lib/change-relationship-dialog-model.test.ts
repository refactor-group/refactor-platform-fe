import { describe, expect, it } from "vitest";
import type { Member } from "@/lib/add-relationship-dialog-model";
import {
  ChangeRelationshipStep,
  consequenceLines,
  hasChangeableRelationship,
  kindChange,
  leadOf,
  relationshipChoices,
  roleIn,
} from "@/lib/change-relationship-dialog-model";
import { type CoachingRelationshipWithUserNames, RelationshipKind } from "@/types/coaching-relationship";
import { RelationshipRole } from "@/types/relationship-role";

const CARA: Member = { userId: "cara", firstName: "Cara", fullName: "Cara Test", initials: "CT", email: "cara@example.com" };

const relationship = (
  coach: [string, string],
  coachee: [string, string],
  kind = RelationshipKind.Coaching,
  members = { coach: true, coachee: true }
) =>
  ({
    id: `${coach[0]}-${coachee[0]}`,
    coach_id: coach[0],
    coach_first_name: coach[1],
    coach_last_name: "X",
    coachee_id: coachee[0],
    coachee_first_name: coachee[1],
    coachee_last_name: "X",
    kind,
    coach_is_member: members.coach,
    coachee_is_member: members.coachee,
  }) as CoachingRelationshipWithUserNames;

const PAT_COACHES_CARA = relationship(["pat", "Pat"], ["cara", "Cara"]);
const CARA_COACHES_PAT = relationship(["cara", "Cara"], ["pat", "Pat"]);
const ANA_COLLEAGUE = relationship(["ana", "Ana"], ["cara", "Cara"], RelationshipKind.Colleague);
const LEFT_BEN = relationship(["cara", "Cara"], ["ben", "Ben"], RelationshipKind.Coaching, { coach: true, coachee: false });

describe("relationshipChoices", () => {
  it("lists each partner once, saying what they are to the member", () => {
    const choices = relationshipChoices(CARA, [PAT_COACHES_CARA, ANA_COLLEAGUE]);
    expect(choices.map((c) => [c.fullName, c.subline, c.selectable])).toEqual([
      ["Ana X", "Cara's colleague", true],
      ["Pat X", "Cara's coach", true],
    ]);
  });

  it("can't pick someone who left the organization", () => {
    const [ben] = relationshipChoices(CARA, [LEFT_BEN]);
    expect(ben.subline).toBe("Ben is no longer in this organization");
    expect(ben.selectable).toBe(false);
  });

  it("can't pick a pair who coach each other", () => {
    const choices = relationshipChoices(CARA, [PAT_COACHES_CARA, CARA_COACHES_PAT]);
    expect(choices).toHaveLength(1);
    expect(choices[0].subline).toBe("Cara's coach and coachee");
    expect(choices[0].selectable).toBe(false);
  });
});

describe("hasChangeableRelationship", () => {
  it("is false when every partner left", () => {
    expect(hasChangeableRelationship(CARA, [LEFT_BEN])).toBe(false);
    expect(hasChangeableRelationship(CARA, [LEFT_BEN, ANA_COLLEAGUE])).toBe(true);
  });
});

describe("roleIn and kindChange", () => {
  it("reads the member's role", () => {
    expect(roleIn(PAT_COACHES_CARA, "cara")).toBe(RelationshipRole.Coachee);
    expect(roleIn(CARA_COACHES_PAT, "cara")).toBe(RelationshipRole.Coach);
    expect(roleIn(ANA_COLLEAGUE, "cara")).toBe(RelationshipRole.Colleague);
  });

  it("names the coach for coaching and none for colleagues", () => {
    expect(kindChange("cara", "pat", RelationshipRole.Coach, false)).toEqual({
      kind: RelationshipKind.Coaching,
      coach_id: "cara",
      confirmed: false,
    });
    expect(kindChange("cara", "pat", RelationshipRole.Coachee, true)).toEqual({
      kind: RelationshipKind.Coaching,
      coach_id: "pat",
      confirmed: true,
    });
    expect(kindChange("cara", "pat", RelationshipRole.Colleague, true)).toEqual({
      kind: RelationshipKind.Colleague,
      confirmed: true,
    });
  });
});

describe("consequenceLines", () => {
  const names: Record<string, string> = { cara: "Cara Test", pat: "Pat X" };
  it("says who sees which actions and who gains or loses scheduling", () => {
    expect(
      consequenceLines(
        {
          actionsBecomingVisible: [{ userId: "cara", byAssignee: [{ assigneeId: "pat", count: 1 }] }],
          schedulingGained: ["cara"],
          schedulingLost: ["pat"],
        },
        (id) => names[id]
      )
    ).toEqual([
      "Cara Test will see 1 action assigned to Pat X",
      "Cara Test will be able to schedule sessions",
      "Pat X will no longer schedule sessions",
    ]);
  });
});

describe("leadOf", () => {
  const base = { hasPartner: true, changed: true, submitting: false, onConfirm: () => {} };
  it("confirms only once the preview is ready", () => {
    const loading = leadOf({ ...base, step: ChangeRelationshipStep.Review, preview: { kind: "loading" } });
    expect(loading).toMatchObject({ kind: "confirm", disabled: true });
    const ready = leadOf({
      ...base,
      step: ChangeRelationshipStep.Review,
      preview: { kind: "ready", consequences: { actionsBecomingVisible: [], schedulingGained: [], schedulingLost: [] } },
    });
    expect(ready).toMatchObject({ kind: "confirm", label: "Change relationship", disabled: false });
  });

  it("asks for a different role when nothing changed", () => {
    expect(leadOf({ ...base, changed: false, step: ChangeRelationshipStep.Role, preview: { kind: "idle" } })).toEqual({
      kind: "hint",
      text: "Choose a different role",
    });
  });
});
