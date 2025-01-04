"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import Link from "next/link";
import OrganizationSelector from "../organization-selector";
import CoachingRelationshipSelector from "../coaching-relationship-selector";
import CoachingSessionSelector from "../coaching-session-selector";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";

export default function SelectCoachingSession() {
  const { userId } = useAuthStore((state) => state);
  const { currentOrganizationId } = useOrganizationStateStore((state) => state);

  const { currentCoachingRelationshipId } = useCoachingRelationshipStateStore(
    (state) => state
  );
  const { currentCoachingSessionId } = useCoachingSessionStateStore(
    (state) => state
  );

  return (
    <Card className="w-full min-w-0 sm:min-w-[320]">
      <CardHeader>
        <CardTitle>Join a Coaching Session</CardTitle>
        <CardDescription>
          Select current organization, relationship and session
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 min-w-0">
        <div className="grid gap-2">
          <Label htmlFor="organization">Organization</Label>
          <OrganizationSelector userId={userId}></OrganizationSelector>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="relationship">Relationship</Label>
          <CoachingRelationshipSelector
            organizationId={currentOrganizationId}
            disabled={!currentOrganizationId}
          ></CoachingRelationshipSelector>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="relationship">Coaching Session</Label>
          <CoachingSessionSelector
            relationshipId={currentCoachingRelationshipId}
            disabled={!currentCoachingRelationshipId}
          ></CoachingSessionSelector>
        </div>
      </CardContent>
      <CardFooter>
        {currentCoachingSessionId ? (
          <Link
            className="w-full"
            href={`/coaching-sessions/${currentCoachingSessionId}`}
          >
            <Button variant="outline" className="w-full">
              Join Session
            </Button>
          </Link>
        ) : (
          <Button variant="outline" className="w-full" disabled>
            Join Session
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
