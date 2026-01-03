"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/components/lib/utils";
import { AssignedActionsFilter } from "@/types/assigned-actions";

interface StateProps {
  className?: string;
}

interface EmptyStateProps extends StateProps {
  filter: AssignedActionsFilter;
}

export function WhatsDueLoadingState({ className }: StateProps) {
  return (
    <div className={cn("flex items-center justify-center py-8", className)}>
      <Spinner />
    </div>
  );
}

export function WhatsDueErrorState({ className }: StateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-8 text-center",
        className
      )}
    >
      <AlertCircle className="h-8 w-8 text-destructive mb-2" />
      <p className="text-sm text-destructive">
        Failed to load actions. Please try again later.
      </p>
    </div>
  );
}

export function WhatsDueEmptyState({ filter, className }: EmptyStateProps) {
  const message =
    filter === AssignedActionsFilter.DueSoon
      ? "No actions due before your next session. You're all caught up!"
      : "No incomplete actions. Great work!";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-8 text-center",
        className
      )}
    >
      <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
