import { User } from "@/types/user";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship";
import { Id } from "@/types/general";

/**
 * Gets display roles for a user combining organization roles and coaching relationship roles
 * @param user - The user to get roles for
 * @param organizationId - The current organization ID
 * @param relationships - All coaching relationships for the user
 * @returns Array of role names sorted alphabetically
 */
export function getUserDisplayRoles(
  user: User,
  organizationId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): string[] {
  const roles = new Set<string>();

  // Check for SuperAdmin role (organization_id is null for global roles)
  const superAdminRole = user.roles.find(r => r.role === 'SuperAdmin' && r.organization_id === null);
  if (superAdminRole) {
    roles.add(superAdminRole.role);
  }

  // Add organization-specific role
  const orgRole = user.roles.find(r => r.organization_id === organizationId);
  if (orgRole) {
    roles.add(orgRole.role);
  }

  // Add coaching roles
  const isCoach = relationships.some(r => r.coach_id === user.id);
  const isCoachee = relationships.some(r => r.coachee_id === user.id);

  if (isCoach) roles.add('Coach');
  if (isCoachee) roles.add('Coachee');

  return Array.from(roles).sort();
}

/**
 * Gets the names of all coaches for a given user
 * @param userId - The user ID to get coaches for
 * @param relationships - All coaching relationships
 * @returns Array of coach names in "FirstName LastName" format
 */
export function getUserCoaches(
  userId: Id,
  relationships: CoachingRelationshipWithUserNames[]
): string[] {
  return relationships
    .filter(r => r.coachee_id === userId)
    .map(r => `${r.coach_first_name} ${r.coach_last_name}`);
}
