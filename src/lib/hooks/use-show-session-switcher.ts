"use client";

import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUserCoachingRoles } from "@/lib/api/user-coaching-relationships";
import { runsSessionsInAny } from "@/types/coaching-relationship";

/**
 * Whether the global nav should offer the session switcher: to anyone who runs sessions
 * in this organization (a coach or a colleague), never to someone only ever coached.
 * Hidden while loading so it never flashes in and out.
 */
export const useShowSessionSwitcher = (): boolean => {
  const userId = useAuthStore((state) => state.userId);
  const { relationships, isLoading, isError } = useUserCoachingRoles(userId ? userId : null);

  if (isLoading || isError) return false;

  return runsSessionsInAny(relationships);
};
