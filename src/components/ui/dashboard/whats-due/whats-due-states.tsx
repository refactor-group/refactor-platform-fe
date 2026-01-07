"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/components/lib/utils";
import { AssignedActionsFilter, CoachViewMode } from "@/types/assigned-actions";

interface StateProps {
  className?: string;
}

interface EmptyStateProps extends StateProps {
  filter: AssignedActionsFilter;
  viewMode?: CoachViewMode;
}

export function WhatsDueLoadingState({ className }: StateProps) {
  return (
    <div className={cn("flex items-center justify-center py-12", className)}>
      <Spinner />
    </div>
  );
}

export function WhatsDueErrorState({ className }: StateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      <AlertCircle className="h-8 w-8 text-destructive mb-2" />
      <p className="text-destructive">
        Failed to load actions. Please try again later.
      </p>
    </div>
  );
}

function getEmptyStateMessage(
  filter: AssignedActionsFilter,
  viewMode: CoachViewMode
): string {
  const isCoacheeView = viewMode === CoachViewMode.CoacheeActions;

  if (filter === AssignedActionsFilter.DueSoon) {
    return isCoacheeView
      ? "Your coachees have no actions due before their next sessions."
      : "No actions due before your next session. You're all caught up!";
  }

  if (filter === AssignedActionsFilter.AllUnassigned) {
    return isCoacheeView
      ? "Your coachees have no unassigned actions."
      : "No unassigned actions. All actions have owners!";
  }

  if (filter === AssignedActionsFilter.Completed) {
    return isCoacheeView
      ? "Your coachees have no recently completed actions."
      : "No actions completed since your last session.";
  }

  return isCoacheeView
    ? "Your coachees have no incomplete actions."
    : "No incomplete actions. Great work!";
}

export function WhatsDueEmptyState({
  filter,
  viewMode = CoachViewMode.MyActions,
  className,
}: EmptyStateProps) {
  const message = getEmptyStateMessage(filter, viewMode);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
      <p className="text-muted-foreground">{message}</p>
    </div>
  );
}
