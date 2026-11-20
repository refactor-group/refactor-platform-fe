import { isMember } from "@/lib/participants";
import type { MenuPerson } from "@/components/ui/join-session/types";
import type { PickerPerson } from "@/components/ui/person-picker";
import type { StepDialogLead, StepRailItem } from "@/components/ui/step-dialog";
import { type Member, type MemberRole, relationLine } from "@/lib/add-relationship-dialog-model";
import type { KindSwitchConsequences } from "@/lib/api/relationship-errors";
import { notAMemberText } from "@/lib/api/membership-errors";
import { otherParticipant } from "@/lib/people";
import {
  type CoachingRelationshipWithUserNames,
  type RelationshipKindChange,
  isPairOf,
  RelationshipKind,
} from "@/types/coaching-relationship";
import { type Id, countOf } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import { RelationshipRole, relationshipRoleLabel } from "@/types/relationship-role";

export enum ChangeRelationshipStep {
  Relationship = "relationship",
  Role = "role",
  Review = "review",
}

export const STEP_ORDER: readonly ChangeRelationshipStep[] = [
  ChangeRelationshipStep.Relationship,
  ChangeRelationshipStep.Role,
  ChangeRelationshipStep.Review,
];

/** The unconfirmed switch's answer: what confirming it would change. */
export type Preview =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; consequences: KindSwitchConsequences }
  | { kind: "failed" };

const upperFirst = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

function pairRelationships(
  member: Id,
  partner: Id,
  relationships: readonly CoachingRelationshipWithUserNames[]
): CoachingRelationshipWithUserNames[] {
  return relationships.filter((r) => isPairOf(r, member, partner));
}

/**
 * The one relationship with this partner that can change. Two people who coach each other
 * can't: either change would collide with the other relationship.
 */
export function changeableRelationship(
  member: Id,
  partner: Id,
  relationships: readonly CoachingRelationshipWithUserNames[]
): Option<CoachingRelationshipWithUserNames> {
  const pair = pairRelationships(member, partner, relationships);
  if (pair.length !== 1) return None;
  const [only] = pair;
  return isMember(only, member) && isMember(only, partner) ? Some(only) : None;
}

function choiceSubline(member: Member, partner: MenuPerson, pair: CoachingRelationshipWithUserNames[]): string {
  if (pair.length > 1) return `${member.firstName}'s coach and coachee`;
  const [only] = pair;
  if (!isMember(only, partner.userId)) return notAMemberText(partner.firstName);
  return upperFirst(relationLine(member, only));
}

/** One row per person the member works with; who left, or coaches each other with them, can't be picked. */
export function relationshipChoices(
  member: Member,
  relationships: readonly CoachingRelationshipWithUserNames[]
): PickerPerson[] {
  const partners = new Map<Id, MenuPerson>();
  for (const r of relationships) {
    const partner = otherParticipant(r, member.userId);
    partners.set(partner.userId, partner);
  }
  return [...partners.values()]
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((partner) => ({
      userId: partner.userId,
      fullName: partner.fullName,
      initials: partner.initials,
      email: partner.email,
      subline: Some(choiceSubline(member, partner, pairRelationships(member.userId, partner.userId, relationships))),
      inactive: false,
      selectable: changeableRelationship(member.userId, partner.userId, relationships).some,
    }));
}

/** Whether "Change relationship…" has anything to offer. */
export function hasChangeableRelationship(
  member: Member,
  relationships: readonly CoachingRelationshipWithUserNames[]
): boolean {
  return relationshipChoices(member, relationships).some((choice) => choice.selectable);
}

export function kindChange(member: Id, partner: Id, role: MemberRole, confirmed: boolean): RelationshipKindChange {
  switch (role) {
    case RelationshipRole.Coach:
      return { kind: RelationshipKind.Coaching, coach_id: member, confirmed };
    case RelationshipRole.Coachee:
      return { kind: RelationshipKind.Coaching, coach_id: partner, confirmed };
    case RelationshipRole.Colleague:
      return { kind: RelationshipKind.Colleague, confirmed };
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unhandled member role: ${_exhaustive}`);
    }
  }
}

export function roleDescription(member: Member, partner: MenuPerson, role: MemberRole): string {
  switch (role) {
    case RelationshipRole.Coachee:
      return `${partner.firstName} coaches ${member.firstName}.`;
    case RelationshipRole.Coach:
      return `${member.firstName} coaches ${partner.firstName}.`;
    case RelationshipRole.Colleague:
      return `${member.firstName} and ${partner.firstName} work together as peers.`;
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unhandled member role: ${_exhaustive}`);
    }
  }
}

export function stepTitle(step: ChangeRelationshipStep, member: Member, partner: Option<MenuPerson>): string {
  switch (step) {
    case ChangeRelationshipStep.Relationship:
      return "Choose a relationship";
    case ChangeRelationshipStep.Role:
      return partner.some ? `${member.firstName}'s role with ${partner.val.firstName}` : `${member.firstName}'s role`;
    case ChangeRelationshipStep.Review:
      return "Review the change";
    default: {
      const _exhaustive: never = step;
      throw new Error(`Unhandled change relationship step: ${_exhaustive}`);
    }
  }
}


/** What confirming changes, one sentence per person and effect. */
export function consequenceLines(consequences: KindSwitchConsequences, nameOf: (userId: Id) => string): string[] {
  const actions = consequences.actionsBecomingVisible.flatMap(({ userId, byAssignee }) =>
    byAssignee.map(
      ({ assigneeId, count }) =>
        `${nameOf(userId)} will see ${countOf(count, "action")} assigned to ${nameOf(assigneeId)}`
    )
  );
  const gained = consequences.schedulingGained.map((id) => `${nameOf(id)} will be able to schedule sessions`);
  const lost = consequences.schedulingLost.map((id) => `${nameOf(id)} will no longer schedule sessions`);
  return [...actions, ...gained, ...lost];
}

interface RailInput {
  step: ChangeRelationshipStep;
  partner: Option<MenuPerson>;
  role: Option<MemberRole>;
  changed: boolean;
  preview: Preview;
}

export function railOf({ step, partner, role, changed, preview }: RailInput): StepRailItem[] {
  return [
    {
      id: ChangeRelationshipStep.Relationship,
      label: "With",
      value: partner.some ? partner.val.fullName : "Choose a person",
      done: partner.some,
      current: step === ChangeRelationshipStep.Relationship,
    },
    {
      id: ChangeRelationshipStep.Role,
      label: "Role",
      value: role.some ? relationshipRoleLabel(role.val) : "Choose a role",
      done: changed,
      current: step === ChangeRelationshipStep.Role,
    },
    {
      id: ChangeRelationshipStep.Review,
      label: "Review",
      value: "What changes",
      done: preview.kind === "ready",
      current: step === ChangeRelationshipStep.Review,
    },
  ];
}

interface LeadInput {
  step: ChangeRelationshipStep;
  hasPartner: boolean;
  changed: boolean;
  preview: Preview;
  submitting: boolean;
  onConfirm: () => void;
}

export function leadOf({ step, hasPartner, changed, preview, submitting, onConfirm }: LeadInput): StepDialogLead {
  switch (step) {
    case ChangeRelationshipStep.Relationship:
      return hasPartner ? { kind: "none" } : { kind: "hint", text: "Choose a relationship first" };
    case ChangeRelationshipStep.Role:
      return changed ? { kind: "none" } : { kind: "hint", text: "Choose a different role" };
    case ChangeRelationshipStep.Review:
      return {
        kind: "confirm",
        label: "Change relationship",
        disabled: preview.kind !== "ready" || !changed,
        pending: submitting,
        onConfirm,
      };
    default: {
      const _exhaustive: never = step;
      throw new Error(`Unhandled change relationship step: ${_exhaustive}`);
    }
  }
}
