"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Share, User, Target, Calendar, Building } from "lucide-react";
import { copyCoachingSessionLinkWithToast } from "@/components/ui/share-session-link";
import { cn } from "@/components/lib/utils";
import {
  EnrichedSessionDisplay,
  SessionUrgency,
} from "@/types/session-display";
import { useOverarchingGoalBySession } from "@/lib/api/overarching-goals";

interface TodaySessionCardProps {
  session: EnrichedSessionDisplay;
  sessionIndex?: number;
  totalSessions?: number;
}

export function TodaySessionCard({
  session,
  sessionIndex,
  totalSessions
}: TodaySessionCardProps) {
  const {
    overarchingGoal,
    isLoading: isLoadingGoal,
    isError: isErrorGoal,
  } = useOverarchingGoalBySession(session.id);

  const handleCopyLink = async () => {
    await copyCoachingSessionLinkWithToast(session.id);
  };

  let goalText: string;
  if (isLoadingGoal) {
    goalText = "Loading goal...";
  } else if (isErrorGoal) {
    goalText = "Error loading goal";
  } else {
    goalText = overarchingGoal?.title || "No goal set";
  }

  const getUrgencyStyles = (urgencyType: SessionUrgency) => {
    switch (urgencyType) {
      case SessionUrgency.Imminent:
        return "bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800";
      case SessionUrgency.Soon:
        return "bg-blue-50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800";
      case SessionUrgency.Later:
        return "bg-slate-50 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800";
      case SessionUrgency.Past:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <Card className="border-border shadow-sm">
      {/* Status Indicator Section */}
      <div
        className={cn(
          "px-4 py-1 rounded-t-xl border-b flex items-center justify-between bg-sidebar",
          getUrgencyStyles(session.urgency.type)
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{session.urgency.message}</span>
          {sessionIndex !== undefined && totalSessions !== undefined && (
            <span className="text-xs opacity-70">
              ({sessionIndex} / {totalSessions} today)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-background/50">
            {session.dateTime.split(" at ")[1]}
          </Badge>
          <div className="h-4 w-px bg-current opacity-30" />
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mr-1"
            onClick={handleCopyLink}
          >
            <Share className="h-3.5 w-3.5" />
            <span className="sr-only">Copy session link</span>
          </Button>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6 space-y-4">
        {/* Session Title */}
        <div className="space-y-1">
          <h3 className="text-xl font-bold tracking-tight text-foreground">
            Coaching Session
          </h3>
          <p
            className="text-sm text-muted-foreground truncate"
            title={goalText}
          >
            Goal: {goalText}
          </p>
        </div>

        {/* Session Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>
              Meeting with:{" "}
              <span className="font-medium">{session.participantName}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4" />
            <span>
              Your role: <span className="font-medium">{session.userRole}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Building className="h-4 w-4" />
            <span className="font-medium">{session.organizationName}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border my-4" />

        {/* Action Buttons */}
        <div className="flex gap-2 items-center">
          <Link href={`/coaching-sessions/${session.id}`}>
            <Button size="default">
              {session.isPast ? "View Session" : "Join Session"}
            </Button>
          </Link>

          <Button variant="outline" size="default" onClick={() => {}}>
            Reschedule
          </Button>
        </div>
      </div>
    </Card>
  );
}
