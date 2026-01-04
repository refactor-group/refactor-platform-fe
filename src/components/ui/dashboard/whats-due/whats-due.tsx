"use client";

import { useState } from "react";
import { DateTime } from "ts-luxon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/kibo/ui/pill";
import { cn } from "@/components/lib/utils";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useRelationshipRoles } from "@/lib/api/relationship-roles";
import { useAssignedActions } from "@/lib/hooks/use-assigned-actions";
import { useCoacheeAssignedActions } from "@/lib/hooks/use-coachee-assigned-actions";
import { useActionMutation } from "@/lib/api/actions";
import { AssignedActionsFilter, CoachViewMode } from "@/types/assigned-actions";
import { ItemStatus, type Id } from "@/types/general";
import type { Action } from "@/types/action";
import { WhatsDueCoachToggle } from "./whats-due-coach-toggle";
import { WhatsDueFilter } from "./whats-due-filter";
import { WhatsDueRelationshipGroup } from "./whats-due-relationship-group";
import {
  WhatsDueLoadingState,
  WhatsDueErrorState,
  WhatsDueEmptyState,
} from "./whats-due-states";

interface WhatsDueProps {
  className?: string;
}

export function WhatsDue({ className }: WhatsDueProps) {
  const [filter, setFilter] = useState<AssignedActionsFilter>(
    AssignedActionsFilter.DueSoon
  );
  const [coachViewMode, setCoachViewMode] = useState<CoachViewMode>(
    CoachViewMode.MyActions
  );

  const { userSession } = useAuthStore((state) => ({
    userSession: state.userSession,
  }));
  const { isCoach } = useRelationshipRoles(userSession?.id ?? null);

  // Fetch actions based on view mode
  // Only fetch coachee actions when user is a coach AND has selected that view
  const shouldFetchCoacheeActions = isCoach && coachViewMode === CoachViewMode.CoacheeActions;
  const myActions = useAssignedActions(filter);
  const coacheeActions = useCoacheeAssignedActions(filter, shouldFetchCoacheeActions);

  // Select which data to display based on view mode
  const {
    groupedActions,
    flatActions,
    totalCount,
    overdueCount,
    isLoading,
    isError,
    refresh,
  } = coachViewMode === CoachViewMode.MyActions ? myActions : coacheeActions;

  const { update: updateAction } = useActionMutation();

  const handleActionStatusChange = async (
    actionId: Id,
    completed: boolean
  ) => {
    const actionWithContext = flatActions.find((a) => a.action.id === actionId);
    if (!actionWithContext) return;

    const action = actionWithContext.action;
    const newStatus = completed ? ItemStatus.Completed : ItemStatus.NotStarted;

    const updatedAction: Action = {
      ...action,
      status: newStatus,
      status_changed_at: DateTime.now(),
    };

    await updateAction(actionId, updatedAction);
    refresh();
  };

  return (
    <Card className={cn("h-[30rem] flex flex-col", className)}>
      <CardHeader className="pb-3 space-y-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <CardTitle className="text-lg font-semibold">
            What&apos;s Due
          </CardTitle>
          {totalCount > 0 && (
            <Pill variant="secondary" className="text-xs">
              {totalCount}
            </Pill>
          )}
          {overdueCount > 0 && (
            <Pill variant="destructive" className="text-xs">
              {overdueCount} overdue
            </Pill>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {isCoach && (
            <WhatsDueCoachToggle
              value={coachViewMode}
              onChange={setCoachViewMode}
            />
          )}
          <WhatsDueFilter value={filter} onChange={setFilter} />
        </div>
      </CardHeader>

      <CardContent className="pt-0 flex-1 flex flex-col min-h-0">
        {isLoading && <WhatsDueLoadingState />}

        {isError && <WhatsDueErrorState />}

        {!isLoading && !isError && groupedActions.length === 0 && (
          <WhatsDueEmptyState filter={filter} viewMode={coachViewMode} />
        )}

        {!isLoading && !isError && groupedActions.length > 0 && (
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="space-y-3">
              {groupedActions.map((group) => (
                <WhatsDueRelationshipGroup
                  key={group.relationship.coachingRelationshipId}
                  group={group}
                  onActionStatusChange={handleActionStatusChange}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
