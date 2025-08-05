"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useCoachingSessionList } from "@/lib/api/coaching-sessions";
import { useCoachingSessionMutation } from "@/lib/api/coaching-sessions";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { CoachingSession as CoachingSessionComponent } from "@/components/ui/coaching-session";
import { DateTime } from "ts-luxon";
import { useMemo } from "react";
import {
  filterAndSortCoachingSessions,
  type CoachingSession,
} from "@/types/coaching-session";
import { Id } from "@/types/general";
import { SortOrder } from "@/types/sorting";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CoachingRelationshipSelector from "../coaching-relationship-selector";
import { cn } from "@/components/lib/utils";

interface CoachingSessionListProps {
  className?: string;
  onUpdateSession: (session: CoachingSession) => void;
}

export default function CoachingSessionList({
  className,
  onUpdateSession,
}: CoachingSessionListProps) {
  const { currentOrganizationId } = useCurrentOrganization();
  const { currentCoachingRelationshipId } = useCurrentCoachingRelationship();
  const { relationships } = useCoachingRelationshipList(currentOrganizationId || "");
  // TODO: for now we hardcode a 2 month window centered around now,
  // eventually we want to make this be configurable somewhere
  // (either on the page or elsewhere)
  const fromDate = DateTime.now().minus({ month: 1 });
  const toDate = DateTime.now().plus({ month: 1 });
  const {
    coachingSessions,
    isLoading: isLoadingCoachingSessions,
    isError: isErrorCoachingSessions,
    refresh: refreshCoachingSessions,
  } = useCoachingSessionList(currentCoachingRelationshipId, fromDate, toDate);

  const { delete: deleteCoachingSession } = useCoachingSessionMutation();

  const handleDeleteCoachingSession = async (id: Id) => {
    if (!confirm("Are you sure you want to delete this session?")) {
      return;
    }

    try {
      await deleteCoachingSession(id).then(() => refreshCoachingSessions());
    } catch (error) {
      console.error("Error deleting coaching session:", error);
      // TODO: Show an error toast here once we start using toasts for showing operation results.
    }
  };

  const upcomingSessions = coachingSessions
    ? filterAndSortCoachingSessions(coachingSessions, SortOrder.Asc, true)
    : [];

  const previousSessions = coachingSessions
    ? filterAndSortCoachingSessions(
        coachingSessions,
        SortOrder.Desc,
        false
      )
    : [];

  // Hide the selector if there's only one coaching relationship (but still render it for auto-selection)
  const shouldHideSelector = useMemo(() => 
    relationships?.length === 1, [relationships?.length]
  );

  let loadingCoachingSessions = (
    <div className="flex items-center justify-center py-8">
      <p className="text-lg text-muted-foreground">
        Loading your coaching sessions...
      </p>
    </div>
  );

  let noCoachingSessions = (
    <div className="flex items-center justify-center py-8">
      <p className="text-lg text-muted-foreground">
        Select a coaching relationship to view your coaching sessions.
      </p>
    </div>
  );

  let errorLoadingCoachingSessions = (
    <div className="flex items-center justify-center py-8">
      <p className="text-lg font-bold">
        There was an error trying to load your coaching sessions.
      </p>
    </div>
  );

  return (
    <Card className={cn("min-w-64", className)}>
      <CardHeader>
        <CardTitle>
          <div className="flex justify-between flex-col lg:flex-row">
            <div>Coaching Sessions</div>
            <CoachingRelationshipSelector
              className={`pt-4 lg:min-w-64 ${shouldHideSelector ? 'hidden' : ''}`}
              organizationId={currentOrganizationId}
              disabled={!currentOrganizationId}
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upcoming" className="w-full items-start">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="previous">Previous</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="mt-4">
            {isLoadingCoachingSessions ? (
              loadingCoachingSessions
            ) : isErrorCoachingSessions ? (
              errorLoadingCoachingSessions
            ) : !currentCoachingRelationshipId ? (
              noCoachingSessions
            ) : (
              <div className="space-y-4">
                {upcomingSessions.map((coachingSession) => (
                  <CoachingSessionComponent
                    key={coachingSession.id}
                    coachingSession={coachingSession}
                    onUpdate={() => onUpdateSession(coachingSession)}
                    onDelete={() =>
                      handleDeleteCoachingSession(coachingSession.id)
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="previous" className="mt-4">
            {isLoadingCoachingSessions ? (
              loadingCoachingSessions
            ) : isErrorCoachingSessions ? (
              errorLoadingCoachingSessions
            ) : !currentCoachingRelationshipId ? (
              noCoachingSessions
            ) : (
              <div className="space-y-4">
                {previousSessions.map((coachingSession) => (
                  <CoachingSessionComponent
                    key={coachingSession.id}
                    coachingSession={coachingSession}
                    onUpdate={() => onUpdateSession(coachingSession)}
                    onDelete={() =>
                      handleDeleteCoachingSession(coachingSession.id)
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
