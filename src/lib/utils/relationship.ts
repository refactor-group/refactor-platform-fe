import { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { User } from "@/types/user";
import { RelationshipRole } from "@/types/relationship-role";
import type { Id } from "@/types/general";

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

/**
 * Get coach's full name from relationship
 * Story: "Extract and format the coach's name"
 */
export function getCoachName(
  relationship: CoachingRelationshipWithUserNames
): string {
  return getFullName(
    relationship.coach_first_name,
    relationship.coach_last_name
  );
}

/**
 * Get coachee's full name from relationship
 * Story: "Extract and format the coachee's name"
 */
export function getCoacheeName(
  relationship: CoachingRelationshipWithUserNames
): string {
  return getFullName(
    relationship.coachee_first_name,
    relationship.coachee_last_name
  );
}

/**
 * Get the other participant's name based on current user
 * Story: "Show who the user is meeting with"
 */
export function getOtherParticipantName(
  relationship: CoachingRelationshipWithUserNames,
  user: User
): string {
  const isCoach = relationship.coach_id === user.id;
  return isCoach ? getCoacheeName(relationship) : getCoachName(relationship);
}

/**
 * Determine if user is the coach in this relationship
 * Story: "Check if the current user is coaching or being coached"
 */
export function isUserCoach(
  relationship: CoachingRelationshipWithUserNames,
  user: User
): boolean {
  return relationship.coach_id === user.id;
}

/**
 * Get user's role in the relationship
 * Story: "Tell user if they're coaching or being coached"
 */
export function getUserRoleInRelationship(
  relationship: CoachingRelationshipWithUserNames,
  user: User
): RelationshipRole {
  return isUserCoach(relationship, user) ? RelationshipRole.Coach : RelationshipRole.Coachee;
}

/**
 * Resolve a user ID to their name within a relationship
 * Story: "Show who performed an action in a coaching relationship"
 */
export function resolveUserNameInRelationship(
  userId: Id,
  relationship: CoachingRelationshipWithUserNames
): string {
  if (userId === relationship.coach_id) {
    return getCoachName(relationship);
  }
  if (userId === relationship.coachee_id) {
    return getCoacheeName(relationship);
  }
  return "Unknown";
}

/**
 * Builds a CoachingRelationshipWithUserNames from an enriched coaching session.
 * Extracts coach, coachee, and relationship data into the canonical type.
 *
 * @param session - Enriched coaching session with relationship data
 */
export function buildRelationshipWithUserNames(
  session: EnrichedCoachingSession
): CoachingRelationshipWithUserNames {
  const { coach, coachee, relationship } = session;

  if (!relationship) {
    throw new Error(
      "buildRelationshipWithUserNames: session.relationship is required"
    );
  }

  return {
    id: relationship.id,
    coach_id: relationship.coach_id,
    coachee_id: relationship.coachee_id,
    organization_id: relationship.organization_id,
    created_at: relationship.created_at,
    updated_at: relationship.updated_at,
    coach_first_name: coach?.first_name ?? "Unknown",
    coach_last_name: coach?.last_name ?? "",
    coachee_first_name: coachee?.first_name ?? "Unknown",
    coachee_last_name: coachee?.last_name ?? "",
  };
}
