"use client";

import React from "react";
import { format } from "date-fns";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useCoachingSessionStateStore } from "@/lib/providers/coaching-session-state-store-provider";
import { useOverarchingGoalBySession } from "@/lib/api/overarching-goals";
import { Id } from "@/types/general";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { CoachingSession as CoachingSessionType } from "@/types/coaching-session";
import { useAuthStore } from "@/lib/providers/auth-store-provider";

interface CoachingSessionProps {
  coachingSession: CoachingSessionType;
  onUpdate: () => void;
  onDelete: () => void;
}

const CoachingSession: React.FC<CoachingSessionProps> = ({
  coachingSession,
  onUpdate,
  onDelete,
}) => {
  const { setCurrentCoachingSessionId } = useCoachingSessionStateStore(
    (state) => state
  );
  const { isCoach } = useAuthStore((state) => state);

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
          <div className="flex items-center gap-2">
            <Link href={`/coaching-sessions/${coachingSession.id}`} passHref>
              <Button
                size="sm"
                className="w-full sm:w-auto mt-2 sm:mt-0 text-sm px-3 py-1"
                onClick={() => setCurrentCoachingSessionId(coachingSession.id)}
              >
                Join Session
              </Button>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onUpdate}>
                  Edit
                </DropdownMenuItem>
                {isCoach && (
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
  } = useOverarchingGoalBySession(coachingSessionId);

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

export { CoachingSession };
