import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";
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
