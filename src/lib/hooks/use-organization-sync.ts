"use client";

import { useEffect, useMemo } from "react";

import { useOrganizationList } from "@/lib/api/organizations";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import {
  useReconcileCurrentOrganization,
  type OrganizationMembership,
} from "@/lib/hooks/use-reconcile-current-organization";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { isUserCoach } from "@/types/coaching-relationship";

/**
 * Keeps the coach flag and the current organization in step with the user's
 * memberships. Mount once per page (SiteHeader), never inside a menu that
 * unmounts when closed.
 */
export function useOrganizationSync() {
  const userId = useAuthStore((state) => state.userId);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const setIsACoach = useAuthStore((state) => state.setIsACoach);

  const { organizations, isLoading, isError } = useOrganizationList(userId);

  const {
    currentOrganizationId,
    lastOrganizationIdByUser,
    setCurrentOrganizationId,
    forgetOrganizationForUser,
  } = useCurrentOrganization();

  const { relationships } = useCoachingRelationshipList(currentOrganizationId ?? "");

  useEffect(() => {
    if (!userId || !relationships) {
      setIsACoach(false);
      return;
    }
    setIsACoach(isUserCoach(userId, relationships));
  }, [userId, relationships, setIsACoach]);

  // Note: the default-selection fallback can go away once a user has the notion
  //       of a default Organization and currentOrganizationId can start out
  //       equal to it.
  const membership = useMemo<OrganizationMembership>(
    () =>
      isLoggedIn && userId && !isLoading && !isError
        ? { kind: "loaded", organizations }
        : { kind: "unknown" },
    [isLoggedIn, userId, isLoading, isError, organizations]
  );

  useReconcileCurrentOrganization({
    membership,
    currentOrganizationId,
    setCurrentOrganizationId,
    userId,
    lastOrganizationIdByUser,
    forgetOrganizationForUser,
  });
}
