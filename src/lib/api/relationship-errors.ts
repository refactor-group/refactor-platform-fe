import { CoachingRelationshipApi } from "@/lib/api/coaching-relationships";
import {
  type CoachingRelationshipWithUserNames,
  RelationshipKind,
} from "@/types/coaching-relationship";
import { conflictDetailsOf, conflictReasonOf } from "@/types/entity-api-error";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";

/** A pair holds at most one relationship per organization, except coaching each other. */
export function isPairAlreadyRelated(error: unknown): boolean {
  const reason = conflictReasonOf(error);
  return reason.some && reason.val === "pair_already_related";
}

function existingRelationshipIdOf(error: unknown): Option<Id> {
  const details = conflictDetailsOf(error);
  const id = details.some ? details.val.relationship_id : undefined;
  return typeof id === "string" ? Some(id) : None;
}

/**
 * The relationship that refused a new one, when the backend names it and it can be read.
 * Read from the organization's list: an admin who isn't in it can't read it by id.
 */
export async function existingRelationshipOf(
  error: unknown,
  organizationId: Id
): Promise<Option<CoachingRelationshipWithUserNames>> {
  const id = existingRelationshipIdOf(error);
  if (id.none) return None;
  try {
    const found = (await CoachingRelationshipApi.list(organizationId)).find((r) => r.id === id.val);
    return found ? Some(found) : None;
  } catch {
    return None;
  }
}

function fullName(first: string, last: string): string {
  return `${first} ${last}`.trim();
}

/** "Ada and Mate are already colleagues" or "Ada is already Mate's coach"; generic when it couldn't be read. */
export function pairAlreadyRelatedMessage(
  existing: Option<CoachingRelationshipWithUserNames>,
  first: string,
  second: string
): string {
  if (existing.none) return `${first} and ${second} already have a relationship`;
  const r = existing.val;
  if (r.kind === RelationshipKind.Colleague) return `${first} and ${second} are already colleagues`;
  return `${fullName(r.coach_first_name, r.coach_last_name)} is already ${fullName(r.coachee_first_name, r.coachee_last_name)}'s coach`;
}
