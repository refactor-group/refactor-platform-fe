"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, User, Calendar, Target } from "lucide-react";
import { DateTime } from "ts-luxon";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Pill, PillIndicator } from "@/components/kibo/ui/pill";
import { cn } from "@/components/lib/utils";
import { WhatsDueActionCard } from "./whats-due-action-card";
import type {
  RelationshipGroupedActions,
  GoalGroupedActions,
} from "@/types/assigned-actions";
import type { Id } from "@/types/general";
import { useAuthStore } from "@/lib/providers/auth-store-provider";

interface WhatsDueRelationshipGroupProps {
  group: RelationshipGroupedActions;
  onActionStatusChange: (actionId: Id, completed: boolean) => void;
  defaultExpanded?: boolean;
}

function formatNextSessionDate(sessionDate: DateTime): string {
  const now = DateTime.now();
  const diff = sessionDate.diff(now, "days").days;

  if (diff < 1) {
    return "Today";
  }

  if (diff < 2) {
    return "Tomorrow";
  }

  if (diff < 7) {
    return sessionDate.toFormat("EEEE"); // Day name
  }

  return sessionDate.toFormat("MMM d");
}

function GoalSection({
  goalGroup,
  onActionStatusChange,
}: {
  goalGroup: GoalGroupedActions;
  onActionStatusChange: (actionId: Id, completed: boolean) => void;
}) {
  const showGoalHeader = goalGroup.goal.title !== "No Goal";

  return (
    <div className="space-y-2">
      {showGoalHeader && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Target className="h-3 w-3" />
          <span className="font-medium">{goalGroup.goal.title}</span>
        </div>
      )}

      <div className="space-y-2">
        {goalGroup.actions.map((action) => (
          <WhatsDueActionCard
            key={action.action.id}
            action={action}
            onStatusChange={onActionStatusChange}
          />
        ))}
      </div>
    </div>
  );
}

export function WhatsDueRelationshipGroup({
  group,
  onActionStatusChange,
  defaultExpanded = false,
}: WhatsDueRelationshipGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  const userId = userSession?.id;

  // Determine if the user is the coach or coachee in this relationship
  const isCoach = userId === group.relationship.coachId;
  const otherPersonName = isCoach
    ? group.relationship.coacheeName
    : group.relationship.coachName;
  const roleLabel = isCoach ? "Coachee" : "Coach";

  const nextSessionText = group.nextSession
    ? formatNextSessionDate(group.nextSession.sessionDate)
    : "No upcoming session";

  return (
    <Card className="overflow-hidden">
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CardHeader className="p-4 pb-3">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full justify-between p-0 h-auto hover:bg-transparent"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div className="text-left">
                    <p className="font-semibold text-sm">{otherPersonName}</p>
                    <p className="text-xs text-muted-foreground">{roleLabel}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Action count with overdue indicator */}
                <Pill variant="secondary" className="text-xs">
                  {group.overdueCount > 0 && (
                    <PillIndicator variant="warning" />
                  )}
                  <span>
                    {group.totalActions}{" "}
                    {group.totalActions === 1 ? "action" : "actions"}
                  </span>
                </Pill>

                {/* Next session date */}
                <Pill variant="outline" className="text-xs">
                  <Calendar className="h-3 w-3" />
                  <span>{nextSessionText}</span>
                </Pill>

                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </Button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            <div
              className={cn(
                "space-y-4",
                group.goalGroups.length > 1 && "divide-y divide-border"
              )}
            >
              {group.goalGroups.map((goalGroup, index) => (
                <div
                  key={goalGroup.goal.overarchingGoalId || `no-goal-${index}`}
                  className={cn(index > 0 && "pt-4")}
                >
                  <GoalSection
                    goalGroup={goalGroup}
                    onActionStatusChange={onActionStatusChange}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
