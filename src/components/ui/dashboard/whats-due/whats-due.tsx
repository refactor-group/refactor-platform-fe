"use client";

import { useState } from "react";
import { DateTime } from "ts-luxon";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/kibo/ui/pill";
import { cn } from "@/components/lib/utils";
import { useAssignedActions } from "@/lib/hooks/use-assigned-actions";
import { useActionMutation } from "@/lib/api/actions";
import { AssignedActionsFilter } from "@/types/assigned-actions";
import { ItemStatus, type Id } from "@/types/general";
import type { Action } from "@/types/action";
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

  const {
    groupedActions,
    flatActions,
    totalCount,
    overdueCount,
    isLoading,
    isError,
    refresh,
  } = useAssignedActions(filter);

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
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
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

          <WhatsDueFilter value={filter} onChange={setFilter} />
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {isLoading && <WhatsDueLoadingState />}

        {isError && <WhatsDueErrorState />}

        {!isLoading && !isError && groupedActions.length === 0 && (
          <WhatsDueEmptyState filter={filter} />
        )}

        {!isLoading && !isError && groupedActions.length > 0 && (
          <div className="space-y-3">
            {groupedActions.map((group) => (
              <WhatsDueRelationshipGroup
                key={group.relationship.coachingRelationshipId}
                group={group}
                onActionStatusChange={handleActionStatusChange}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
