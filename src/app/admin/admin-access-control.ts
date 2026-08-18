import { isSuperAdmin, UserRole } from "@/types/user";

/**
 * Whether to deny access to the platform /admin section. Only system-level
 * SuperAdmins may enter. Callers invoke notFound() when this returns true,
 * mirroring the members page access-control idiom.
 */
export function shouldDenyAdminAccess(
  roles: UserRole[],
  isLoggedIn: boolean,
  wasLoggedIn: boolean
): boolean {
  // See the members page guard: bypass only a real logout transition (was
  // authenticated this mount, isn't now). This route has no middleware
  // protection, so without the wasLoggedIn condition a never-signed-in
  // visitor would reach this page and see the SuperAdmin shell render.
  if (wasLoggedIn && !isLoggedIn) return false;
  if (!isLoggedIn) return true;
  return !isSuperAdmin(roles);
}
