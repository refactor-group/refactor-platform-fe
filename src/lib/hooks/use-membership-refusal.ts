"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { siteConfig } from "@/site.config";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCurrentUserRole } from "@/lib/hooks/use-current-user-role";
import { revalidateEndpointCaches } from "@/lib/hooks/use-sse-cache-invalidation";
import {
  membershipRefusalMessage,
  membershipRefusalOf,
  type RefusedWrite,
} from "@/lib/membership-refusal";
import { toast } from "@/lib/toast";
import type { Id } from "@/types/general";
import { None, type Option } from "@/types/option";
import { isAdminOrSuperAdmin } from "@/types/user";

/** Resolves the refused person's display name; the id is absent on older backends. */
export type RefusedNameOf = (userId: Option<Id>) => Option<string>;

/**
 * Announces a 409 refusing a write that involves someone no longer in the
 * organization. Returns false, untouched, for any other error.
 */
export function useMembershipRefusal(): (
  error: unknown,
  write: RefusedWrite,
  nameOf: RefusedNameOf
) => boolean {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const canAddBack = isAdminOrSuperAdmin(useCurrentUserRole());
  const { currentOrganizationId } = useCurrentOrganization();

  return useCallback(
    (error, write, nameOf) => {
      const refusal = membershipRefusalOf(error);
      if (refusal.none) return false;

      const orgId = refusal.val.organizationId.some ? refusal.val.organizationId.val : currentOrganizationId;
      const offerAddBack = canAddBack && Boolean(orgId);
      toast.error(membershipRefusalMessage(write, nameOf(refusal.val.userId), offerAddBack), {
        action: offerAddBack
          ? {
              label: "Add back",
              onClick: () => router.push(`/organizations/${orgId}/members?addMember=existing`),
            }
          : undefined,
      });

      // So the refused option disappears instead of being offered again.
      const base = siteConfig.env.backendServiceURL;
      void revalidateEndpointCaches(mutate, base, "/coaching_relationships");
      void revalidateEndpointCaches(mutate, base, "/coaching_sessions");
      return true;
    },
    [router, mutate, canAddBack, currentOrganizationId]
  );
}

export const unnamed: RefusedNameOf = () => None;
