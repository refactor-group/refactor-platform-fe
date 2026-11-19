import { Id } from "@/types/general";
import { isRelationshipRole, RelationshipRole } from "@/types/relationship-role";

/**
 * One person in a coaching relationship, as the backend describes them.
 *
 * This must always reflect the Rust struct on the backend
 * domain::coaching_relationship::Participant
 */
export interface Participant {
  id: Id;
  first_name: string;
  last_name: string;
  email: string;
  /** Computed by the backend; never derive it from coach_id or coachee_id. */
  role: RelationshipRole;
  /** False once they leave the organization: nothing new can be scheduled with or assigned to them. */
  is_member: boolean;
}

/** Always [coach seat, coachee seat]; still, find a participant by id, never by index. */
export type Participants = [Participant, Participant];

export function isParticipant(value: unknown): value is Participant {
  if (!value || typeof value !== "object") return false;
  const object = value as Record<string, unknown>;
  return (
    typeof object.id === "string" &&
    typeof object.first_name === "string" &&
    typeof object.last_name === "string" &&
    typeof object.email === "string" &&
    isRelationshipRole(object.role) &&
    typeof object.is_member === "boolean"
  );
}

export function isParticipants(value: unknown): value is Participants {
  return Array.isArray(value) && value.length === 2 && value.every(isParticipant);
}
