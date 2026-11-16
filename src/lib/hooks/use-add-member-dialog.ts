"use client";

import { useRef, useState } from "react";
import type { PickerPerson } from "@/components/ui/person-picker";
import type { StepDialogLead, StepRailItem } from "@/components/ui/step-dialog";
import {
  AddMemberMode,
  AddMemberStep,
  EMPTY_NEW_PERSON,
  JoinRelationship,
  type Joiner,
  type NewPersonFields,
  coachIdOf,
  isComplete,
  joinerOf,
  leadOf,
  newUserOf,
  railOf,
  stepOrder,
  stepTitle,
  summaryLine,
} from "@/lib/add-member-dialog-model";
import { type Member, memberOf, selectedPartner } from "@/lib/add-relationship-dialog-model";
import {
  organizationArchivedMessage,
  USER_ALREADY_IN_ORGANIZATION_MESSAGE,
  userAlreadyInOrganizationMessage,
} from "@/lib/api/organization-errors";
import { useUserMutation } from "@/lib/api/organizations/users";
import { UserApi, userLookupRateLimitedMessage } from "@/lib/api/users";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import { toast } from "@/lib/toast";
import { type Id, isForbiddenError, PERMISSION_DENIED_MESSAGE } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import { Role, type User, type UserLookupResult } from "@/types/user";

interface AddMemberInput {
  onClose: () => void;
  onMemberAdded: () => void;
  /** Coach candidates. Empty skips the relationship step. */
  organizationMembers: User[];
  canAddExisting: boolean;
  initialMode: AddMemberMode;
}

export interface LookupState {
  email: string;
  found: Option<UserLookupResult>;
  message: Option<string>;
  lookingUp: boolean;
}

export interface AddMemberDialogModel {
  organizationName: string;
  canAddExisting: boolean;
  mode: AddMemberMode;
  onModeChange: (mode: AddMemberMode) => void;
  fields: NewPersonFields;
  onFieldChange: (name: keyof NewPersonFields, value: string) => void;
  lookup: LookupState;
  onLookupEmailChange: (email: string) => void;
  onFind: () => void;
  onClearFound: () => void;
  joiner: Option<Joiner>;
  role: Role;
  onRoleChange: (role: Role) => void;
  relationship: JoinRelationship;
  onRelationshipChange: (relationship: JoinRelationship) => void;
  people: PickerPerson[];
  coachId: Option<Id>;
  onCoachSelect: (userId: Id) => void;
  summary: Option<string>;
  step: AddMemberStep;
  stepTitle: string;
  rail: StepRailItem[];
  lead: StepDialogLead;
  position: { index: number; total: number };
  onPrev: Option<() => void>;
  onNext: Option<() => void>;
}

function coachChoices(members: readonly Member[]): PickerPerson[] {
  return [...members]
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((m) => ({
      userId: m.userId,
      fullName: m.fullName,
      initials: m.initials,
      subline: m.email,
      inactive: false,
      selectable: true,
    }));
}

function addErrorMessage(error: unknown): string {
  return (
    userAlreadyInOrganizationMessage(error) ??
    organizationArchivedMessage(error) ??
    (isForbiddenError(error) ? PERMISSION_DENIED_MESSAGE : "Couldn't add the member")
  );
}

// The throttle first: the generic fallback blames the address, when the limit is
// on the admin doing the searching.
function lookupErrorMessage(error: unknown): string {
  return (
    userLookupRateLimitedMessage(error) ??
    (isForbiddenError(error) ? PERMISSION_DENIED_MESSAGE : "There was an error looking up that email.")
  );
}

const EMPTY_LOOKUP: LookupState = { email: "", found: None, message: None, lookingUp: false };

function useEmailLookup(organizationMembers: readonly User[]) {
  const [lookup, setLookup] = useState<LookupState>(EMPTY_LOOKUP);
  /** Identifies the newest lookup, so a slower earlier one can't land on top of it. */
  const request = useRef(0);

  // A found user belongs to the email that produced it, so editing the field
  // discards it, along with any lookup still in flight.
  const onLookupEmailChange = (email: string) => {
    request.current += 1;
    setLookup({ ...EMPTY_LOOKUP, email });
  };

  const onFind = async () => {
    const mine = ++request.current;
    setLookup((l) => ({ ...l, found: None, message: None, lookingUp: true }));
    const settle = (found: Option<UserLookupResult>, message: Option<string>) => {
      if (request.current === mine) setLookup((l) => ({ ...l, found, message, lookingUp: false }));
    };
    try {
      const result = await UserApi.lookupByEmail(lookup.email);
      // None also covers a real user outside this admin's scope. The backend
      // makes those cases indistinguishable, so the copy must too.
      if (result.none) return settle(None, Some("No user found with that email."));
      // Said now rather than as a 409 after they fill in the rest. The server
      // still enforces it, since the member list can be stale.
      if (organizationMembers.some((m) => m.id === result.val.id)) {
        return settle(None, Some(USER_ALREADY_IN_ORGANIZATION_MESSAGE));
      }
      settle(result, None);
    } catch (error) {
      console.error("Error looking up user:", error);
      settle(None, Some(lookupErrorMessage(error)));
    }
  };

  const onClearFound = () => {
    request.current += 1;
    setLookup(EMPTY_LOOKUP);
  };

  return { lookup, onLookupEmailChange, onFind, onClearFound };
}

export function useAddMemberDialog({
  onClose,
  onMemberAdded,
  organizationMembers,
  canAddExisting,
  initialMode,
}: AddMemberInput): AddMemberDialogModel {
  const { currentOrganizationId, currentOrganization } = useCurrentOrganization();
  const { createNested, attachExisting } = useUserMutation(currentOrganizationId);
  const { lookup, onLookupEmailChange, onFind, onClearFound } = useEmailLookup(organizationMembers);

  const [mode, setMode] = useState(canAddExisting ? initialMode : AddMemberMode.Create);
  const [fields, setFields] = useState(EMPTY_NEW_PERSON);
  const [role, setRole] = useState(Role.User);
  const [relationship, setRelationship] = useState(JoinRelationship.None);
  const [pickedCoachId, setPickedCoachId] = useState<Option<Id>>(None);
  const [step, setStep] = useState(AddMemberStep.Person);
  const [submitting, setSubmitting] = useState(false);

  const organizationName = currentOrganization?.name ?? "this organization";
  const members = organizationMembers.map(memberOf);
  const people = coachChoices(members);
  const coach = selectedPartner(pickedCoachId, people, members);
  const joiner = joinerOf(mode, fields, lookup.found);
  const order = stepOrder(mode, relationship, people.length > 0);
  const index = Math.max(order.indexOf(step), 0);
  const complete = isComplete(joiner, relationship, coach);
  const coachId = coachIdOf(relationship, coach);

  const submit = async () => {
    if (joiner.none || !complete) return;
    setSubmitting(true);
    try {
      if (mode === AddMemberMode.Existing && lookup.found.some) {
        await attachExisting(currentOrganizationId, lookup.found.val.id, role, coachId.some ? coachId.val : undefined);
        toast.success(`${joiner.val.fullName} added to this organization`);
      } else {
        await createNested(currentOrganizationId, newUserOf(fields, getBrowserTimezone(), coachId));
        toast.success(`${joiner.val.fullName} added`);
      }
      onMemberAdded();
      onClose();
    } catch (error) {
      console.error("Error adding member:", error);
      toast.error(addErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  // Later steps name the person, so the first can't be skipped.
  const canAdvance = step !== AddMemberStep.Person || joiner.some;

  return {
    organizationName,
    canAddExisting,
    mode,
    onModeChange: setMode,
    fields,
    onFieldChange: (name, value) => setFields((f) => ({ ...f, [name]: value })),
    lookup,
    onLookupEmailChange,
    onFind,
    onClearFound,
    joiner,
    role,
    onRoleChange: setRole,
    relationship,
    onRelationshipChange: setRelationship,
    people,
    coachId: coach.some ? Some(coach.val.userId) : None,
    onCoachSelect: (userId) => setPickedCoachId(Some(userId)),
    summary: joiner.some
      ? Some(summaryLine(joiner.val, organizationName, role, relationship, coach))
      : None,
    step,
    stepTitle: stepTitle(step, joiner, organizationName),
    rail: railOf({ step, order, mode, joiner, role, relationship, coach }),
    lead: leadOf({ step, order, mode, joiner, complete, submitting, onConfirm: submit }),
    position: { index: index + 1, total: order.length },
    onPrev: index > 0 ? Some(() => setStep(order[index - 1])) : None,
    onNext: index < order.length - 1 && canAdvance ? Some(() => setStep(order[index + 1])) : None,
  };
}
