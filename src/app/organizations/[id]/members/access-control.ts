import { Id } from "@/types/general";
import { isAdminOrSuperAdmin, UserRoleState } from "@/types/user";

export function shouldDenyMembersPageAccess(
  currentOrganizationId: Id | null,
  organizationId: Id,
  currentUserRoleState: UserRoleState,
  isLoggedIn: boolean
): boolean {
  // Signing out clears the session before the redirect completes, so the page
  // re-renders unauthenticated while still mounted. That is not "no such page"
  // -- 404ing here flashes a 404 on the way to the login screen. Authentication
  // is the auth layer's to handle; this guard only decides authorization.
  if (!isLoggedIn) return false;
  if (currentOrganizationId !== organizationId) return false;
  // User is not a member of this organization
  if (currentUserRoleState.status === 'no_access') return true;
  // User is a member but not Admin or SuperAdmin
  if (!isAdminOrSuperAdmin(currentUserRoleState)) return true;
  return false;
}
