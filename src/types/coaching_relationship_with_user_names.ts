import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";

// This must always reflect the Rust struct on the backend
// entity_api::coaching_relationship::CoachingRelationshipWithUserNames
export interface CoachingRelationshipWithUserNames {
  id: Id;
  coach_id: Id;
  coachee_id: Id;
  coach_first_name: string;
  coach_last_name: string;
  coachee_first_name: string;
  coachee_last_name: string;
  created_at: DateTime;
  updated_at: DateTime;
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
