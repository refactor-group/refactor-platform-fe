"use client";

import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { isSuperAdmin } from "@/types/user";

/**
 * Returns true if the logged-in user is a system-level SuperAdmin.
 *
 * Independent of the currently selected organization, so it is safe to use on
 * platform-wide pages where no org is in context (the /admin section). Auth-store
 * hydration is already gated by AuthStoreProvider, so roles are available here.
 */
export const useIsSuperAdmin = (): boolean => {
  const roles = useAuthStore((state) => state.userSession?.roles);
  return isSuperAdmin(roles ?? []);
};
