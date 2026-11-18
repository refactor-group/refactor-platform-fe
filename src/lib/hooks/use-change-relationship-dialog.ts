"use client";

import { useState } from "react";
import type { MenuPerson } from "@/components/ui/join-session/types";
import type { PickerPerson } from "@/components/ui/person-picker";
import type { StepDialogLead, StepRailItem } from "@/components/ui/step-dialog";
import { type Member, type MemberRole, addedMessage, memberOf, summaryLine } from "@/lib/add-relationship-dialog-model";
import { CoachingRelationshipApi } from "@/lib/api/coaching-relationships";
import { AddBackPurpose } from "@/lib/api/membership-errors";
import { organizationArchivedMessage } from "@/lib/api/organization-errors";
import {
  existingRelationshipOf,
  isPairAlreadyRelated,
  kindSwitchConsequencesOf,
  pairAlreadyRelatedMessage,
} from "@/lib/api/relationship-errors";
import {
  ChangeRelationshipStep,
  type Preview,
  STEP_ORDER,
  changeableRelationship,
  consequenceLines,
  kindChange,
  leadOf,
  railOf,
  relationshipChoices,
  roleIn,
  stepTitle,
} from "@/lib/change-relationship-dialog-model";
import { useNotAMemberToast } from "@/lib/hooks/use-not-a-member-toast";
import { otherParticipant } from "@/lib/people";
import { toast } from "@/lib/toast";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import { type Id, isForbiddenError, isNotFoundError, PERMISSION_DENIED_MESSAGE } from "@/types/general";
import { notAMemberRefusalOf } from "@/types/membership";
import { type Option, None, Some } from "@/types/option";
import type { User } from "@/types/user";

interface ChangeRelationshipInput {
  organizationId: Id;
  member: User;
  /** The member's current relationships. */
  relationships: CoachingRelationshipWithUserNames[];
  onClose: () => void;
  onRelationshipsChanged: () => void;
}

export type ReviewState =
  | { kind: "loading" }
  | { kind: "ready"; summary: string; lines: string[] }
  | { kind: "failed" };

export interface ChangeRelationshipDialogModel {
  member: Member;
  partner: Option<MenuPerson>;
  step: ChangeRelationshipStep;
  stepTitle: string;
  rail: StepRailItem[];
  people: PickerPerson[];
  onPartnerSelect: (userId: Id) => void;
  role: Option<MemberRole>;
  currentRole: Option<MemberRole>;
  onRoleChange: (role: MemberRole) => void;
  review: ReviewState;
  lead: StepDialogLead;
  position: { index: number; total: number };
  onPrev: Option<() => void>;
  onNext: Option<() => void>;
}

export function useChangeRelationshipDialog({
  organizationId,
  member: memberUser,
  relationships,
  onClose,
  onRelationshipsChanged,
}: ChangeRelationshipInput): ChangeRelationshipDialogModel {
  const showNotAMember = useNotAMemberToast();
  const [step, setStep] = useState(ChangeRelationshipStep.Relationship);
  const [partnerId, setPartnerId] = useState<Option<Id>>(None);
  const [chosenRole, setChosenRole] = useState<Option<MemberRole>>(None);
  const [preview, setPreview] = useState<Preview>({ kind: "idle" });
  const [submitting, setSubmitting] = useState(false);

  const member = memberOf(memberUser);
  const people = relationshipChoices(member, relationships);
  const relationship = partnerId.some ? changeableRelationship(member.userId, partnerId.val, relationships) : None;
  const partner = relationship.some ? Some(otherParticipant(relationship.val, member.userId)) : None;
  const currentRole = relationship.some ? Some(roleIn(relationship.val, member.userId)) : None;
  const role = chosenRole.some ? chosenRole : currentRole;
  const changed = role.some && currentRole.some && role.val !== currentRole.val;
  const index = STEP_ORDER.indexOf(step);

  const nameOf = (userId: Id): string => {
    if (userId === member.userId) return member.fullName;
    if (partner.some && userId === partner.val.userId) return partner.val.fullName;
    return "Someone";
  };

  const refuse = async (error: unknown, partnerName: string) => {
    console.error("Error changing relationship:", error);
    const notAMember = notAMemberRefusalOf(error);
    if (notAMember.some) {
      showNotAMember(notAMember.val, AddBackPurpose.ChangeRelationship, (id) => (id.some ? Some(nameOf(id.val)) : None));
    } else if (isPairAlreadyRelated(error)) {
      const existing = await existingRelationshipOf(error, organizationId);
      toast.error(pairAlreadyRelatedMessage(existing, member.fullName, partnerName));
      onRelationshipsChanged();
    } else if (isNotFoundError(error)) {
      toast.error("This relationship no longer exists");
      onRelationshipsChanged();
    } else {
      toast.error(
        organizationArchivedMessage(error) ??
          (isForbiddenError(error) ? PERMISSION_DENIED_MESSAGE : "Couldn't change the relationship")
      );
      return;
    }
    onClose();
  };

  const loadPreview = async () => {
    if (relationship.none || partner.none || role.none) return;
    setPreview({ kind: "loading" });
    try {
      await CoachingRelationshipApi.changeKind(
        organizationId,
        relationship.val.id,
        kindChange(member.userId, partner.val.userId, role.val, false)
      );
      // Already that way: nothing was changed or needs confirming.
      onRelationshipsChanged();
      onClose();
    } catch (error) {
      const consequences = kindSwitchConsequencesOf(error);
      if (consequences.some) {
        setPreview({ kind: "ready", consequences: consequences.val });
        return;
      }
      setPreview({ kind: "failed" });
      await refuse(error, partner.val.fullName);
    }
  };

  const confirm = async () => {
    if (relationship.none || partner.none || role.none) return;
    setSubmitting(true);
    try {
      await CoachingRelationshipApi.changeKind(
        organizationId,
        relationship.val.id,
        kindChange(member.userId, partner.val.userId, role.val, true)
      );
      toast.success(addedMessage(member, partner.val, role.val));
      onRelationshipsChanged();
      onClose();
    } catch (error) {
      await refuse(error, partner.val.fullName);
    } finally {
      setSubmitting(false);
    }
  };

  const goTo = (next: ChangeRelationshipStep) => {
    setPreview({ kind: "idle" });
    setStep(next);
    if (next === ChangeRelationshipStep.Review) void loadPreview();
  };

  const canAdvance =
    (step === ChangeRelationshipStep.Relationship && relationship.some) ||
    (step === ChangeRelationshipStep.Role && changed);

  return {
    member,
    partner,
    step,
    stepTitle: stepTitle(step, member, partner),
    rail: railOf({ step, partner, role, changed, preview }),
    people,
    onPartnerSelect: (userId) => {
      setPartnerId(Some(userId));
      setChosenRole(None);
    },
    role,
    currentRole,
    onRoleChange: (next) => setChosenRole(Some(next)),
    review: reviewOf(preview, member, partner, role, nameOf),
    lead: leadOf({ step, hasPartner: relationship.some, changed, preview, submitting, onConfirm: confirm }),
    position: { index: index + 1, total: STEP_ORDER.length },
    // Held while the preview loads, so a stale answer can't land on another step.
    onPrev: index > 0 && preview.kind !== "loading" ? Some(() => goTo(STEP_ORDER[index - 1])) : None,
    onNext: index < STEP_ORDER.length - 1 && canAdvance ? Some(() => goTo(STEP_ORDER[index + 1])) : None,
  };
}

function reviewOf(
  preview: Preview,
  member: Member,
  partner: Option<MenuPerson>,
  role: Option<MemberRole>,
  nameOf: (userId: Id) => string
): ReviewState {
  switch (preview.kind) {
    case "idle":
    case "loading":
      return { kind: "loading" };
    case "failed":
      return { kind: "failed" };
    case "ready":
      if (partner.none || role.none) return { kind: "failed" };
      return {
        kind: "ready",
        summary: summaryLine(member, partner.val, role.val),
        lines: consequenceLines(preview.consequences, nameOf),
      };
    default: {
      const _exhaustive: never = preview;
      throw new Error(`Unhandled preview: ${_exhaustive}`);
    }
  }
}
