"use client";

import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useUserList } from "@/lib/api/organizations/users";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { Id } from "@/types/general";
import { MemberContainer } from "@/components/ui/members/member-container";

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
  const setCurrentOrganizationId = useOrganizationStateStore(
    (state) => state.setCurrentOrganizationId
  );

  useEffect(() => {
    setCurrentOrganizationId(organizationId);
  }, [organizationId, setCurrentOrganizationId]);

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
    <div className="container mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">Members</h1>
      <MemberContainer
        users={users}
        relationships={relationships}
        userSession={userSession}
        onRefresh={handleRefresh}
        isLoading={isRelationshipsLoading || isUsersLoading}
        openAddMemberDialog={openAddMemberDialog}
      />
    </div>
  );
}
