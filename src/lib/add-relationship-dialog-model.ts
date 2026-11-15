import type { PickerPerson } from "@/components/ui/person-picker";
import type { StepDialogLead, StepRailItem } from "@/components/ui/step-dialog";
import { initialsOf } from "@/lib/people";
import type {
  CoachingRelationshipWithUserNames,
  NewCoachingRelationship,
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
export type MemberRole = RelationshipRole.Coachee | RelationshipRole.Coach;

export const MEMBER_ROLES: readonly MemberRole[] = [RelationshipRole.Coachee, RelationshipRole.Coach];

export interface Member {
  userId: Id;
  firstName: string;
  fullName: string;
  initials: string;
  email: string;
}

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
  return role === RelationshipRole.Coachee
    ? { coach_id: partner, coachee_id: member }
    : { coach_id: member, coachee_id: partner };
}

/** True when the pair already holds the relationship this role would create. */
export function alreadyPaired(
  member: Id,
  partner: Id,
  role: MemberRole,
  relationships: readonly CoachingRelationshipWithUserNames[]
): boolean {
  const { coach_id, coachee_id } = newRelationship(member, partner, role);
  return relationships.some((r) => r.coach_id === coach_id && r.coachee_id === coachee_id);
}

function pairedLine(member: Member, role: MemberRole): string {
  return role === RelationshipRole.Coachee
    ? `Already ${member.firstName}'s coach`
    : `Already coached by ${member.firstName}`;
}

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
      const paired = role.some && alreadyPaired(member.userId, other.userId, role.val, relationships);
      return {
        userId: other.userId,
        fullName: other.fullName,
        initials: other.initials,
        subline: paired ? pairedLine(member, role.val) : other.email,
        inactive: false,
        selectable: !paired,
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

export function roleDescription(member: Member, role: MemberRole): string {
  return role === RelationshipRole.Coachee
    ? `${member.firstName} is coached by the person you pick next.`
    : `${member.firstName} coaches the person you pick next.`;
}

export function stepTitle(step: AddRelationshipStep, member: Member, role: Option<MemberRole>): string {
  switch (step) {
    case AddRelationshipStep.Role:
      return `${member.firstName}'s role`;
    case AddRelationshipStep.Person:
      if (role.none) return `Who ${member.firstName} works with`;
      return role.val === RelationshipRole.Coachee
        ? `${member.firstName}'s coach`
        : `Who ${member.firstName} coaches`;
    default: {
      const _exhaustive: never = step;
      throw new Error(`Unhandled add relationship step: ${_exhaustive}`);
    }
  }
}

export function summaryLine(member: Member, partner: Member, role: MemberRole): string {
  return role === RelationshipRole.Coachee
    ? `${partner.fullName} will coach ${member.fullName}`
    : `${member.fullName} will coach ${partner.fullName}`;
}

export function addedMessage(member: Member, partner: Member, role: MemberRole): string {
  const partnerRole = role === RelationshipRole.Coachee ? RelationshipRole.Coach : RelationshipRole.Coachee;
  return `${partner.fullName} is now ${member.fullName}'s ${relationshipRoleLabel(partnerRole).toLowerCase()}`;
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
  complete: boolean;
  submitting: boolean;
  onConfirm: () => void;
}

export function leadOf({ step, complete, submitting, onConfirm }: LeadInput): StepDialogLead {
  if (step !== AddRelationshipStep.Person) return { kind: "none" };
  return { kind: "confirm", label: "Add relationship", disabled: !complete, pending: submitting, onConfirm };
}
