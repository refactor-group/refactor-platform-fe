import { CoachingRelationshipWithUserNames, RelationshipKind } from "@/types/coaching-relationship";
import type { NameLookup } from "@/types/membership";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { Seat, seatParticipant } from "@/lib/participants";
import type { Id } from "@/types/general";
import { None, Some } from "@/types/option";

/**
 * Relationship Utility Functions
 * Story: "Reusable utilities for working with coaching relationships"
 */

/**
 * Get full name from first and last name parts
 * Story: "Combine name parts into a full name, handling missing parts gracefully"
 */
export function getFullName(firstName: string, lastName: string): string {
  return lastName ? `${firstName} ${lastName}` : firstName;
}

function seatName(relationship: CoachingRelationshipWithUserNames, seat: Seat): string {
  const { first_name, last_name } = seatParticipant(relationship, seat);
  return getFullName(first_name, last_name);
}

/** The full name of whoever holds the coach seat; for seat-ordered copy such as "Jim → Cara". */
export function getCoachName(relationship: CoachingRelationshipWithUserNames): string {
  return seatName(relationship, Seat.Coach);
}

/** The full name of whoever holds the coachee seat. */
export function getCoacheeName(relationship: CoachingRelationshipWithUserNames): string {
  return seatName(relationship, Seat.Coachee);
}

/** Joins an enriched session's relationship and participants into the canonical type. */
export function buildRelationshipWithUserNames(
  session: EnrichedCoachingSession
): CoachingRelationshipWithUserNames {
  const { relationship, participants } = session;

  if (!relationship || participants.none) {
    throw new Error(
      "buildRelationshipWithUserNames: session.relationship and participants are required"
    );
  }

  return { ...relationship, participants: participants.val };
}

/** Resolves a participant's full name from a user id that may be absent. */
export function participantNameOf(relationship: CoachingRelationshipWithUserNames): NameLookup {
  return (userId) => {
    if (userId.none) return None;
    if (userId.val === relationship.coach_id) return Some(getCoachName(relationship));
    if (userId.val === relationship.coachee_id) return Some(getCoacheeName(relationship));
    return None;
  };
}

/** "You → Cara Test" for coaching, "You and Caleb Bourg" for colleagues. */
export function relationshipPairLabel(relationship: CoachingRelationshipWithUserNames, userId: Id): string {
  const name = (id: Id, full: string) => (id === userId ? "You" : full);
  const coach = name(relationship.coach_id, getCoachName(relationship));
  const coachee = name(relationship.coachee_id, getCoacheeName(relationship));
  if (relationship.kind === RelationshipKind.Colleague) {
    return relationship.coachee_id === userId ? `${coachee} and ${coach}` : `${coach} and ${coachee}`;
  }
  return `${coach} \u2192 ${coachee}`;
}
