import { describe, expect, it } from "vitest";
import {
  AddRelationshipStep,
  type Member,
  addedMessage,
  alreadyPaired,
  roleDescription,
  leadOf,
  newRelationship,
  partnerChoices,
  railOf,
  selectedPartner,
  stepTitle,
  summaryLine,
} from "@/lib/add-relationship-dialog-model";
import { type CoachingRelationshipWithUserNames, RelationshipKind } from "@/types/coaching-relationship";
import { None, Some } from "@/types/option";
import { RelationshipRole } from "@/types/relationship-role";

const member = (userId: string, first: string, last: string): Member => ({
  userId,
  firstName: first,
  fullName: `${first} ${last}`,
  initials: `${first[0]}${last[0]}`,
  email: `${first.toLowerCase()}@example.com`,
});

const CARA = member("cara", "Cara", "Test");
const PAT = member("pat", "Pat", "Coach");
const ANA = member("ana", "Ana", "Bell");
const MEMBERS = [PAT, CARA, ANA];

// Pat already coaches Cara.
const RELATIONSHIPS = [
  { coach_id: "pat", coachee_id: "cara", kind: RelationshipKind.Coaching } as CoachingRelationshipWithUserNames,
];

// Ana and Cara are colleagues.
const ANA_CARA_COLLEAGUES = [
  { coach_id: "ana", coachee_id: "cara", kind: RelationshipKind.Colleague } as CoachingRelationshipWithUserNames,
];

describe("newRelationship", () => {
  it("makes the partner the coach when the member is the coachee", () => {
    expect(newRelationship("cara", "pat", RelationshipRole.Coachee)).toEqual({
      coach_id: "pat",
      coachee_id: "cara",
      kind: RelationshipKind.Coaching,
    });
  });

  it("makes the member the coach when the member is the coach", () => {
    expect(newRelationship("cara", "pat", RelationshipRole.Coach)).toEqual({
      coach_id: "cara",
      coachee_id: "pat",
      kind: RelationshipKind.Coaching,
    });
  });

  it("marks a colleague relationship by kind", () => {
    expect(newRelationship("cara", "pat", RelationshipRole.Colleague)).toMatchObject({ kind: RelationshipKind.Colleague });
  });
});

describe("alreadyPaired", () => {
  it("matches only the same direction", () => {
    expect(alreadyPaired("cara", "pat", RelationshipRole.Coachee, RELATIONSHIPS)).toBe(true);
    expect(alreadyPaired("cara", "pat", RelationshipRole.Coach, RELATIONSHIPS)).toBe(false);
  });

  it("rules out colleagues for a coaching pair, either way round", () => {
    expect(alreadyPaired("cara", "pat", RelationshipRole.Colleague, RELATIONSHIPS)).toBe(true);
    expect(alreadyPaired("pat", "cara", RelationshipRole.Colleague, RELATIONSHIPS)).toBe(true);
  });

  it("rules out every role for colleagues", () => {
    for (const role of [RelationshipRole.Coachee, RelationshipRole.Coach, RelationshipRole.Colleague]) {
      expect(alreadyPaired("cara", "ana", role, ANA_CARA_COLLEAGUES)).toBe(true);
    }
  });
});

describe("partnerChoices", () => {
  it("lists everyone but the member, by name, with their email", () => {
    const people = partnerChoices(CARA, MEMBERS, None, RELATIONSHIPS);
    expect(people.map((p) => p.fullName)).toEqual(["Ana Bell", "Pat Coach"]);
    expect(people.every((p) => p.selectable)).toBe(true);
    expect(people[0].email).toBe("ana@example.com");
    expect(people[0].subline).toEqual(None);
  });

  it("keeps an existing coach visible but unpickable when adding a coach", () => {
    const pat = partnerChoices(CARA, MEMBERS, Some(RelationshipRole.Coachee), RELATIONSHIPS).find((p) => p.userId === "pat");
    expect(pat).toMatchObject({ selectable: false, subline: Some("Already Cara's coach") });
  });

  it("says why a pair is ruled out by what they already are", () => {
    const pat = partnerChoices(CARA, MEMBERS, Some(RelationshipRole.Colleague), RELATIONSHIPS).find((p) => p.userId === "pat");
    expect(pat?.subline).toEqual(Some("Already Cara's coach"));
    const ana = partnerChoices(CARA, MEMBERS, Some(RelationshipRole.Coach), ANA_CARA_COLLEAGUES).find((p) => p.userId === "ana");
    expect(ana).toMatchObject({ selectable: false, subline: Some("Already Cara's colleague") });
  });

  it("lets the same pair be added the other way round", () => {
    const pat = partnerChoices(CARA, MEMBERS, Some(RelationshipRole.Coach), RELATIONSHIPS).find((p) => p.userId === "pat");
    expect(pat?.selectable).toBe(true);
  });
});

describe("selectedPartner", () => {
  it("drops a pick that the role made unpickable", () => {
    const people = partnerChoices(CARA, MEMBERS, Some(RelationshipRole.Coachee), RELATIONSHIPS);
    expect(selectedPartner(Some("pat"), people, MEMBERS)).toEqual(None);
    expect(selectedPartner(Some("ana"), people, MEMBERS)).toEqual(Some(ANA));
  });
});

describe("copy", () => {
  it("titles the person step from the role", () => {
    expect(stepTitle(AddRelationshipStep.Role, CARA, None)).toBe("Cara's role");
    expect(stepTitle(AddRelationshipStep.Person, CARA, Some(RelationshipRole.Coachee))).toBe("Choose Cara's coach");
    expect(stepTitle(AddRelationshipStep.Person, CARA, Some(RelationshipRole.Coach))).toBe("Choose who Cara coaches");
    expect(stepTitle(AddRelationshipStep.Person, CARA, Some(RelationshipRole.Colleague))).toBe("Choose Cara's colleague");
  });

  it("describes each role against the next step", () => {
    expect(roleDescription(CARA.firstName, RelationshipRole.Coachee)).toBe(
      "Cara is coached by the person you pair them with in the next step."
    );
    expect(roleDescription(CARA.firstName, RelationshipRole.Coach)).toBe(
      "Cara coaches the person you pair them with in the next step."
    );
  });

  it("says who will coach whom", () => {
    expect(summaryLine(CARA, PAT, RelationshipRole.Coachee)).toBe("Pat Coach will coach Cara Test");
    expect(summaryLine(CARA, PAT, RelationshipRole.Coach)).toBe("Cara Test will coach Pat Coach");
    expect(summaryLine(CARA, PAT, RelationshipRole.Colleague)).toBe("Cara Test and Pat Coach will be colleagues");
  });

  it("confirms the partner's new role", () => {
    expect(addedMessage(CARA, PAT, RelationshipRole.Coachee)).toBe("Pat Coach is now Cara Test's coach");
    expect(addedMessage(CARA, PAT, RelationshipRole.Coach)).toBe("Pat Coach is now Cara Test's coachee");
    expect(addedMessage(CARA, PAT, RelationshipRole.Colleague)).toBe("Cara Test and Pat Coach are now colleagues");
  });
});

describe("railOf", () => {
  it("prompts for each choice until it's made", () => {
    const rail = railOf({ step: AddRelationshipStep.Role, role: None, partner: None });
    expect(rail.map((r) => [r.value, r.done, r.current])).toEqual([
      ["Choose a role", false, true],
      ["Choose a person", false, false],
    ]);
  });

  it("shows the choices once made", () => {
    const rail = railOf({ step: AddRelationshipStep.Person, role: Some(RelationshipRole.Coachee), partner: Some(PAT) });
    expect(rail.map((r) => [r.value, r.done, r.current])).toEqual([
      ["Coachee", true, false],
      ["Pat Coach", true, true],
    ]);
  });
});

describe("leadOf", () => {
  const onConfirm = () => {};

  it("asks for a role, then shows no confirm before the last step", () => {
    expect(leadOf({ step: AddRelationshipStep.Role, hasRole: false, complete: false, submitting: false, onConfirm })).toEqual({
      kind: "hint",
      text: "Choose a role first",
    });
    expect(leadOf({ step: AddRelationshipStep.Role, hasRole: true, complete: true, submitting: false, onConfirm })).toEqual({ kind: "none" });
  });

  it("disables confirm until both choices are made", () => {
    expect(leadOf({ step: AddRelationshipStep.Person, hasRole: true, complete: false, submitting: false, onConfirm })).toMatchObject({
      kind: "confirm",
      label: "Pair them",
      disabled: true,
    });
  });
});
