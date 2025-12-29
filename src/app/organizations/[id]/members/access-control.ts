import { Id } from "@/types/general";
import { isAdminOrSuperAdmin, UserRoleState } from "@/types/user";

export function shouldDenyMembersPageAccess(
  currentOrganizationId: Id | null,
  organizationId: Id,
  currentUserRoleState: UserRoleState
): boolean {
  if (currentOrganizationId !== organizationId) return false;
  // User is not a member of this organization
  if (currentUserRoleState.status === 'no_access') return true;
  // User is a member but not Admin or SuperAdmin
  if (!isAdminOrSuperAdmin(currentUserRoleState)) return true;
  return false;
}
