"use client";

import { useEffect, useMemo } from "react";

import { useOrganizationList } from "@/lib/api/organizations";
import { organizationToSwitchTo } from "@/lib/coaching-session-organization";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import type { OrganizationMembership } from "@/lib/hooks/use-reconcile-current-organization";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import type { CoachingSession } from "@/types/coaching-session";
import { None, unwrapOr, type Option } from "@/types/option";

/**
 * Selects the organization owning the open session, so its relationship reads
 * resolve. Doesn't remember it, like the members route.
 */
export function useSyncOrganizationFromSession(session: Option<CoachingSession>): void {
  const userId = useAuthStore((state) => state.userId);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const { organizations, isLoading, isError } = useOrganizationList(userId);
  const { currentOrganizationId, setCurrentOrganizationId } = useCurrentOrganization();

  const membership = useMemo<OrganizationMembership>(
    () =>
      isLoggedIn && userId && !isLoading && !isError
        ? { kind: "loaded", organizations }
        : { kind: "unknown" },
    [isLoggedIn, userId, isLoading, isError, organizations]
  );

  const target = organizationToSwitchTo({
    sessionOrganizationId: session.some ? session.val.organization_id : None,
    currentOrganizationId,
    membership,
  });
  // Keyed on the id, not the Option, so a re-render doesn't select it again.
  const targetId = unwrapOr(target, "");

  useEffect(() => {
    if (targetId) setCurrentOrganizationId(targetId);
  }, [targetId, setCurrentOrganizationId]);
}
