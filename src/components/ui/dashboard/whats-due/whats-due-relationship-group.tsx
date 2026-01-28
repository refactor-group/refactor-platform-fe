"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, User, Calendar, Target } from "lucide-react";
import { DateTime } from "ts-luxon";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Pill, PillIndicator } from "@/components/kibo/ui/pill";
import { cn } from "@/components/lib/utils";
import { WhatsDueActionCard } from "./whats-due-action-card";
import {
  CoachViewMode,
  type RelationshipGroupedActions,
  type GoalGroupedActions,
} from "@/types/assigned-actions";
import type { Id } from "@/types/general";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useIsMobile } from "@/components/hooks/use-mobile";

interface WhatsDueRelationshipGroupProps {
  group: RelationshipGroupedActions;
  viewMode?: CoachViewMode;
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
  viewMode = CoachViewMode.MyActions,
  onActionStatusChange,
  defaultExpanded = false,
}: WhatsDueRelationshipGroupProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const isMobile = useIsMobile();

  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));

  const userId = userSession?.id;

  // Determine the other person in this coaching relationship
  const isCoach = userId === group.relationship.coachId;
  const otherPersonName = isCoach
    ? group.relationship.coacheeName
    : group.relationship.coachName;

  // Format the label based on view mode
  const relationshipLabel =
    viewMode === CoachViewMode.CoacheeActions
      ? `${group.relationship.coacheeName}'s Actions`
      : `My Actions with ${otherPersonName}`;

  const nextSessionText = group.nextSession
    ? formatNextSessionDate(group.nextSession.sessionDate)
    : "No upcoming session";

  const collapsibleContent = (
    <CollapsibleContent className={isMobile ? "" : "col-span-full"}>
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
  );

  // Mobile layout - simple flex with wrapping
  if (isMobile) {
    return (
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              className="w-full flex flex-wrap gap-2 p-4 h-auto hover:bg-muted/50 rounded-none items-center"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="font-semibold text-sm truncate">{relationshipLabel}</span>
              </div>
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              )}
              <div className="flex items-center gap-2 w-full">
                <Pill variant="secondary" className="text-xs">
                  {group.overdueCount > 0 && <PillIndicator variant="warning" />}
                  <span>
                    {group.totalActions} {group.totalActions === 1 ? "action" : "actions"}
                  </span>
                </Pill>
                <Pill variant="outline" className="text-xs">
                  <Calendar className="h-3 w-3" />
                  <span>{nextSessionText}</span>
                </Pill>
              </div>
            </Button>
          </CollapsibleTrigger>
          {collapsibleContent}
        </div>
      </Collapsible>
    );
  }

  // Desktop layout - CSS Grid with subgrid for aligned columns
  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="contents"
    >
      <div className="col-span-full grid grid-cols-subgrid rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="col-span-full grid grid-cols-subgrid p-4 h-auto hover:bg-muted/50 rounded-none items-center"
          >
            <div className="flex items-center gap-2 justify-start">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-sm">{relationshipLabel}</span>
            </div>
            <Pill variant="secondary" className="text-xs justify-center">
              {group.overdueCount > 0 && <PillIndicator variant="warning" />}
              <span>
                {group.totalActions} {group.totalActions === 1 ? "action" : "actions"}
              </span>
            </Pill>
            <Pill variant="outline" className="text-xs justify-center">
              <Calendar className="h-3 w-3" />
              <span>{nextSessionText}</span>
            </Pill>
            <div className="flex justify-end">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>
        {collapsibleContent}
      </div>
    </Collapsible>
  );
}
