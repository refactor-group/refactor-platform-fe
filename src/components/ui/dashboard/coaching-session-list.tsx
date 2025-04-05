"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpDown } from "lucide-react";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import { useCoachingSessionList } from "@/lib/api/coaching-sessions";
import { useCoachingSessionMutation } from "@/lib/api/coaching-sessions";
import { CoachingSession as CoachingSessionComponent } from "@/components/ui/coaching-session";
import { DateTime } from "ts-luxon";
import {
  filterAndSortCoachingSessions,
  type CoachingSession,
} from "@/types/coaching-session";
import { Id, SortOrder } from "@/types/general";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface CoachingSessionListProps {
  onUpdateSession: (session: CoachingSession) => void;
}

export default function CoachingSessionList({
  onUpdateSession,
}: CoachingSessionListProps) {
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

  // const [sortByDate, setSortByDate] = useState(true);

  const upcomingSessions = coachingSessions
    ? filterAndSortCoachingSessions(coachingSessions, SortOrder.Ascending, true)
    : [];

  const previousSessions = coachingSessions
    ? filterAndSortCoachingSessions(
        coachingSessions,
        SortOrder.Descending,
        false
      )
    : [];

  if (isLoadingCoachingSessions) return <div>Loading coaching sessions...</div>;
  if (isErrorCoachingSessions)
    return <div>Error loading coaching sessions</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Coaching Sessions</CardTitle>
      </CardHeader>
      <CardContent>
        {!currentCoachingRelationshipId ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-lg text-muted-foreground">
              Choose a Relationship to view Coaching Sessions
            </p>
          </div>
        ) : (
          <Tabs defaultValue="upcoming" className="w-full items-start">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="previous">Previous</TabsTrigger>
            </TabsList>
            <TabsContent value="upcoming" className="mt-4">
              {/* <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
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
              </div> */}
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
            </TabsContent>
            <TabsContent value="previous" className="mt-4">
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
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
  // return (
  //   <Card className="flex-1">
  //     <CardHeader className="space-y-4">
  //       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
  //         <CardTitle className="text-xl sm:text-2xl">
  //           Coaching Sessions
  //         </CardTitle>
  //       </div>
  //       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
  //         <Button
  //           variant="ghost"
  //           size="sm"
  //           className="text-muted-foreground w-full sm:w-auto justify-between"
  //           onClick={() => setSortByDate(true)}
  //         >
  //           <span>Date and Time</span>
  //           <ArrowUpDown className="ml-2 h-4 w-4" />
  //         </Button>
  //         <Button
  //           variant="ghost"
  //           size="sm"
  //           className="text-muted-foreground w-full sm:w-auto justify-between"
  //           onClick={() => setSortByDate(false)}
  //         >
  //           <span>Overarching Goal</span>
  //           <ArrowUpDown className="ml-2 h-4 w-4" />
  //         </Button>
  //       </div>
  //     </CardHeader>
  //     <CardContent>
  //       {!currentCoachingRelationshipId ? (
  //         <div className="flex items-center justify-center py-8">
  //           <p className="text-lg text-muted-foreground">
  //             Choose a Relationship to view Coaching Sessions
  //           </p>
  //         </div>
  //       ) : (
  //         <div className="space-y-4">
  //           {sortedSessions.map((coachingSession) => (
  //             <CoachingSessionComponent
  //               key={coachingSession.id}
  //               coachingSession={coachingSession}
  //               onUpdate={() => onUpdateSession(coachingSession)}
  //               onDelete={() => handleDeleteCoachingSession(coachingSession.id)}
  //             />
  //           ))}
  //         </div>
  //       )}
  //     </CardContent>
  //   </Card>
  // );
}
