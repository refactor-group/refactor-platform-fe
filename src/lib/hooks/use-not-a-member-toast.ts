"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import { siteConfig } from "@/site.config";
import { AddBackPurpose, notAMemberMessage } from "@/lib/api/membership-errors";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { revalidateEndpointCaches } from "@/lib/hooks/use-sse-cache-invalidation";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { toast } from "@/lib/toast";
import type { NameLookup, NotAMemberRefusal } from "@/types/membership";
import { getUserRoleForOrganization, isAdminRole } from "@/types/user";

export type ShowNotAMember = (
  refusal: NotAMemberRefusal,
  purpose: AddBackPurpose,
  nameOf: NameLookup
) => void;

/**
 * Explains a write refused because someone is no longer a member: names them,
 * offers admins Add back, and refreshes so the refused option isn't offered again.
 */
export function useNotAMemberToast(): ShowNotAMember {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const roles = useAuthStore((s) => s.userSession.roles);
  const { currentOrganizationId } = useCurrentOrganization();

  return useCallback(
    (refusal, purpose, nameOf) => {
      // The refusal may come from another organization than the one being viewed.
      const orgId = refusal.organizationId.some ? refusal.organizationId.val : currentOrganizationId;
      const canAddBack = Boolean(orgId) && isAdminRole(getUserRoleForOrganization(roles, orgId));
      toast.error(notAMemberMessage(purpose, nameOf(refusal.userId), canAddBack), {
        action: canAddBack
          ? {
              label: "Add back",
              onClick: () => router.push(`/organizations/${orgId}/members?addMember=existing`),
            }
          : undefined,
      });

      const base = siteConfig.env.backendServiceURL;
      void revalidateEndpointCaches(mutate, base, "/coaching_relationships");
      void revalidateEndpointCaches(mutate, base, "/coaching_sessions");
    },
    [router, mutate, roles, currentOrganizationId]
  );
}
