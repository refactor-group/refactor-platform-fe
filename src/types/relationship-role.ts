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
