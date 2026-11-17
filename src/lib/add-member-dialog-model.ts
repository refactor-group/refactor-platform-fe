import type { StepDialogLead, StepRailItem } from "@/components/ui/step-dialog";
import { type Member, roleDescription } from "@/lib/add-relationship-dialog-model";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import { RelationshipRole, relationshipRoleExplanation } from "@/types/relationship-role";
import { type NewUser, Role, type UserLookupResult } from "@/types/user";

/** Values match the members page's `?addMember=` param. */
export enum AddMemberMode {
  Create = "create",
  Existing = "existing",
}

export enum AddMemberStep {
  Person = "person",
  Access = "access",
  Relationship = "relationship",
  With = "with",
}

/** What the new member becomes in an optional first relationship. */
export enum JoinRelationship {
  None = "none",
  Coachee = "coachee",
}

export const JOIN_RELATIONSHIPS: readonly JoinRelationship[] = [JoinRelationship.None, JoinRelationship.Coachee];

export const ACCESS_ROLES: readonly Role[] = [Role.User, Role.Admin];

export interface NewPersonFields {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
}

export const EMPTY_NEW_PERSON: NewPersonFields = { firstName: "", lastName: "", displayName: "", email: "" };

/** The person being added, once there's enough to name them. */
export interface Joiner {
  firstName: string;
  fullName: string;
  email: string;
}

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function newPersonComplete(fields: NewPersonFields): boolean {
  return (
    fields.firstName.trim() !== "" &&
    fields.lastName.trim() !== "" &&
    fields.displayName.trim() !== "" &&
    LOOKS_LIKE_EMAIL.test(fields.email.trim())
  );
}

export function joinerOf(
  mode: AddMemberMode,
  fields: NewPersonFields,
  found: Option<UserLookupResult>
): Option<Joiner> {
  switch (mode) {
    case AddMemberMode.Create:
      if (!newPersonComplete(fields)) return None;
      return Some({
        firstName: fields.firstName.trim(),
        fullName: `${fields.firstName.trim()} ${fields.lastName.trim()}`,
        email: fields.email.trim(),
      });
    case AddMemberMode.Existing:
      if (found.none) return None;
      return Some({
        firstName: found.val.first_name,
        fullName: `${found.val.first_name} ${found.val.last_name}`.trim(),
        email: found.val.email,
      });
    default: {
      const _exhaustive: never = mode;
      throw new Error(`Unhandled add member mode: ${_exhaustive}`);
    }
  }
}

/**
 * A brand new account always joins as a member, so only an existing one picks access.
 * With nobody to pair them with, there's no relationship to choose.
 */
export function stepOrder(mode: AddMemberMode, relationship: JoinRelationship, canPair: boolean): AddMemberStep[] {
  return [
    AddMemberStep.Person,
    ...(mode === AddMemberMode.Existing ? [AddMemberStep.Access] : []),
    ...(canPair ? [AddMemberStep.Relationship] : []),
    ...(canPair && relationship !== JoinRelationship.None ? [AddMemberStep.With] : []),
  ];
}

export function accessLabel(role: Role): string {
  return role === Role.Admin ? "Admin" : "Member";
}

export function accessDescription(role: Role): string {
  return role === Role.Admin
    ? "Manages this organization's members and relationships."
    : "Works with the people they're paired with.";
}

/** More than the card line says, from the card's (i). */
export function accessExplanation(role: Role): string {
  return role === Role.Admin
    ? "Everything a member can do, plus adding, removing and pairing members in this organization."
    : "Can be paired with people in this organization and work with them. Can't add or pair members.";
}

export function relationshipExplanation(relationship: JoinRelationship): Option<string> {
  return relationship === JoinRelationship.None ? None : Some(relationshipRoleExplanation(RelationshipRole.Coachee));
}

export function relationshipLabel(relationship: JoinRelationship): string {
  return relationship === JoinRelationship.None ? "None" : "Coachee";
}

export function relationshipDescription(relationship: JoinRelationship, joiner: Joiner): string {
  return relationship === JoinRelationship.None
    ? "Pair them later from their member card."
    : roleDescription(joiner.firstName, RelationshipRole.Coachee);
}

export function stepTitle(step: AddMemberStep, joiner: Option<Joiner>, organizationName: string): string {
  const possessive = joiner.some ? `${joiner.val.firstName}'s` : "Their";
  switch (step) {
    case AddMemberStep.Person:
      return "New member details";
    case AddMemberStep.Access:
      return `${possessive} access to ${organizationName}`;
    case AddMemberStep.Relationship:
      return `${possessive} relationship`;
    case AddMemberStep.With:
      return `${possessive} coach`;
    default: {
      const _exhaustive: never = step;
      throw new Error(`Unhandled add member step: ${_exhaustive}`);
    }
  }
}

interface RailInput {
  step: AddMemberStep;
  order: readonly AddMemberStep[];
  mode: AddMemberMode;
  joiner: Option<Joiner>;
  role: Role;
  relationship: JoinRelationship;
  coach: Option<Member>;
}

function railItem(step: AddMemberStep, input: RailInput): StepRailItem {
  const current = input.step === step;
  const passed = input.order.indexOf(step) < input.order.indexOf(input.step);
  switch (step) {
    case AddMemberStep.Person:
      return {
        id: step,
        label: "Person",
        value: input.joiner.some
          ? input.joiner.val.fullName
          : input.mode === AddMemberMode.Existing
            ? "Find their account"
            : "Enter their details",
        done: input.joiner.some,
        current,
      };
    case AddMemberStep.Access:
      return { id: step, label: "Access", value: accessLabel(input.role), done: input.role !== Role.User || passed, current };
    case AddMemberStep.Relationship:
      return {
        id: step,
        label: "Relationship",
        value: relationshipLabel(input.relationship),
        done: input.relationship !== JoinRelationship.None || passed,
        current,
      };
    case AddMemberStep.With:
      return {
        id: step,
        label: "With",
        value: input.coach.some ? input.coach.val.fullName : "Choose a person",
        done: input.coach.some,
        current,
      };
    default: {
      const _exhaustive: never = step;
      throw new Error(`Unhandled add member step: ${_exhaustive}`);
    }
  }
}

export function railOf(input: RailInput): StepRailItem[] {
  return input.order.map((step) => railItem(step, input));
}

export function isComplete(joiner: Option<Joiner>, relationship: JoinRelationship, coach: Option<Member>): boolean {
  return joiner.some && (relationship === JoinRelationship.None || coach.some);
}

/** "Ada Lovelace to Acme as a member, coached by Grace Hopper", under the rail's "Adding" */
export function summaryLine(
  joiner: Joiner,
  organizationName: string,
  role: Role,
  relationship: JoinRelationship,
  coach: Option<Member>
): string {
  const joins = `${joiner.fullName} to ${organizationName} as ${role === Role.Admin ? "an admin" : "a member"}`;
  return relationship === JoinRelationship.Coachee && coach.some ? `${joins}, coached by ${coach.val.fullName}` : joins;
}

export function coachIdOf(relationship: JoinRelationship, coach: Option<Member>): Option<Id> {
  return relationship === JoinRelationship.Coachee && coach.some ? Some(coach.val.userId) : None;
}

export function newUserOf(fields: NewPersonFields, timezone: string, coachId: Option<Id>): NewUser {
  return {
    first_name: fields.firstName.trim(),
    last_name: fields.lastName.trim(),
    display_name: fields.displayName.trim(),
    email: fields.email.trim(),
    timezone,
    ...(coachId.some ? { coach_id: coachId.val } : {}),
  };
}

interface LeadInput {
  step: AddMemberStep;
  order: readonly AddMemberStep[];
  mode: AddMemberMode;
  joiner: Option<Joiner>;
  complete: boolean;
  submitting: boolean;
  onConfirm: () => void;
}

export function leadOf({ step, order, mode, joiner, complete, submitting, onConfirm }: LeadInput): StepDialogLead {
  if (step === order[order.length - 1]) {
    return { kind: "confirm", label: "Add member", disabled: !complete, pending: submitting, onConfirm };
  }
  if (step === AddMemberStep.Person && joiner.none) {
    return { kind: "hint", text: mode === AddMemberMode.Existing ? "Find their account first" : "Fill in their details" };
  }
  return { kind: "none" };
}
