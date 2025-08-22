/**
 * Represents the role of a user within a coaching relationship.
 * This is distinct from the system-level Role (Admin/User) and is
 * determined by the relationship context between two users.
 */
export type RelationshipRole = 'coach' | 'coachee';

/**
 * Helper to get the opposite role in a relationship
 */
export function getOppositeRole(role: RelationshipRole): RelationshipRole {
  return role === 'coach' ? 'coachee' : 'coach';
}

/**
 * Helper to format role for display
 */
export function formatRelationshipRole(role: RelationshipRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1);
}