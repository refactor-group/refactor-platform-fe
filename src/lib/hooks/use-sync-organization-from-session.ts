"use client";

import { useEffect, useMemo, useRef } from "react";

import { useOrganizationList } from "@/lib/api/organizations";
import { organizationToSwitchTo } from "@/lib/coaching-session-organization";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import type { OrganizationMembership } from "@/lib/hooks/use-reconcile-current-organization";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import type { CoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";

/**
 * Selects the organization owning the open session, so its relationship reads
 * resolve. Doesn't remember it, like the members route. Decides once per session,
 * so a later switch from the user menu sticks.
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

  // Some once there's a session and memberships to decide it against.
  const decision: Option<{ sessionId: Id; target: Option<Id> }> =
    membership.kind === "loaded" && session.some
      ? Some({
          sessionId: session.val.id,
          target: organizationToSwitchTo({
            sessionOrganizationId: session.val.organization_id,
            currentOrganizationId,
            membership,
          }),
        })
      : None;
  const decidedFor = useRef<Option<Id>>(None);

  // Runs after every render; decidedFor makes it act once per session.
  useEffect(() => {
    if (decision.none) return;
    const { sessionId, target } = decision.val;
    if (decidedFor.current.some && decidedFor.current.val === sessionId) return;
    decidedFor.current = Some(sessionId);
    if (target.some) setCurrentOrganizationId(target.val);
  });
}
