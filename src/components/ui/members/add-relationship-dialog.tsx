"use client";

import { PersonAvatar } from "@/components/ui/avatar";
import { PersonHeader } from "@/components/ui/person-header";
import { PersonPicker } from "@/components/ui/person-picker";
import { RadioCardItem, RadioGroup } from "@/components/ui/radio-group";
import { StepDialog, StepDialogHeight, StepDialogVariant } from "@/components/ui/step-dialog";
import {
  AddRelationshipStep,
  MEMBER_ROLES,
  type Member,
  type MemberRole,
  roleDescription,
} from "@/lib/add-relationship-dialog-model";
import {
  type AddRelationshipDialogModel,
  type RelationshipSummary,
  useAddRelationshipDialog,
} from "@/lib/hooks/use-add-relationship-dialog";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { Id } from "@/types/general";
import { Some } from "@/types/option";
import { relationshipRoleExplanation, relationshipRoleLabel } from "@/types/relationship-role";
import type { User } from "@/types/user";

function roleOf(value: string): MemberRole {
  const role = MEMBER_ROLES.find((r) => r === value);
  if (!role) throw new Error(`Unknown member role: ${value}`);
  return role;
}

function RoleStep({ member, role, onRoleChange }: Pick<AddRelationshipDialogModel, "member" | "role" | "onRoleChange">) {
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
          title={relationshipRoleLabel(choice)}
          description={roleDescription(member.firstName, choice)}
          info={relationshipRoleExplanation(choice)}
        />
      ))}
    </RadioGroup>
  );
}

function StepBody(model: AddRelationshipDialogModel) {
  switch (model.step) {
    case AddRelationshipStep.Role:
      return <RoleStep member={model.member} role={model.role} onRoleChange={model.onRoleChange} />;
    case AddRelationshipStep.Person:
      return <PersonPicker people={model.people} selectedId={model.partnerId} onSelect={model.onPartnerSelect} />;
    default: {
      const _exhaustive: never = model.step;
      throw new Error(`Unhandled add relationship step: ${_exhaustive}`);
    }
  }
}

function Summary({ partner, line }: RelationshipSummary) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">Pairing</p>
      <div className="mt-2.5 flex items-center gap-3">
        <PersonAvatar userId={partner.userId} initials={partner.initials} size={36} />
        <p className="line-clamp-2 min-w-0 break-words text-item font-medium">{line}</p>
      </div>
    </div>
  );
}

function MemberHeader({ userId, initials, fullName, email }: Member) {
  return <PersonHeader userId={userId} initials={initials} fullName={fullName} detail={Some(email)} />;
}

interface AddRelationshipDialogProps {
  organizationId: Id;
  member: User;
  members: User[];
  relationships: CoachingRelationshipWithUserNames[];
  onClose: () => void;
  onAdded: () => void;
}

export function AddRelationshipDialog(props: AddRelationshipDialogProps) {
  const model = useAddRelationshipDialog(props);
  return (
    <StepDialog
      open
      onClose={props.onClose}
      title={`Pair ${model.member.fullName}`}
      height={StepDialogHeight.Standard}
      variant={StepDialogVariant.Steps}
      railHeader={<MemberHeader {...model.member} />}
      steps={model.rail}
      railFooter={model.summary.some ? <Summary {...model.summary.val} /> : undefined}
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
