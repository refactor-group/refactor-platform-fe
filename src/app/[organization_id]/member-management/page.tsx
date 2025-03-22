"use client";

import { use, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { AddMemberDialog } from "@/components/ui/member-management/add-member-dialog";
import { AddMemberButton } from "@/components/ui/member-management/add-member-button";
import { MemberList } from "@/components/ui/member-management/member-list";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship_with_user_names";
import { MemberCard } from "@/components/ui/member-management/member-card";

export default function MemberManagementPage({
  params,
}: {
  params: Promise<{ organization_id: string }>;
}) {
  const organizationId = use(params).organization_id;
  const { relationships, isLoading, isError } =
    useCoachingRelationshipList(organizationId);
  const { user } = useAuthStore((state) => ({
    user: state.user,
  }));
  const [coaches, setCoaches] = useState<CoachingRelationshipWithUserNames[]>(
    []
  );
  const [coachees, setCoachees] = useState<CoachingRelationshipWithUserNames[]>(
    []
  );

  useEffect(() => {
    if (!relationships.length || !user?.id) return;

    // Partition relationships into coaches and coachees
    const coachRelationships = relationships.filter(
      (rel) => rel.coach_id === user.id
    );
    const coacheeRelationships = relationships.filter(
      (rel) => rel.coachee_id === user.id
    );

    setCoaches(coachRelationships);
    setCoachees(coacheeRelationships);
  }, [relationships, user]);

  if (isError) {
    return (
      <div className="container mx-auto p-4">
        <Card className="w-full">
          <CardContent className="p-6">
            <div className="text-center text-red-500">
              Error loading coaching members
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">Member Management</h1>

      {/* Coaches Section */}
      {isLoading ? (
        <div className="py-4 text-center text-muted-foreground">Loading...</div>
      ) : (
        coaches.length > 0 && (
          <MemberList memberType="coach" relationships={coaches} />
        )
      )}

      {/* Coachees Section */}
      {isLoading ? (
        <div className="py-4 text-center text-muted-foreground">Loading...</div>
      ) : (
        <MemberList memberType="coachee" relationships={coachees} />
      )}
    </div>
  );
}
