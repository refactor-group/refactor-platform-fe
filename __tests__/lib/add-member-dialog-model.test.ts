import { describe, expect, it } from "vitest";
import {
  AddMemberMode,
  AddMemberStep,
  emptyNewPerson,
  JoinRelationship,
  accessExplanation,
  inviteRelationshipOf,
  joinerOf,
  leadOf,
  newUserOf,
  railOf,
  relationshipDescription,
  relationshipExplanation,
  stepOrder,
  stepTitle,
  summaryLine,
} from "@/lib/add-member-dialog-model";
import type { Member } from "@/lib/add-relationship-dialog-model";
import { RelationshipKind } from "@/types/coaching-relationship";
import { None, Some } from "@/types/option";
import { Role } from "@/types/user";

const ADA_FIELDS = { firstName: " Ada ", lastName: "Lovelace", displayName: "Ada", email: "ada@example.com", timezone: "UTC" };
const ADA = { firstName: "Ada", fullName: "Ada Lovelace", email: "ada@example.com" };
const GRACE: Member = {
  userId: "grace",
  firstName: "Grace",
  fullName: "Grace Hopper",
  initials: "GH",
  email: "grace@example.com",
};

describe("joinerOf", () => {
  it("needs every new-person field and an email-shaped address", () => {
    expect(joinerOf(AddMemberMode.Create, emptyNewPerson("UTC"), None)).toEqual(None);
    expect(joinerOf(AddMemberMode.Create, { ...ADA_FIELDS, email: "ada" }, None)).toEqual(None);
    expect(joinerOf(AddMemberMode.Create, ADA_FIELDS, None)).toEqual(Some(ADA));
  });

  it("takes an existing person from the lookup", () => {
    const found = { id: "ada", first_name: "Ada", last_name: "Lovelace", email: "ada@example.com" };
    expect(joinerOf(AddMemberMode.Existing, ADA_FIELDS, None)).toEqual(None);
    expect(joinerOf(AddMemberMode.Existing, emptyNewPerson("UTC"), Some(found))).toEqual(Some(ADA));
  });
});

describe("stepOrder", () => {
  it("asks access only for an existing account, and a person only for a relationship", () => {
    expect(stepOrder(AddMemberMode.Create, JoinRelationship.None, true)).toEqual([
      AddMemberStep.Person,
      AddMemberStep.Relationship,
    ]);
    expect(stepOrder(AddMemberMode.Existing, JoinRelationship.Coachee, true)).toEqual([
      AddMemberStep.Person,
      AddMemberStep.Access,
      AddMemberStep.Relationship,
      AddMemberStep.With,
    ]);
  });

  it("skips the relationship when there's nobody to pair with", () => {
    expect(stepOrder(AddMemberMode.Create, JoinRelationship.Coachee, false)).toEqual([AddMemberStep.Person]);
  });
});

describe("copy", () => {
  it("names the person once known", () => {
    const none = JoinRelationship.None;
    expect(stepTitle(AddMemberStep.Person, None, "Acme", none)).toBe("New member details");
    expect(stepTitle(AddMemberStep.Access, Some(ADA), "Acme", none)).toBe("Ada's access to Acme");
    expect(stepTitle(AddMemberStep.Relationship, Some(ADA), "Acme", none)).toBe("Ada's relationship");
    expect(stepTitle(AddMemberStep.With, Some(ADA), "Acme", JoinRelationship.Coachee)).toBe("Choose Ada's coach");
    expect(stepTitle(AddMemberStep.With, Some(ADA), "Acme", JoinRelationship.Colleague)).toBe("Choose Ada's colleague");
  });

  it("describes the coachee choice like Pair with…", () => {
    expect(relationshipDescription(JoinRelationship.Coachee, ADA)).toBe(
      "Ada is coached by the person you pair them with in the next step."
    );
    expect(relationshipDescription(JoinRelationship.Colleague, ADA)).toBe(
      "Ada and the person you pair them with in the next step work together as peers."
    );
  });

  it("explains access and a relationship from the card's (i), but not None", () => {
    expect(accessExplanation(Role.Admin)).toBe("Everything a member can do, plus adding, removing and pairing members in this organization.");
    expect(relationshipExplanation(JoinRelationship.None)).toEqual(None);
    expect(relationshipExplanation(JoinRelationship.Coachee)).toEqual(
      Some("Meets with their coach, who schedules their sessions. Sees only the actions assigned to them.")
    );
  });

  it("summarizes who joins, how, and with whom", () => {
    expect(summaryLine(ADA, "Acme", Role.User, JoinRelationship.None, None)).toBe("Ada Lovelace to Acme as a member");
    expect(summaryLine(ADA, "Acme", Role.Admin, JoinRelationship.Coachee, Some(GRACE))).toBe(
      "Ada Lovelace to Acme as an admin, coached by Grace Hopper"
    );
    expect(summaryLine(ADA, "Acme", Role.User, JoinRelationship.Colleague, Some(GRACE))).toBe(
      "Ada Lovelace to Acme as a member, Grace Hopper's colleague"
    );
  });
});

describe("the request", () => {
  it("sends a relationship only for a choice with a person", () => {
    expect(inviteRelationshipOf(JoinRelationship.None, Some(GRACE))).toEqual(None);
    expect(inviteRelationshipOf(JoinRelationship.Coachee, None)).toEqual(None);
    expect(inviteRelationshipOf(JoinRelationship.Coachee, Some(GRACE))).toEqual(
      Some({ with_user_id: "grace", kind: RelationshipKind.Coaching })
    );
    expect(inviteRelationshipOf(JoinRelationship.Colleague, Some(GRACE))).toEqual(
      Some({ with_user_id: "grace", kind: RelationshipKind.Colleague })
    );
  });

  it("trims the new person and leaves relationship off without one", () => {
    expect(newUserOf(ADA_FIELDS, None)).toEqual({
      first_name: "Ada",
      last_name: "Lovelace",
      display_name: "Ada",
      email: "ada@example.com",
      timezone: "UTC",
    });
    const colleague = { with_user_id: "grace", kind: RelationshipKind.Colleague };
    expect(newUserOf(ADA_FIELDS, Some(colleague))).toHaveProperty("relationship", colleague);
  });

  it("sends the time zone chosen for the new person", () => {
    expect(newUserOf({ ...ADA_FIELDS, timezone: "Europe/London" }, None)).toHaveProperty("timezone", "Europe/London");
  });
});

describe("railOf", () => {
  const existing = {
    order: [AddMemberStep.Person, AddMemberStep.Access, AddMemberStep.Relationship],
    mode: AddMemberMode.Existing,
    joiner: None,
    role: Role.User,
    relationship: JoinRelationship.None,
    partner: None,
  };
  const doneOf = (input: Parameters<typeof railOf>[0]) => railOf(input).map((r) => [r.label, r.value, r.done]);

  it("prompts for the person, and leaves defaults undone until chosen or passed", () => {
    expect(doneOf({ ...existing, step: AddMemberStep.Person })).toEqual([
      ["Person", "Find their account", false],
      ["Access", "Member", false],
      ["Relationship", "None", false],
    ]);
    const created = { ...existing, mode: AddMemberMode.Create, order: [AddMemberStep.Person, AddMemberStep.Relationship] };
    expect(doneOf({ ...created, step: AddMemberStep.Person })[0]).toEqual(["Person", "Enter their account details", false]);
  });

  it("marks a default done once passed", () => {
    expect(doneOf({ ...existing, step: AddMemberStep.Relationship })).toEqual([
      ["Person", "Find their account", false],
      ["Access", "Member", true],
      ["Relationship", "None", false],
    ]);
  });

  it("marks a step done once something other than its default is chosen", () => {
    expect(
      doneOf({ ...existing, step: AddMemberStep.Person, role: Role.Admin, relationship: JoinRelationship.Coachee })
    ).toEqual([
      ["Person", "Find their account", false],
      ["Access", "Admin", true],
      ["Relationship", "Coachee", true],
    ]);
  });
});

describe("leadOf", () => {
  const onConfirm = () => {};
  const order = [AddMemberStep.Person, AddMemberStep.Relationship];

  it("hints at what the first step needs", () => {
    expect(
      leadOf({ step: AddMemberStep.Person, order, mode: AddMemberMode.Create, joiner: None, complete: false, submitting: false, onConfirm })
    ).toEqual({ kind: "hint", text: "Fill in their account details" });
  });

  it("confirms on the last step, disabled until complete", () => {
    expect(
      leadOf({ step: AddMemberStep.Relationship, order, mode: AddMemberMode.Create, joiner: Some(ADA), complete: false, submitting: false, onConfirm })
    ).toMatchObject({ kind: "confirm", label: "Add member", disabled: true });
  });
});
