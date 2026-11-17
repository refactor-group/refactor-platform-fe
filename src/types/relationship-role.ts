/**
 * What a participant is to their coaching relationship. Distinct from the
 * system-level Role (Admin/User). Values are the backend's wire values.
 */
export enum RelationshipRole {
  Coach = "coach",
  Coachee = "coachee",
  Colleague = "colleague",
}

export function isRelationshipRole(value: unknown): value is RelationshipRole {
  return Object.values(RelationshipRole).includes(value as RelationshipRole);
}

/** What someone in this role does and sees, for people choosing a role. */
export function relationshipRoleExplanation(role: RelationshipRole): string {
  switch (role) {
    case RelationshipRole.Coach:
      return "Schedules and runs sessions with their coachee, and sees every action in the relationship.";
    case RelationshipRole.Coachee:
      return "Meets with their coach, who schedules their sessions. Sees only the actions assigned to them.";
    case RelationshipRole.Colleague:
      return "Works with a peer as an equal. Either of them can schedule sessions, and both see every action they share.";
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unhandled relationship role: ${_exhaustive}`);
    }
  }
}

export function relationshipRoleLabel(role: RelationshipRole): string {
  switch (role) {
    case RelationshipRole.Coach:
      return "Coach";
    case RelationshipRole.Coachee:
      return "Coachee";
    case RelationshipRole.Colleague:
      return "Colleague";
    default: {
      const _exhaustive: never = role;
      throw new Error(`Unhandled relationship role: ${_exhaustive}`);
    }
  }
}
