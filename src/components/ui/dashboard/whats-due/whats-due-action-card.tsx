"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Calendar } from "lucide-react";
import { DateTime } from "ts-luxon";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Pill, PillIndicator } from "@/components/kibo/ui/pill";
import { cn } from "@/components/lib/utils";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import { ItemStatus, type Id } from "@/types/general";

interface WhatsDueActionCardProps {
  action: AssignedActionWithContext;
  onStatusChange: (actionId: Id, completed: boolean) => void;
}

function formatDueDate(dueBy: DateTime): string {
  const now = DateTime.now();
  const diff = dueBy.diff(now, "days").days;

  if (diff < 0) {
    const daysOverdue = Math.abs(Math.floor(diff));
    return daysOverdue === 1 ? "1 day overdue" : `${daysOverdue} days overdue`;
  }

  if (diff < 1) {
    return "Due today";
  }

  if (diff < 2) {
    return "Due tomorrow";
  }

  if (diff < 7) {
    return `Due in ${Math.floor(diff)} days`;
  }

  return `Due ${dueBy.toFormat("MMM d")}`;
}

export function WhatsDueActionCard({
  action,
  onStatusChange,
}: WhatsDueActionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const { action: actionData, isOverdue, goal } = action;
  const hasDetails = actionData.body && actionData.body.trim().length > 0;

  const handleCheckboxChange = async (checked: boolean) => {
    setIsUpdating(true);
    try {
      await onStatusChange(actionData.id, checked);
    } finally {
      setIsUpdating(false);
    }
  };

  const isCompleted = actionData.status === ItemStatus.Completed;
  const dueDateText = formatDueDate(actionData.due_by);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "rounded-lg border bg-card transition-colors",
          isOverdue && !isCompleted && "border-amber-200 dark:border-amber-800",
          isCompleted && "opacity-60"
        )}
      >
        {/* Main row */}
        <div className="flex items-start gap-3 p-3">
          <Checkbox
            checked={isCompleted}
            onCheckedChange={handleCheckboxChange}
            disabled={isUpdating}
            className="mt-0.5"
            aria-label={`Mark "${actionData.body?.slice(0, 30) || "action"}" as ${isCompleted ? "incomplete" : "complete"}`}
          />

          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-sm font-medium leading-snug",
                isCompleted && "line-through text-muted-foreground"
              )}
            >
              {actionData.body || "No description"}
            </p>

            <div className="flex items-center gap-2 mt-1.5">
              <Pill variant="outline" className="text-xs px-2 py-0.5">
                {isOverdue && !isCompleted && (
                  <PillIndicator variant="warning" />
                )}
                <Calendar className="h-3 w-3" />
                <span>{dueDateText}</span>
              </Pill>

              {goal.title !== "No Goal" && (
                <span className="text-xs text-muted-foreground truncate">
                  {goal.title}
                </span>
              )}
            </div>
          </div>

          {hasDetails && (
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0"
                aria-label={isOpen ? "Collapse details" : "Expand details"}
              >
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          )}
        </div>

        {/* Expanded content */}
        {hasDetails && (
          <CollapsibleContent>
            <div className="px-3 pb-3 pt-0 pl-10">
              <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                {actionData.body}
              </div>
            </div>
          </CollapsibleContent>
        )}
      </div>
    </Collapsible>
  );
}
