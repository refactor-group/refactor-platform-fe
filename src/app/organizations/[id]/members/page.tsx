"use client";

import { use, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { MemberList } from "@/components/ui/members/member-list";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useUserList } from "@/lib/api/organizations/users";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";

export default function MembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
  } = useCoachingRelationshipList(organizationId);
  const {
    entities: users,
    isLoading: isUsersLoading,
    isError: isUsersError,
  } = useUserList(organizationId);
  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  // Find relationships where current user is either coach or coachee
  const userRelationships = relationships.filter(
    (rel) =>
      rel.coach_id === userSession.id || rel.coachee_id === userSession.id
  );

  // Get IDs of users in these relationships
  const associatedUserIds = new Set(
    userRelationships.flatMap((rel) => [rel.coach_id, rel.coachee_id])
  );

  // Filter users to only include those in the relationships
  const associatedUsers = users.filter((user) =>
    associatedUserIds.has(user.id)
  );

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
      <h1 className="text-3xl font-bold">Member Management</h1>

      {isRelationshipsLoading || isUsersLoading ? (
        <div className="py-4 text-center text-muted-foreground">Loading...</div>
      ) : (
        <MemberList users={associatedUsers} />
      )}
    </div>
  );
}
