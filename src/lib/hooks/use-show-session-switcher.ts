"use client";

import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useUserCoachingRoles } from "@/lib/api/user-coaching-relationships";

/**
 * Whether the global nav should offer the session switcher.
 *
 * Useful only once the user has somewhere to switch to: two or more coaching
 * relationships, in either role. Hidden while loading so it never flashes in
 * and out.
 */
export const useShowSessionSwitcher = (): boolean => {
  const userId = useAuthStore((state) => state.userId);
  const { participantRelationshipCount, isLoading, isError } =
    useUserCoachingRoles(userId ? userId : null);

  if (isLoading || isError) return false;

  return participantRelationshipCount > 1;
};
