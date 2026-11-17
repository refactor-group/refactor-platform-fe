"use client";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PersonPicker } from "@/components/ui/person-picker";
import { RadioCardItem, RadioGroup } from "@/components/ui/radio-group";
import { StepDialog, StepDialogHeight, StepDialogVariant } from "@/components/ui/step-dialog";
import {
  ACCESS_ROLES,
  AddMemberMode,
  AddMemberStep,
  JOIN_RELATIONSHIPS,
  type NewPersonFields,
  type JoinRelationship,
  accessDescription,
  accessExplanation,
  accessLabel,
  relationshipDescription,
  relationshipExplanation,
  relationshipLabel,
} from "@/lib/add-member-dialog-model";
import { type AddMemberDialogModel, useAddMemberDialog } from "@/lib/hooks/use-add-member-dialog";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { User } from "@/types/user";

const FIELDS: readonly { name: keyof NewPersonFields; label: string; type: string }[] = [
  { name: "firstName", label: "First name", type: "text" },
  { name: "lastName", label: "Last name", type: "text" },
  { name: "displayName", label: "Display name", type: "text" },
  { name: "email", label: "Email", type: "email" },
];

function explanationOf(relationship: JoinRelationship): string | undefined {
  const explanation = relationshipExplanation(relationship);
  return explanation.some ? explanation.val : undefined;
}

function ModeChoice({ mode, onModeChange }: Pick<AddMemberDialogModel, "mode" | "onModeChange">) {
  return (
    <div className="mb-5 flex gap-2">
      <Chip size="md" selected={mode === AddMemberMode.Create} onClick={() => onModeChange(AddMemberMode.Create)}>
        New person
      </Chip>
      <Chip size="md" selected={mode === AddMemberMode.Existing} onClick={() => onModeChange(AddMemberMode.Existing)}>
        Has an account
      </Chip>
    </div>
  );
}

function NewPersonForm({ fields, onFieldChange }: Pick<AddMemberDialogModel, "fields" | "onFieldChange">) {
  return (
    <div className="grid grid-cols-1 gap-4 modal:grid-cols-2">
      {FIELDS.map(({ name, label, type }) => (
        <div key={name} className="space-y-2">
          <Label htmlFor={name}>{label}</Label>
          <Input
            id={name}
            type={type}
            autoComplete="off"
            value={fields[name]}
            onChange={(e) => onFieldChange(name, e.target.value)}
          />
        </div>
      ))}
    </div>
  );
}

function FoundCard({ lookup, onClearFound }: Pick<AddMemberDialogModel, "lookup" | "onClearFound">) {
  if (lookup.found.none) return null;
  const { first_name, last_name, email } = lookup.found.val;
  return (
    <div className="mt-4 flex items-center justify-between gap-2 rounded-[12px] border bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {first_name} {last_name}
        </p>
        <p className="truncate text-xs text-muted-foreground">{email}</p>
      </div>
      <Button variant="tertiary" size="sm" onClick={onClearFound} aria-label={`Clear ${first_name} ${last_name}`}>
        Clear
      </Button>
    </div>
  );
}

function ExistingPersonForm({
  organizationName,
  lookup,
  onLookupEmailChange,
  onFind,
  onClearFound,
}: Pick<AddMemberDialogModel, "organizationName" | "lookup" | "onLookupEmailChange" | "onFind" | "onClearFound">) {
  return (
    <div>
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          onFind();
        }}
      >
        <Label htmlFor="lookupEmail">Email</Label>
        <div className="flex gap-2">
          <Input
            id="lookupEmail"
            type="email"
            autoComplete="off"
            value={lookup.email}
            onChange={(e) => onLookupEmailChange(e.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={lookup.lookingUp || lookup.email.trim() === ""}>
            {lookup.lookingUp ? "Finding…" : "Find"}
          </Button>
        </div>
      </form>
      <p className="mt-2 text-xs text-muted-foreground">
        Their existing account gets access to {organizationName}.
      </p>
      {lookup.message.some && <p className="mt-3 text-sm text-destructive">{lookup.message.val}</p>}
      <FoundCard lookup={lookup} onClearFound={onClearFound} />
    </div>
  );
}

function PersonStep(model: AddMemberDialogModel) {
  return (
    <div>
      {model.canAddExisting && <ModeChoice mode={model.mode} onModeChange={model.onModeChange} />}
      {model.mode === AddMemberMode.Existing ? (
        <ExistingPersonForm {...model} />
      ) : (
        <NewPersonForm fields={model.fields} onFieldChange={model.onFieldChange} />
      )}
    </div>
  );
}

function AccessStep({ role, onRoleChange }: Pick<AddMemberDialogModel, "role" | "onRoleChange">) {
  return (
    <RadioGroup
      aria-label="Access"
      value={role}
      onValueChange={(value) => onRoleChange(ACCESS_ROLES.find((r) => r === value) ?? role)}
      className="gap-2.5"
    >
      {ACCESS_ROLES.map((choice) => (
        <RadioCardItem
          key={choice}
          value={choice}
          title={accessLabel(choice)}
          description={accessDescription(choice)}
          info={accessExplanation(choice)}
        />
      ))}
    </RadioGroup>
  );
}

function RelationshipStep({
  joiner,
  relationship,
  onRelationshipChange,
}: Pick<AddMemberDialogModel, "joiner" | "relationship" | "onRelationshipChange">) {
  if (joiner.none) return null;
  return (
    <RadioGroup
      aria-label="Relationship"
      value={relationship}
      onValueChange={(value) => onRelationshipChange(JOIN_RELATIONSHIPS.find((r) => r === value) ?? relationship)}
      className="gap-2.5"
    >
      {JOIN_RELATIONSHIPS.map((choice) => (
        <RadioCardItem
          key={choice}
          value={choice}
          title={relationshipLabel(choice)}
          description={relationshipDescription(choice, joiner.val)}
          info={explanationOf(choice)}
        />
      ))}
    </RadioGroup>
  );
}

function StepBody(model: AddMemberDialogModel) {
  switch (model.step) {
    case AddMemberStep.Person:
      return <PersonStep {...model} />;
    case AddMemberStep.Access:
      return <AccessStep role={model.role} onRoleChange={model.onRoleChange} />;
    case AddMemberStep.Relationship:
      return (
        <RelationshipStep
          joiner={model.joiner}
          relationship={model.relationship}
          onRelationshipChange={model.onRelationshipChange}
        />
      );
    case AddMemberStep.With:
      return <PersonPicker people={model.people} selectedId={model.partnerId} onSelect={model.onPartnerSelect} />;
    default: {
      const _exhaustive: never = model.step;
      throw new Error(`Unhandled add member step: ${_exhaustive}`);
    }
  }
}

function Summary({ line }: { line: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">Adding</p>
      <p className="mt-2.5 line-clamp-3 break-words text-item font-medium">{line}</p>
    </div>
  );
}

interface AddMemberDialogProps {
  onClose: () => void;
  onMemberAdded: () => void;
  /** Who they can be paired with. */
  organizationMembers: User[];
  relationships: readonly CoachingRelationshipWithUserNames[];
  /** False offers only creating a new account. */
  canAddExisting: boolean;
  initialMode: AddMemberMode;
}

export function AddMemberDialog(props: AddMemberDialogProps) {
  const model = useAddMemberDialog(props);
  return (
    <StepDialog
      open
      onClose={props.onClose}
      title="Add member"
      height={StepDialogHeight.Standard}
      variant={StepDialogVariant.Steps}
      steps={model.rail}
      railFooter={model.summary.some ? <Summary line={model.summary.val} /> : undefined}
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
