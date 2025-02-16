"use client";

import React from "react";
import { format } from "date-fns";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";
import { useOverarchingGoalByCoachingSessionId } from "@/lib/api/overarching-goals";
import { Id } from "@/types/general";

interface CoachingSessionProps {
  coachingSession: {
    id: Id;
    date: string;
  };
}

const CoachingSession: React.FC<CoachingSessionProps> = ({
  coachingSession,
}) => {
  const { setCurrentCoachingSessionId } = useCoachingSessionStateStore(
    (state) => state
  );

  return (
    <Card>
      <CardHeader className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <OverarchingGoal coachingSessionId={coachingSession.id} />
            <div className="text-sm text-muted-foreground">
              {format(new Date(coachingSession.date), "MMMM d, yyyy h:mm a")}
            </div>
          </div>
          <Link href={`/coaching-sessions/${coachingSession.id}`} passHref>
            <Button
              size="sm"
              className="w-full sm:w-auto mt-2 sm:mt-0"
              onClick={() => setCurrentCoachingSessionId(coachingSession.id)}
            >
              Join Session
            </Button>
          </Link>
        </div>
      </CardHeader>
    </Card>
  );
};

interface OverarchingGoalProps {
  coachingSessionId: Id;
}

const OverarchingGoal: React.FC<OverarchingGoalProps> = ({
  coachingSessionId,
}) => {
  const {
    overarchingGoal,
    isLoading: isLoadingOverarchingGoal,
    isError: isErrorOverarchingGoal,
  } = useOverarchingGoalByCoachingSessionId(coachingSessionId);

  let titleText: string;

  if (isLoadingOverarchingGoal) {
    titleText = "Loading...";
  } else if (isErrorOverarchingGoal) {
    titleText = "Error loading Overarching Goal";
  } else {
    titleText = overarchingGoal?.title || "No goal set";
  }

  return <div>{titleText}</div>;
};

export default CoachingSession;
