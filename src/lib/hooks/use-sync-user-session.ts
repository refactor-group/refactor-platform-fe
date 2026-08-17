"use client";

import { useEffect } from "react";

import { useUser } from "@/lib/api/users";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import type { UserRole } from "@/types/user";

const rolesFingerprint = (roles: UserRole[]): string =>
  roles
    .map((r) => `${r.id}|${r.role}|${r.organization_id ?? ""}`)
    .sort()
    .join(",");

/**
 * Keeps the persisted auth session's roles in step with the backend, so a
 * promotion or demotion takes effect without a logout. `GET /users/{id}` for
 * the signed-in user returns the complete cross-organization role set; never
 * repoint this at an org-scoped endpoint, which filters `roles` to one org.
 */
export const useSyncUserSession = () => {
  const userId = useAuthStore((state) => state.userId);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const userSession = useAuthStore((state) => state.userSession);
  const syncUserSession = useAuthStore((state) => state.syncUserSession);

  const { user } = useUser(isLoggedIn && userId ? userId : "", {
    revalidateOnFocus: true,
  });

  useEffect(() => {
    if (!isLoggedIn || !userId) return;
    // useUser yields defaultUser() (roles: []) until the fetch resolves;
    // syncing that would wipe every membership.
    if (!user.id || user.id !== userId) return;
    if (rolesFingerprint(user.roles) === rolesFingerprint(userSession.roles)) {
      return;
    }
    syncUserSession(userId, user);
  }, [isLoggedIn, userId, user, userSession, syncUserSession]);
};
