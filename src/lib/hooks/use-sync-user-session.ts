"use client";

import { useEffect } from "react";

import { UserApi, USERS_BASEURL } from "@/lib/api/users";
import { useApiSWR } from "@/lib/hooks/use-api-swr";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import type { User, UserRole } from "@/types/user";

const rolesFingerprint = (roles: readonly UserRole[] | undefined): string =>
  (roles ?? [])
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

  // Deliberately a cache entry of its own rather than `useUser`'s: revalidating
  // on focus must not push a fresh payload into the key editable forms read
  // from, or an in-progress edit would be reset underneath the user.
  const { data: user } = useApiSWR<User>(
    isLoggedIn && userId ? [`${USERS_BASEURL}/${userId}`, "session-sync"] : null,
    () => UserApi.get(userId),
    { revalidateOnFocus: true }
  );

  useEffect(() => {
    if (!isLoggedIn || !userId || !user) return;
    // Ignore anything that isn't the signed-in user: seeding the session from a
    // placeholder or another user's payload would wipe every membership.
    if (!user.id || user.id !== userId) return;
    if (rolesFingerprint(user.roles) === rolesFingerprint(userSession?.roles)) {
      return;
    }
    syncUserSession(userId, user);
  }, [isLoggedIn, userId, user, userSession, syncUserSession]);
};
