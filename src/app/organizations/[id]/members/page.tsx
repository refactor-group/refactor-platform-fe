"use client";

import { use, useEffect, useState } from "react";
import { useWasEverTrue } from "@/lib/hooks/use-was-ever-true";
import { useSearchParams, notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useUserList } from "@/lib/api/organizations/users";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCurrentUserRole } from "@/lib/hooks/use-current-user-role";
import { Id, isForbiddenError, viewPermissionDeniedMessage } from "@/types/general";
import { ForbiddenError } from "@/components/ui/errors/forbidden-error";
import { MemberContainer } from "@/components/ui/members/member-container";
import { PageContainer } from "@/components/ui/page-container";
import { shouldDenyMembersPageAccess } from "./access-control";
import { siteConfig } from "@/site.config";

export default function MembersPage({
  params,
}: {
  params: Promise<{ id: Id }>;
}) {
  const searchParams = useSearchParams();
  const [openAddMemberDialog] = useState(
    searchParams.get("addMember") === "true"
  );

  const organizationId = use(params).id;
  const { currentOrganizationId, setCurrentOrganizationId } = useCurrentOrganization();
  const currentUserRoleState = useCurrentUserRole();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  // Was this mount ever authenticated? Narrows the sign-out bypass below to a
  // real logout transition, so a visitor who was never logged in still hits
  // the normal deny path instead of the page rendering for them too. Signing
  // out triggers several re-renders while isLoggedIn stays false (org state,
  // coaching relationship state, etc. each reset separately) -- this must
  // stay true across all of them, not just the first.
  const wasLoggedIn = useWasEverTrue(isLoggedIn);

  useEffect(() => {
    // Once signed out there is nothing to sync, and resetOrganizationState()
    // (run during logout teardown) intentionally clears this value -- syncing
    // here would immediately write the outgoing user's org back into the
    // persisted store.
    if (!isLoggedIn) return;
    // Only sync if different to prevent conflicts with OrganizationSwitcher
    if (currentOrganizationId !== organizationId) {
      setCurrentOrganizationId(organizationId);
    }
  }, [organizationId, currentOrganizationId, setCurrentOrganizationId, isLoggedIn]);

  if (shouldDenyMembersPageAccess(
      currentOrganizationId,
      organizationId,
      currentUserRoleState,
      isLoggedIn,
      wasLoggedIn
    )) {
    notFound();
  }

  const {
    relationships,
    isLoading: isRelationshipsLoading,
    isError: isRelationshipsError,
    refresh: refreshRelationships,
  } = useCoachingRelationshipList(organizationId);
  const {
    users,
    isLoading: isUsersLoading,
    isError: isUsersError,
    refresh: refreshUsers,
  } = useUserList(organizationId);
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  const handleRefresh = () => {
    refreshRelationships();
    refreshUsers();
  };

  // Signing out: EntityApi.useClearCache() deletes cache entries directly on
  // the SWR Map without notifying subscribers, so `users`/`relationships`
  // above can still be the outgoing user's data for the rest of this render
  // window. Render nothing rather than flash their roster on the way out.
  if (!isLoggedIn) {
    return null;
  }

  if (isForbiddenError(isRelationshipsError) || isForbiddenError(isUsersError)) {
    return (
      <ForbiddenError
        title="Members Access Denied"
        message={viewPermissionDeniedMessage("this organization's members")}
      />
    );
  }

  if (isRelationshipsError || isUsersError) {
    return (
      <div className="container mx-auto p-4">
        <Card className="w-full">
          <CardContent className="p-6">
            <div className="text-center text-red-500">
              Error loading members
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageContainer>
      <MemberContainer
        users={users}
        relationships={relationships}
        userSession={userSession}
        onRefresh={handleRefresh}
        isLoading={isRelationshipsLoading || isUsersLoading}
        openAddMemberDialog={openAddMemberDialog}
        productName={siteConfig.name}
      />
    </PageContainer>
  );
}
