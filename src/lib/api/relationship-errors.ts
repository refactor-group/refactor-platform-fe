import { CoachingRelationshipApi } from "@/lib/api/coaching-relationships";
import {
  type CoachingRelationshipWithUserNames,
  RelationshipKind,
} from "@/types/coaching-relationship";
import { conflictDetailsOf, conflictReasonOf } from "@/types/entity-api-error";
import type { Id } from "@/types/general";
import { participantName, Seat, seatParticipant } from "@/lib/participants";
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

/** "Ada and Mate are already colleagues" or "Ada is already Mate's coach"; generic when it couldn't be read. */
export function pairAlreadyRelatedMessage(
  existing: Option<CoachingRelationshipWithUserNames>,
  first: string,
  second: string
): string {
  if (existing.none) return `${first} and ${second} already have a relationship`;
  const r = existing.val;
  if (r.kind === RelationshipKind.Colleague) return `${first} and ${second} are already colleagues`;
  const coach = participantName(seatParticipant(r, Seat.Coach));
  const coachee = participantName(seatParticipant(r, Seat.Coachee));
  return `${coach} is already ${coachee}'s coach`;
}

export interface ActionsBecomingVisible {
  userId: Id;
  byAssignee: { assigneeId: Id; count: number }[];
}

/** What a kind switch would change, from its unconfirmed 409. */
export interface KindSwitchConsequences {
  actionsBecomingVisible: ActionsBecomingVisible[];
  schedulingGained: Id[];
  schedulingLost: Id[];
}

const idsOf = (value: unknown): Id[] =>
  Array.isArray(value) ? value.filter((id): id is Id => typeof id === "string") : [];

function byAssigneeOf(value: unknown): ActionsBecomingVisible["byAssignee"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) =>
    typeof entry?.assignee_id === "string" && typeof entry?.count === "number"
      ? [{ assigneeId: entry.assignee_id, count: entry.count }]
      : []
  );
}

function actionsBecomingVisibleOf(value: unknown): ActionsBecomingVisible[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) =>
    typeof entry?.user_id === "string" ? [{ userId: entry.user_id, byAssignee: byAssigneeOf(entry.by_assignee) }] : []
  );
}

export function kindSwitchConsequencesOf(error: unknown): Option<KindSwitchConsequences> {
  const details = conflictDetailsOf(error);
  if (details.none || details.val.reason !== "kind_switch_needs_confirmation") return None;
  return Some({
    actionsBecomingVisible: actionsBecomingVisibleOf(details.val.actions_becoming_visible),
    schedulingGained: idsOf(details.val.scheduling_gained),
    schedulingLost: idsOf(details.val.scheduling_lost),
  });
}
