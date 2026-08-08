"use client";

import { useEffect, useRef } from "react";
import type { Id } from "@/types/general";
import type { Organization } from "@/types/organization";

/**
 * The caller's membership as far as we can currently tell. Anything short of
 * `loaded` cannot distinguish a revoked organization from one that simply
 * hasn't been fetched, so the reconciler stays inert until then.
 */
export type OrganizationMembership =
  | { kind: "unknown" }
  | { kind: "loaded"; organizations: readonly Organization[] };

/**
 * Keeps the persisted `currentOrganizationId` consistent with the
 * organizations the caller is actually a member of.
 *
 * The selection lives in localStorage, so a membership revoked server-side
 * would otherwise survive re-renders, reloads and new browser sessions while
 * every organization-scoped read 403s against the dead id.
 *
 * A revoked id is reconciled at most once per mount. Other code deliberately
 * re-selects an organization (the members route syncs it from the URL), and
 * re-clearing that on every render would spin.
 */
export function useReconcileCurrentOrganization(
  membership: OrganizationMembership,
  currentOrganizationId: Id,
  setCurrentOrganizationId: (organizationId: Id) => void
): void {
  const reconciledIds = useRef<Set<Id>>(new Set());

  useEffect(() => {
    if (membership.kind !== "loaded") return;

    const { organizations } = membership;
    const fallbackId = organizations[0]?.id ?? "";

    if (!currentOrganizationId) {
      if (fallbackId) setCurrentOrganizationId(fallbackId);
      return;
    }

    const isStillAMember = organizations.some(
      (organization) => organization.id === currentOrganizationId
    );
    if (isStillAMember || reconciledIds.current.has(currentOrganizationId)) {
      return;
    }

    reconciledIds.current.add(currentOrganizationId);
    setCurrentOrganizationId(fallbackId);
  }, [membership, currentOrganizationId, setCurrentOrganizationId]);
}
