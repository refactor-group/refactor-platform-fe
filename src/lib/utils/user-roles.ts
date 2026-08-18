import { User, Role } from "@/types/user";
import {
  CoachingRelationshipWithUserNames,
  isUserCoach,
  isUserCoachee,
  getRelationshipsAsCoachee,
} from "@/types/coaching-relationship";
import { RelationshipRole } from "@/types/relationship-role";
import { Id } from "@/types/general";
import { type Option, Some, None } from "@/types/option";

export type DisplayRole = Role | RelationshipRole

/** Roles whose enum value differs from the word shown to a user; anything absent falls through. */
const ROLE_DISPLAY_NAMES: Partial<Record<DisplayRole, string>> = {
  [Role.User]: "Member",
  [Role.SuperAdmin]: "Super Admin",
};

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
): readonly string[] {
  const roles = new Set<DisplayRole>();

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
    roles.add(RelationshipRole.Coach);
  }
  if (isUserCoachee(user.id, relationships)) {
    roles.add(RelationshipRole.Coachee);
  }

  return Array.from(roles)
    .map(role => ROLE_DISPLAY_NAMES[role] ?? role)
    .sort();
}

/**
 * Gets the user's membership role in one organization.
 *
 * Unlike {@link getUserRoleForOrganization}, a global SuperAdmin assignment
 * (`organization_id === null`) is not a membership here and yields None.
 */
export function getOrganizationMembershipRole(
  user: User,
  organizationId: Id
): Option<Role> {
  const membership = user.roles.find(
    (r) => r.organization_id === organizationId
  );
  return membership ? Some(membership.role) : None;
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
): readonly string[] {
  return getRelationshipsAsCoachee(userId, relationships)
    .map(r => `${r.coach_first_name} ${r.coach_last_name}`);
}
