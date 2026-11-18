"use client";

import { PersonHeader } from "@/components/ui/person-header";
import { PersonPicker } from "@/components/ui/person-picker";
import { RadioCardItem, RadioGroup } from "@/components/ui/radio-group";
import { StepDialog, StepDialogHeight, StepDialogVariant } from "@/components/ui/step-dialog";
import { MEMBER_ROLES, type MemberRole } from "@/lib/add-relationship-dialog-model";
import { ChangeRelationshipStep, roleDescription } from "@/lib/change-relationship-dialog-model";
import {
  type ChangeRelationshipDialogModel,
  type ReviewState,
  useChangeRelationshipDialog,
} from "@/lib/hooks/use-change-relationship-dialog";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { Id } from "@/types/general";
import { None, Some } from "@/types/option";
import { relationshipRoleExplanation, relationshipRoleLabel } from "@/types/relationship-role";
import type { User } from "@/types/user";

function roleOf(value: string): MemberRole {
  const role = MEMBER_ROLES.find((r) => r === value);
  if (!role) throw new Error(`Unknown member role: ${value}`);
  return role;
}

function RoleStep({ member, partner, role, currentRole, onRoleChange }: ChangeRelationshipDialogModel) {
  if (partner.none) return null;
  return (
    <RadioGroup
      aria-label={`${member.firstName}'s role`}
      value={role.some ? role.val : ""}
      onValueChange={(value) => onRoleChange(roleOf(value))}
      className="gap-2.5"
    >
      {MEMBER_ROLES.map((choice) => (
        <RadioCardItem
          key={choice}
          value={choice}
          title={
            currentRole.some && currentRole.val === choice
              ? `${relationshipRoleLabel(choice)} (current)`
              : relationshipRoleLabel(choice)
          }
          description={roleDescription(member, partner.val, choice)}
          info={relationshipRoleExplanation(choice)}
        />
      ))}
    </RadioGroup>
  );
}

function ReviewStep({ review }: { review: ReviewState }) {
  switch (review.kind) {
    case "loading":
      return <p className="text-sm text-muted-foreground">Checking what changes…</p>;
    case "failed":
      return <p className="text-sm text-muted-foreground">Couldn&apos;t check what changes. Go back and try again.</p>;
    case "ready":
      return (
        <div className="space-y-4">
          <p className="text-item font-medium">{review.summary}</p>
          {review.lines.length > 0 ? (
            <ul className="space-y-2 text-sm text-ink-2 tabular-nums">
              {review.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing else changes for them.</p>
          )}
          <p className="text-xs text-muted-foreground">Their sessions, notes and actions stay as they are.</p>
        </div>
      );
    default: {
      const _exhaustive: never = review;
      throw new Error(`Unhandled review state: ${_exhaustive}`);
    }
  }
}

function StepBody(model: ChangeRelationshipDialogModel) {
  switch (model.step) {
    case ChangeRelationshipStep.Relationship:
      return (
        <PersonPicker
          people={model.people}
          selectedId={model.partner.some ? Some(model.partner.val.userId) : None}
          onSelect={model.onPartnerSelect}
        />
      );
    case ChangeRelationshipStep.Role:
      return <RoleStep {...model} />;
    case ChangeRelationshipStep.Review:
      return <ReviewStep review={model.review} />;
    default: {
      const _exhaustive: never = model.step;
      throw new Error(`Unhandled change relationship step: ${_exhaustive}`);
    }
  }
}

interface ChangeRelationshipDialogProps {
  organizationId: Id;
  member: User;
  relationships: CoachingRelationshipWithUserNames[];
  onClose: () => void;
  onRelationshipsChanged: () => void;
}

export function ChangeRelationshipDialog(props: ChangeRelationshipDialogProps) {
  const model = useChangeRelationshipDialog(props);
  const { userId, initials, fullName, email } = model.member;
  return (
    <StepDialog
      open
      onClose={props.onClose}
      title={`Change ${fullName}'s relationship`}
      height={StepDialogHeight.Standard}
      variant={StepDialogVariant.Steps}
      railHeader={<PersonHeader userId={userId} initials={initials} fullName={fullName} detail={Some(email)} />}
      steps={model.rail}
      stepTitle={model.stepTitle}
      lead={model.lead}
      position={model.position}
      onPrev={model.onPrev}
      onNext={model.onNext}
    >
      <StepBody {...model} />
    </StepDialog>
  );
}
