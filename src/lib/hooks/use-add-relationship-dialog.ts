"use client";

import { useState } from "react";
import type { PickerPerson } from "@/components/ui/person-picker";
import type { StepDialogLead, StepRailItem } from "@/components/ui/step-dialog";
import { useCoachingRelationshipMutation } from "@/lib/api/coaching-relationships";
import { organizationArchivedMessage } from "@/lib/api/organization-errors";
import { existingRelationshipOf, isPairAlreadyRelated, pairAlreadyRelatedMessage } from "@/lib/api/relationship-errors";
import {
  AddRelationshipStep,
  type Member,
  type MemberRole,
  STEP_ORDER,
  addedMessage,
  leadOf,
  memberOf,
  newRelationship,
  partnerChoices,
  railOf,
  selectedPartner,
  stepTitle,
  summaryLine,
} from "@/lib/add-relationship-dialog-model";
import { toast } from "@/lib/toast";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import { type Id, isForbiddenError, PERMISSION_DENIED_MESSAGE } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import type { User } from "@/types/user";

interface AddRelationshipInput {
  organizationId: Id;
  member: User;
  members: User[];
  /** The member's current relationships. */
  relationships: CoachingRelationshipWithUserNames[];
  onClose: () => void;
  /** After a pairing, or a refusal that shows the shown relationships were stale. */
  onRelationshipsChanged: () => void;
}

export interface RelationshipSummary {
  partner: Member;
  line: string;
}

export interface AddRelationshipDialogModel {
  member: Member;
  step: AddRelationshipStep;
  stepTitle: string;
  rail: StepRailItem[];
  role: Option<MemberRole>;
  onRoleChange: (role: MemberRole) => void;
  people: PickerPerson[];
  partnerId: Option<Id>;
  onPartnerSelect: (userId: Id) => void;
  summary: Option<RelationshipSummary>;
  lead: StepDialogLead;
  position: { index: number; total: number };
  onPrev: Option<() => void>;
  onNext: Option<() => void>;
}

async function errorMessage(error: unknown, organizationId: Id, member: Member, partner: Member): Promise<string> {
  if (isPairAlreadyRelated(error)) {
    return pairAlreadyRelatedMessage(await existingRelationshipOf(error, organizationId), member.fullName, partner.fullName);
  }
  return (
    organizationArchivedMessage(error) ??
    (isForbiddenError(error) ? PERMISSION_DENIED_MESSAGE : "Couldn't add the relationship")
  );
}

export function useAddRelationshipDialog({
  organizationId,
  member: memberUser,
  members,
  relationships,
  onClose,
  onRelationshipsChanged,
}: AddRelationshipInput): AddRelationshipDialogModel {
  const { createNested } = useCoachingRelationshipMutation(organizationId);
  const [step, setStep] = useState(AddRelationshipStep.Role);
  const [role, setRole] = useState<Option<MemberRole>>(None);
  const [partnerId, setPartnerId] = useState<Option<Id>>(None);
  const [submitting, setSubmitting] = useState(false);

  const member = memberOf(memberUser);
  const others = members.map(memberOf);
  const people = partnerChoices(member, others, role, relationships);
  const partner = selectedPartner(partnerId, people, others);
  const index = STEP_ORDER.indexOf(step);

  const submit = async () => {
    if (role.none || partner.none) return;
    setSubmitting(true);
    try {
      await createNested(organizationId, newRelationship(member.userId, partner.val.userId, role.val));
      toast.success(addedMessage(member, partner.val, role.val));
      onRelationshipsChanged();
      onClose();
    } catch (error) {
      console.error("Error adding relationship:", error);
      toast.error(await errorMessage(error, organizationId, member, partner.val));
      if (isPairAlreadyRelated(error)) onRelationshipsChanged();
    } finally {
      setSubmitting(false);
    }
  };

  return {
    member,
    step,
    stepTitle: stepTitle(step, member, role),
    rail: railOf({ step, role, partner }),
    role,
    onRoleChange: (next) => setRole(Some(next)),
    people,
    partnerId: partner.some ? Some(partner.val.userId) : None,
    onPartnerSelect: (userId) => setPartnerId(Some(userId)),
    summary:
      role.some && partner.some
        ? Some({ partner: partner.val, line: summaryLine(member, partner.val, role.val) })
        : None,
    lead: leadOf({ step, complete: role.some && partner.some, submitting, onConfirm: submit }),
    position: { index: index + 1, total: STEP_ORDER.length },
    onPrev: index > 0 ? Some(() => setStep(STEP_ORDER[index - 1])) : None,
    onNext: index < STEP_ORDER.length - 1 ? Some(() => setStep(STEP_ORDER[index + 1])) : None,
  };
}
