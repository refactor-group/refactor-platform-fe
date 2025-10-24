"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Share, User, Target, Calendar, Building } from "lucide-react";
import { copyCoachingSessionLinkWithToast } from "@/components/ui/share-session-link";
import { cn } from "@/components/lib/utils";

interface SessionUrgency {
  type: "imminent" | "soon" | "later" | "past";
  message: string;
}

interface MockSession {
  id: string;
  goalTitle: string;
  participantName: string;
  userRole: "Coach" | "Coachee";
  dateTime: string;
  organizationName: string;
  isPast: boolean;
  urgency: SessionUrgency;
}

interface TodaySessionCardProps {
  session: MockSession;
}

export function TodaySessionCard({ session }: TodaySessionCardProps) {
  const handleCopyLink = async () => {
    await copyCoachingSessionLinkWithToast(session.id);
  };

  const getUrgencyStyles = (urgencyType: SessionUrgency["type"]) => {
    switch (urgencyType) {
      case "imminent":
        return "bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800";
      case "soon":
        return "bg-blue-50 dark:bg-blue-950/20 text-blue-900 dark:text-blue-100 border-blue-200 dark:border-blue-800";
      case "later":
        return "bg-slate-50 dark:bg-slate-950/20 text-slate-900 dark:text-slate-100 border-slate-200 dark:border-slate-800";
      case "past":
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <Card className="border-border shadow-sm">
      {/* Status Indicator Section */}
      <div
        className={cn(
          "px-4 py-2 rounded-t-xl border-b flex items-center justify-between bg-sidebar",
          getUrgencyStyles(session.urgency.type)
        )}
      >
        <span className="text-sm font-medium">{session.urgency.message}</span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-background/50">
            {session.dateTime.split(" at ")[1]}
          </Badge>
          <div className="h-4 w-px bg-current opacity-30" />
          <Button variant="ghost" size="icon" className="h-7 w-7 -mr-1" onClick={handleCopyLink}>
            <Share className="h-4 w-4" />
            <span className="sr-only">Copy session link</span>
          </Button>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-6 space-y-4">
        {/* Session Title */}
        <h3 className="text-2xl font-bold tracking-tight text-foreground">
          {session.goalTitle}
        </h3>

        {/* Session Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>
              Meeting with: <span className="font-medium">{session.participantName}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Target className="h-4 w-4" />
            <span>
              Your role: <span className="font-medium">{session.userRole}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span className="font-medium">{session.dateTime}</span>
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
