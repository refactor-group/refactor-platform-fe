import { User, Role } from "@/types/user";
import { CoachingRelationshipWithUserNames, isUserCoach, isUserCoachee } from "@/types/coaching_relationship";
import { RelationshipRole, formatRelationshipRole } from "@/types/relationship-role";
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

  // Add SuperAdmin role if user has it (global access)
  const superAdminRole = user.roles.find(
    r => r.role === Role.SuperAdmin && r.organization_id === null
  );
  if (superAdminRole) {
    roles.add(superAdminRole.role);
  }

  // Add organization-specific role
  const orgRole = user.roles.find(r => r.organization_id === organizationId);
  if (orgRole) {
    roles.add(orgRole.role);
  }

  // Add coaching relationship roles
  if (isUserCoach(user.id, relationships)) {
    roles.add(formatRelationshipRole(RelationshipRole.Coach));
  }
  if (isUserCoachee(user.id, relationships)) {
    roles.add(formatRelationshipRole(RelationshipRole.Coachee));
  }

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
