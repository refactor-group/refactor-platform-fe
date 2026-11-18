import type { PickerPerson } from "@/components/ui/person-picker";
import type { StepDialogLead, StepRailItem } from "@/components/ui/step-dialog";
import { initialsOf } from "@/lib/people";
import {
  type CoachingRelationshipWithUserNames,
  type NewCoachingRelationship,
  isPairOf,
  RelationshipKind,
} from "@/types/coaching-relationship";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import { RelationshipRole, relationshipRoleLabel } from "@/types/relationship-role";
import type { User } from "@/types/user";

export enum AddRelationshipStep {
  Role = "role",
  Person = "person",
}

export const STEP_ORDER: readonly AddRelationshipStep[] = [
  AddRelationshipStep.Role,
  AddRelationshipStep.Person,
];

/** What the member becomes in the new relationship. */
export type MemberRole = RelationshipRole;

export const MEMBER_ROLES: readonly MemberRole[] = [
  RelationshipRole.Coachee,
  RelationshipRole.Coach,
  RelationshipRole.Colleague,
];

export interface Member {
  userId: Id;
  firstName: string;
  fullName: string;
  initials: string;
  email: string;
}

type Named = Pick<Member, "fullName">;

export function memberOf(user: User): Member {
  return {
    userId: user.id,
    firstName: user.first_name,
    fullName: `${user.first_name} ${user.last_name}`.trim(),
    initials: initialsOf(user.first_name, user.last_name),
    email: user.email,
  };
}

export function newRelationship(member: Id, partner: Id, role: MemberRole): NewCoachingRelationship {
  switch (role) {
    case RelationshipRole.Coachee:
      return { coach_id: partner, coachee_id: member, kind: RelationshipKind.Coaching };
    case RelationshipRole.Coach:
      return { coach_id: member, coachee_id: partner, kind: RelationshipKind.Coaching };
    case RelationshipRole.Colleague:
      return { coach_id: member, coachee_id: partner, kind: RelationshipKind.Colleague };
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unhandled member role: ${_exhaustive}`);
    }
  }
}

/**
 * The pair's existing relationship that rules this role out. A pair holds one
 * relationship, except two people may coach each other.
 */
export function blockingRelationship(
  member: Id,
  partner: Id,
  role: MemberRole,
  relationships: readonly CoachingRelationshipWithUserNames[]
): Option<CoachingRelationshipWithUserNames> {
  const { coach_id, coachee_id, kind } = newRelationship(member, partner, role);
  const found = relationships.find(
    (r) =>
      isPairOf(r, member, partner) &&
      (kind === RelationshipKind.Colleague ||
        r.kind === RelationshipKind.Colleague ||
        (r.coach_id === coach_id && r.coachee_id === coachee_id))
  );
  return found ? Some(found) : None;
}

export function alreadyPaired(
  member: Id,
  partner: Id,
  role: MemberRole,
  relationships: readonly CoachingRelationshipWithUserNames[]
): boolean {
  return blockingRelationship(member, partner, role, relationships).some;
}

/** What the other person is to the member: "Ada's coach", "coached by Ada" or "Ada's colleague". */
export function relationLine(member: Member, existing: CoachingRelationshipWithUserNames): string {
  if (existing.kind === RelationshipKind.Colleague) return `${member.firstName}'s colleague`;
  return existing.coachee_id === member.userId ? `${member.firstName}'s coach` : `coached by ${member.firstName}`;
}

const pairedLine = (member: Member, existing: CoachingRelationshipWithUserNames): string =>
  `Already ${relationLine(member, existing)}`;

/** Everyone but the member, by name. Anyone already paired this way shows but can't be picked. */
export function partnerChoices(
  member: Member,
  others: readonly Member[],
  role: Option<MemberRole>,
  relationships: readonly CoachingRelationshipWithUserNames[]
): PickerPerson[] {
  return others
    .filter((other) => other.userId !== member.userId)
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((other) => {
      const existing = role.some ? blockingRelationship(member.userId, other.userId, role.val, relationships) : None;
      return {
        userId: other.userId,
        fullName: other.fullName,
        initials: other.initials,
        email: other.email,
        subline: existing.some ? Some(pairedLine(member, existing.val)) : None,
        inactive: false,
        selectable: existing.none,
      };
    });
}

/** The picked partner, dropped once a role change makes them unpickable. */
export function selectedPartner(
  partnerId: Option<Id>,
  people: readonly PickerPerson[],
  others: readonly Member[]
): Option<Member> {
  if (partnerId.none) return None;
  const pickable = people.some((p) => p.userId === partnerId.val && p.selectable);
  const partner = others.find((o) => o.userId === partnerId.val);
  return pickable && partner ? Some(partner) : None;
}

export function roleDescription(firstName: string, role: MemberRole): string {
  switch (role) {
    case RelationshipRole.Coachee:
      return `${firstName} is coached by the person you pair them with in the next step.`;
    case RelationshipRole.Coach:
      return `${firstName} coaches the person you pair them with in the next step.`;
    case RelationshipRole.Colleague:
      return `${firstName} and the person you pair them with in the next step work together as peers.`;
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unhandled member role: ${_exhaustive}`);
    }
  }
}

/** The step title naming the person the member is paired with. */
export function partnerTitle(firstName: string, role: MemberRole): string {
  switch (role) {
    case RelationshipRole.Coachee:
      return `Choose ${firstName}'s coach`;
    case RelationshipRole.Coach:
      return `Choose who ${firstName} coaches`;
    case RelationshipRole.Colleague:
      return `Choose ${firstName}'s colleague`;
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unhandled member role: ${_exhaustive}`);
    }
  }
}

export function stepTitle(step: AddRelationshipStep, member: Member, role: Option<MemberRole>): string {
  switch (step) {
    case AddRelationshipStep.Role:
      return `${member.firstName}'s role`;
    case AddRelationshipStep.Person:
      return role.some ? partnerTitle(member.firstName, role.val) : `Choose who ${member.firstName} works with`;
    default: {
      const _exhaustive: never = step;
      throw new Error(`Unhandled add relationship step: ${_exhaustive}`);
    }
  }
}

export function summaryLine(member: Named, partner: Named, role: MemberRole): string {
  switch (role) {
    case RelationshipRole.Coachee:
      return `${partner.fullName} will coach ${member.fullName}`;
    case RelationshipRole.Coach:
      return `${member.fullName} will coach ${partner.fullName}`;
    case RelationshipRole.Colleague:
      return `${member.fullName} and ${partner.fullName} will be colleagues`;
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unhandled member role: ${_exhaustive}`);
    }
  }
}

export function addedMessage(member: Named, partner: Named, role: MemberRole): string {
  switch (role) {
    case RelationshipRole.Coachee:
      return `${partner.fullName} is now ${member.fullName}'s coach`;
    case RelationshipRole.Coach:
      return `${partner.fullName} is now ${member.fullName}'s coachee`;
    case RelationshipRole.Colleague:
      return `${member.fullName} and ${partner.fullName} are now colleagues`;
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unhandled member role: ${_exhaustive}`);
    }
  }
}

interface RailInput {
  step: AddRelationshipStep;
  role: Option<MemberRole>;
  partner: Option<Member>;
}

export function railOf({ step, role, partner }: RailInput): StepRailItem[] {
  return [
    {
      id: AddRelationshipStep.Role,
      label: "Role",
      value: role.some ? relationshipRoleLabel(role.val) : "Choose a role",
      done: role.some,
      current: step === AddRelationshipStep.Role,
    },
    {
      id: AddRelationshipStep.Person,
      label: "With",
      value: partner.some ? partner.val.fullName : "Choose a person",
      done: partner.some,
      current: step === AddRelationshipStep.Person,
    },
  ];
}

interface LeadInput {
  step: AddRelationshipStep;
  hasRole: boolean;
  complete: boolean;
  submitting: boolean;
  onConfirm: () => void;
}

export function leadOf({ step, hasRole, complete, submitting, onConfirm }: LeadInput): StepDialogLead {
  if (step !== AddRelationshipStep.Person) return hasRole ? { kind: "none" } : { kind: "hint", text: "Choose a role first" };
  return { kind: "confirm", label: "Pair them", disabled: !complete, pending: submitting, onConfirm };
}
