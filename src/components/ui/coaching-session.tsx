"use client";

import React from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useOverarchingGoalBySession } from "@/lib/api/overarching-goals";
import { Id } from "@/types/general";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Share } from "lucide-react";
import { CoachingSession as CoachingSessionType } from "@/types/coaching-session";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { copyCoachingSessionLinkWithToast } from "@/components/ui/share-session-link";
import {
  formatDateInUserTimezoneWithTZ,
  getBrowserTimezone,
} from "@/lib/timezone-utils";

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
  const { isCurrentCoach, userSession } = useAuthStore((state) => state);

  const handleCopyLink = async () => {
    await copyCoachingSessionLinkWithToast(coachingSession.id);
  };

  return (
    <Card>
      <CardHeader className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <OverarchingGoal coachingSessionId={coachingSession.id} />
            <div className="text-sm text-muted-foreground">
              {formatDateInUserTimezoneWithTZ(
                coachingSession.date,
                userSession.timezone || getBrowserTimezone()
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/coaching-sessions/${coachingSession.id}`} passHref>
              <Button
                size="sm"
                className="w-full sm:w-auto mt-2 sm:mt-0 text-sm px-3 py-1"
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
                <DropdownMenuItem onClick={handleCopyLink}>
                  <Share className="mr-2 h-4 w-4" />
                  Copy link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onUpdate}>Edit</DropdownMenuItem>
                {isCurrentCoach && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={onDelete}
                      className="text-destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                  </>
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
