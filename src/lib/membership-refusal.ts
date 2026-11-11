import axios from "axios";
import { EntityApiError } from "@/types/entity-api-error";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";

/** Values match a 409 body's `details.reason`. */
export enum MembershipRefusalReason {
  CoacheeNotAMember = "coachee_not_a_member",
  AssigneeNotAMember = "assignee_not_a_member",
}

export interface MembershipRefusal {
  reason: MembershipRefusalReason;
  userId: Option<Id>;
  organizationId: Option<Id>;
}

/** The write that was refused; it decides the toast's next step. */
export enum RefusedWrite {
  Schedule = "schedule",
  Resend = "resend",
  Assign = "assign",
}

const REASONS: ReadonlySet<string> = new Set(Object.values(MembershipRefusalReason));

function conflictBody(error: unknown): Option<unknown> {
  if (error instanceof EntityApiError) return error.status === 409 ? Some(error.data) : None;
  if (axios.isAxiosError(error) && error.response?.status === 409) return Some(error.response.data);
  return None;
}

const idOf = (value: unknown): Option<Id> => (typeof value === "string" ? Some(value) : None);

export function membershipRefusalOf(error: unknown): Option<MembershipRefusal> {
  const body = conflictBody(error);
  if (body.none) return None;
  const details = (body.val as { details?: Record<string, unknown> } | undefined)?.details;
  const reason = details?.reason;
  if (typeof reason !== "string" || !REASONS.has(reason)) return None;
  return Some({
    reason: reason as MembershipRefusalReason,
    userId: idOf(details?.user_id),
    organizationId: idOf(details?.organization_id),
  });
}

function purpose(write: RefusedWrite): string {
  switch (write) {
    case RefusedWrite.Schedule:
      return "to schedule sessions";
    case RefusedWrite.Resend:
      return "to resend the invite";
    case RefusedWrite.Assign:
      return "to assign actions";
    default: {
      const _exhaustive: never = write;
      throw new Error(`Unhandled refused write: ${_exhaustive}`);
    }
  }
}

/** Two-part toast copy: who left, then what the viewer can do about it. */
export function membershipRefusalMessage(
  write: RefusedWrite,
  name: Option<string>,
  canAddBack: boolean
): string {
  const who = name.some ? name.val : "This person";
  const them = name.some ? name.val : "this person";
  const next = canAddBack ? `Add ${them} back ${purpose(write)}` : `Ask an admin to add ${them} back`;
  return `${who} is no longer in this organization · ${next}`;
}
