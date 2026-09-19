import { Id } from "@/types/general";
import { isAdminOrSuperAdmin, UserRoleState } from "@/types/user";

export function shouldDenyMembersPageAccess(
  currentOrganizationId: Id | null,
  organizationId: Id,
  currentUserRoleState: UserRoleState,
  isLoggedIn: boolean,
  wasLoggedIn: boolean
): boolean {
  // Actively signing out: the session clears before the redirect completes,
  // so the page re-renders unauthenticated while still mounted. Let it
  // render rather than 404 on the way to the login screen -- but only for a
  // visitor who WAS authenticated this mount. A visitor who never was stays
  // on the normal deny path below, so this can't be used to skip the gate
  // entirely on a fresh, unauthenticated visit.
  if (wasLoggedIn && !isLoggedIn) return false;
  if (!isLoggedIn) return true;
  if (currentOrganizationId !== organizationId) return false;
  // User is not a member of this organization
  if (currentUserRoleState.status === 'no_access') return true;
  // User is a member but not Admin or SuperAdmin
  if (!isAdminOrSuperAdmin(currentUserRoleState)) return true;
  return false;
}
