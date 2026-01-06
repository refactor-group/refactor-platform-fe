"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Calendar, User, Clock } from "lucide-react";
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
import { resolveUserNameInRelationship } from "@/lib/relationships/relationship-utils";
import { formatShortDate } from "@/lib/utils/date-utils";

interface WhatsDueActionCardProps {
  action: AssignedActionWithContext;
  onStatusChange: (actionId: Id, completed: boolean) => void;
}

function formatDueDate(dueBy: DateTime): string {
  // Compare dates only (not times) to avoid "overdue" for items due today
  const today = DateTime.now().startOf("day");
  const dueDate = dueBy.startOf("day");
  const diffDays = dueDate.diff(today, "days").days;

  if (diffDays < 0) {
    const daysOverdue = Math.abs(diffDays);
    return daysOverdue === 1 ? "1 day overdue" : `${daysOverdue} days overdue`;
  }

  if (diffDays === 0) {
    return "Due today";
  }

  if (diffDays === 1) {
    return "Due tomorrow";
  }

  if (diffDays < 7) {
    return `Due in ${diffDays} days`;
  }

  return `Due ${dueBy.toFormat("MMM d")}`;
}

export function WhatsDueActionCard({
  action,
  onStatusChange,
}: WhatsDueActionCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const { action: actionData, isOverdue, relationship } = action;

  const createdByName = resolveUserNameInRelationship(actionData.user_id, relationship);
  const createdAtText = formatShortDate(actionData.created_at);

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
  const isDueSoon = dueDateText === "Due today" || dueDateText === "Due tomorrow";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className={cn(
          "rounded-lg border bg-secondary/30 transition-colors",
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
            <Link
              href={`/coaching-sessions/${actionData.coaching_session_id}?tab=actions`}
              className={cn(
                "text-sm font-medium leading-snug hover:underline",
                isCompleted && "line-through text-muted-foreground"
              )}
            >
              {actionData.body || "No description"}
            </Link>

            <div className="flex items-center gap-2 mt-1.5">
              <Pill variant="outline" className="text-xs px-2 py-0.5">
                {isOverdue && !isCompleted && (
                  <PillIndicator variant="warning" />
                )}
                <Calendar className="h-3 w-3" />
                <span className={cn(isDueSoon && "font-bold")}>{dueDateText}</span>
              </Pill>
            </div>
          </div>

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
        </div>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 pl-10 space-y-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>Created by {createdByName}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Created {createdAtText}</span>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
