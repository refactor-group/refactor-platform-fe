import { conflictDetailsOf } from "@/types/entity-api-error";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";

/** Values match a 409 body's `details.reason`. */
export enum NotAMemberReason {
  Coachee = "coachee_not_a_member",
  Assignee = "assignee_not_a_member",
}

/** A write refused because someone in it is no longer a member of the organization. */
export interface NotAMemberRefusal {
  reason: NotAMemberReason;
  userId: Option<Id>;
  organizationId: Option<Id>;
}

/** Resolves a person's display name; the id is absent on older backends. */
export type NameLookup = (userId: Option<Id>) => Option<string>;

export const noName: NameLookup = () => None;

const REASONS: ReadonlySet<string> = new Set(Object.values(NotAMemberReason));

const idOf = (value: unknown): Option<Id> => (typeof value === "string" ? Some(value) : None);

export function notAMemberRefusalOf(error: unknown): Option<NotAMemberRefusal> {
  const details = conflictDetailsOf(error);
  if (details.none) return None;
  const { reason, user_id, organization_id } = details.val;
  if (typeof reason !== "string" || !REASONS.has(reason)) return None;
  return Some({
    reason: reason as NotAMemberReason,
    userId: idOf(user_id),
    organizationId: idOf(organization_id),
  });
}
