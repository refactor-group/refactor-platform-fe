import { isSuperAdmin, UserRole } from "@/types/user";

/**
 * Whether to deny access to the platform /admin section. Only system-level
 * SuperAdmins may enter. Callers invoke notFound() when this returns true,
 * mirroring the members page access-control idiom.
 */
export function shouldDenyAdminAccess(roles: UserRole[]): boolean {
  return !isSuperAdmin(roles);
}
