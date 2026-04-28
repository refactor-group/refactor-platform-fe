import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";
import { RelationshipRole } from "@/types/relationship-role";
import { User } from "@/types/user";

export interface CoachingRelationship {
  id: Id;
  coach_id: Id;
  coachee_id: Id;
  organization_id: Id;
  created_at: DateTime;
  updated_at: DateTime;
}

// This must always reflect the Rust struct on the backend
// entity_api::coaching_relationship::CoachingRelationshipWithUserNames
export type CoachingRelationshipWithUserNames = CoachingRelationship & {
  coach_first_name: string;
  coach_last_name: string;
  coachee_first_name: string;
  coachee_last_name: string;
};

/**
 * Relationship with embedded coach and coachee user data
 * Matches backend RelationshipWithUsers response from the enhanced endpoint
 *
 * This must always reflect the Rust struct on the backend
 * web::response::coaching_session::RelationshipWithUsers
 *
 * Note: This is different from CoachingRelationshipWithUserNames which only
 * contains name fields. This type contains full User objects.
 */
export type CoachingRelationshipWithUsers = CoachingRelationship & {
  coach: User;
  coachee: User;
};

export interface NewCoachingRelationship {
  coach_id: Id;
  coachee_id: Id;
}

export function isCoachingRelationshipWithUserNames(
  value: unknown
): value is CoachingRelationshipWithUserNames {
  if (!value || typeof value !== "object") {
    return false;
  }
  const object = value as Record<string, unknown>;

  return (
    typeof object.id === "string" &&
    typeof object.coach_id === "string" &&
    typeof object.coachee_id === "string" &&
    typeof object.coach_first_name === "string" &&
    typeof object.coach_last_name === "string" &&
    typeof object.coachee_first_name === "string" &&
    typeof object.coachee_last_name === "string" &&
    typeof object.created_at === "string" &&
    typeof object.updated_at === "string"
  );
}

export function isCoachingRelationshipWithUserNamesArray(
  value: unknown
): value is CoachingRelationshipWithUserNames[] {
  return (
    Array.isArray(value) && value.every(isCoachingRelationshipWithUserNames)
  );
}

export function getCoachingRelationshipById(
  id: string,
  relationships: CoachingRelationshipWithUserNames[]
): CoachingRelationshipWithUserNames {
  const relationship = relationships.find(
    (relationship) => relationship.id === id
  );
  return relationship
    ? relationship
    : defaultCoachingRelationshipWithUserNames();
}

export function defaultCoachingRelationshipWithUserNames(): CoachingRelationshipWithUserNames {
  var now = DateTime.now();
  return {
    id: "",
    coach_id: "",
    coachee_id: "",
    coach_first_name: "",
    coach_last_name: "",
    organization_id: "",
    coachee_first_name: "",
    coachee_last_name: "",
    created_at: now,
    updated_at: now,
  };
}

export function defaultCoachingRelationshipsWithUserNames(): CoachingRelationshipWithUserNames[] {
  return [defaultCoachingRelationshipWithUserNames()];
}

export function coachingRelationshipWithUserNamesToString(
  relationship: CoachingRelationshipWithUserNames | undefined
): string {
  return JSON.stringify(relationship);
}

export function coachingRelationshipsWithUserNamesToString(
  relationships: CoachingRelationshipWithUserNames[] | undefined
): string {
  return JSON.stringify(relationships);
}

/**
 * Checks if a user is a coach in any of the provided relationships
 */
export function isUserCoach(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): boolean {
  return relationships.some(r => r.coach_id === userId);
}

/**
 * Checks if a user is a coachee in any of the provided relationships
 */
export function isUserCoachee(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): boolean {
  return relationships.some(r => r.coachee_id === userId);
}

/**
 * Checks if a user is the coach in a single relationship
 */
export function isUserCoachInRelationship(
  userId: Id,
  relationship: CoachingRelationshipWithUserNames
): boolean {
  return relationship.coach_id === userId;
}

/**
 * Checks if a user is the coachee in a single relationship
 */
export function isUserCoacheeInRelationship(
  userId: Id,
  relationship: CoachingRelationshipWithUserNames
): boolean {
  return relationship.coachee_id === userId;
}

/**
 * Returns all relationships where the user is the coach
 */
export function getRelationshipsAsCoach(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): CoachingRelationshipWithUserNames[] {
  return relationships.filter(r => r.coach_id === userId);
}

/**
 * Returns all relationships where the user is the coachee
 */
export function getRelationshipsAsCoachee(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): CoachingRelationshipWithUserNames[] {
  return relationships.filter(r => r.coachee_id === userId);
}

/**
 * Returns the display name of the other participant in a relationship
 * relative to the given user.
 */
export function getOtherPersonName(
  rel: CoachingRelationshipWithUserNames,
  userId: Id
): string {
  if (rel.coach_id === userId) {
    return `${rel.coachee_first_name} ${rel.coachee_last_name}`.trim();
  }
  return `${rel.coach_first_name} ${rel.coach_last_name}`.trim();
}

/**
 * The other participant's display info, derived from the relationship.
 *
 * Relationship-scoped twin of `getSessionParticipantInfo` (which requires
 * an enriched session). Use when you have the relationship in hand but not
 * a per-session enriched payload — e.g. listing many sessions on the
 * dashboard without losing SWR cache reuse with the session page.
 */
export interface RelationshipParticipantInfo {
  /** Joined "First Last" of the counterpart, trimmed; may be empty if both name fields are blank. */
  readonly participantName: string;
  /** Counterpart's first name (for avatar initials). */
  readonly firstName: string;
  /** Counterpart's last name (for avatar initials). */
  readonly lastName: string;
  /** The viewer's role in the relationship. */
  readonly userRole: RelationshipRole;
  /** True when the viewer is the coach (and therefore counterpart is the coachee). */
  readonly isCoach: boolean;
}

export function getRelationshipParticipantInfo(
  relationship: CoachingRelationshipWithUserNames,
  viewerId: Id
): RelationshipParticipantInfo {
  const isCoach = relationship.coach_id === viewerId;
  const userRole = isCoach ? RelationshipRole.Coach : RelationshipRole.Coachee;
  const firstName = isCoach
    ? relationship.coachee_first_name
    : relationship.coach_first_name;
  const lastName = isCoach
    ? relationship.coachee_last_name
    : relationship.coach_last_name;
  return {
    participantName: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    userRole,
    isCoach,
  };
}

/**
 * Sort relationships alphabetically by the other participant's name
 * relative to the given user.
 */
export function sortRelationshipsByParticipantName(
  relationships: CoachingRelationshipWithUserNames[],
  userId: Id
): CoachingRelationshipWithUserNames[] {
  return [...relationships].sort((a, b) =>
    getOtherPersonName(a, userId).localeCompare(getOtherPersonName(b, userId))
  );
}
