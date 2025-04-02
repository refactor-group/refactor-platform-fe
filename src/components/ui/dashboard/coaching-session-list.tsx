"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown } from "lucide-react";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import { useCoachingSessionList } from "@/lib/api/coaching-sessions";
import { CoachingSession as CoachingSessionComponent } from "@/components/ui/coaching-session";
import { DateTime } from "ts-luxon";
import { CoachingSessionDialog } from "./coaching-session-dialog";

export default function CoachingSessionList() {
  const { currentCoachingRelationshipId } = useCoachingRelationshipStateStore(
    (state) => state
  );
  // TODO: for now we hardcode a 2 month window centered around now,
  // eventually we want to make this be configurable somewhere
  // (either on the page or elsewhere)
  const fromDate = DateTime.now().minus({ month: 1 });
  const toDate = DateTime.now().plus({ month: 1 });
  const {
    coachingSessions,
    isLoading: isLoadingCoachingSessions,
    isError: isErrorCoachingSessions,
    refresh,
  } = useCoachingSessionList(currentCoachingRelationshipId, fromDate, toDate);

  const [sortByDate, setSortByDate] = useState(true);
  const [open, setOpen] = useState(false);
  const { isCoach } = useAuthStore((state) => state);

  const sortedSessions = coachingSessions
    ? [...coachingSessions].sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      })
    : [];

  const onCoachingSessionAdded = () => {
    // SWR refresh
    refresh();
    setOpen(false);
  };

  if (isLoadingCoachingSessions) return <div>Loading coaching sessions...</div>;
  if (isErrorCoachingSessions)
    return <div>Error loading coaching sessions</div>;

  return (
    <Card className="flex-1">
      <CardHeader className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-xl sm:text-2xl">
            Coaching Sessions
          </CardTitle>
          <CoachingSessionDialog
            mode="create"
            open={open}
            onOpenChange={setOpen}
            onCoachingSessionUpdated={onCoachingSessionAdded}
            dialogTrigger={
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                disabled={!isCoach || !currentCoachingRelationshipId}
              >
                Create New Coaching Session
              </Button>
            }
          />
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground w-full sm:w-auto justify-between"
            onClick={() => setSortByDate(true)}
          >
            <span>Date and Time</span>
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground w-full sm:w-auto justify-between"
            onClick={() => setSortByDate(false)}
          >
            <span>Overarching Goal</span>
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!currentCoachingRelationshipId ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-lg text-muted-foreground">
              Choose a Relationship to view Coaching Sessions
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedSessions.map((coachingSession) => (
              <CoachingSessionComponent
                key={coachingSession.id}
                coachingSession={coachingSession}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
