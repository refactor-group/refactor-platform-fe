import { isSuperAdmin, UserRole } from "@/types/user";

/**
 * Whether to deny access to the platform /admin section. Only system-level
 * SuperAdmins may enter. Callers invoke notFound() when this returns true,
 * mirroring the members page access-control idiom.
 */
export function shouldDenyAdminAccess(
  roles: UserRole[],
  isLoggedIn: boolean
): boolean {
  // See the members page guard: a signed-out render is not a missing page, and
  // 404ing it flashes a 404 between logout and the login screen.
  if (!isLoggedIn) return false;
  return !isSuperAdmin(roles);
}
