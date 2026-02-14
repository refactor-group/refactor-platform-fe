"use client";

import { useState, useRef, useEffect } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { ItemStatus, Id, actionStatusToString } from "@/types/general";
import type { Action } from "@/types/action";
import { cn } from "@/components/lib/utils";
import { DateTime } from "ts-luxon";
import { siteConfig } from "@/site.config";

interface SessionActionCardProps {
  action: Action;
  coachId: Id;
  coachName: string;
  coacheeId: Id;
  coacheeName: string;
  onStatusChange: (id: Id, newStatus: ItemStatus) => void;
  onDueDateChange: (id: Id, newDueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  onBodyChange: (id: Id, newBody: string) => void;
  onDelete?: (id: Id) => void;
  variant?: "current" | "previous";
}

/** Derive initials from a display name (e.g. "Alex Rivera" -> "AR") */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

/** Returns the Tailwind color class for the status dot */
function statusDotColor(status: ItemStatus): string {
  switch (status) {
    case ItemStatus.NotStarted:
      return "bg-muted-foreground";
    case ItemStatus.InProgress:
      return "bg-green-500";
    case ItemStatus.Completed:
      return "bg-primary";
    case ItemStatus.WontDo:
      return "bg-red-400";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}

const SessionActionCard = ({
  action,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
  onBodyChange,
  onDelete,
  variant = "current",
}: SessionActionCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(action.body ?? "");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync edit text when action body changes externally
  useEffect(() => {
    setEditText(action.body ?? "");
  }, [action.body]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const now = DateTime.now();
  const isCompleted =
    action.status === ItemStatus.Completed ||
    action.status === ItemStatus.WontDo;
  const isOverdue = !isCompleted && action.due_by < now;

  // Build the list of available assignees from coach/coachee props
  const allAssignees = [
    { id: coachId, name: coachName, initials: getInitials(coachName) },
    { id: coacheeId, name: coacheeName, initials: getInitials(coacheeName) },
  ].filter((a) => a.id);

  const assigneeIds = action.assignee_ids ?? [];

  // Resolve assigned users to display info
  const resolvedAssignees = assigneeIds
    .map((id) => allAssignees.find((a) => a.id === id))
    .filter(
      (a): a is { id: Id; name: string; initials: string } => a !== undefined
    );

  const commitEdit = () => {
    setIsEditing(false);
    const trimmed = editText.trim();
    if (trimmed && trimmed !== (action.body ?? "")) {
      onBodyChange(action.id, trimmed);
    } else {
      setEditText(action.body ?? "");
    }
  };

  const handleCompletionToggle = () => {
    const newStatus =
      action.status === ItemStatus.Completed
        ? ItemStatus.InProgress
        : ItemStatus.Completed;
    onStatusChange(action.id, newStatus);
  };

  const handleAssigneeToggle = (assigneeId: Id) => {
    const isAssigned = assigneeIds.includes(assigneeId);
    const updated = isAssigned
      ? assigneeIds.filter((id) => id !== assigneeId)
      : [...assigneeIds, assigneeId];
    onAssigneesChange(action.id, updated);
  };

  const isCurrent = variant === "current";

  return (
    <Card
      className={cn(
        "max-w-2xl border-border/60 shadow-none transition-colors",
        isOverdue && "bg-red-50/40 dark:bg-red-950/15",
        isCompleted && "opacity-60"
      )}
    >
      <CardContent className="flex flex-col gap-2 p-5">
        {/* Top row: status pill | due date (centered) | assignees + delete */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Status pill: displays status and opens dropdown to change it */}
            <Select
              value={action.status}
              onValueChange={(value) =>
                onStatusChange(action.id, value as ItemStatus)
              }
            >
              <SelectTrigger
                className="h-6 w-auto gap-1.5 rounded-full border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent [&>svg]:h-3 [&>svg]:w-3"
              >
                <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", statusDotColor(action.status))} />
                {actionStatusToString(action.status)}
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ItemStatus.NotStarted}>
                  <span className="flex items-center gap-1.5">
                    <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", statusDotColor(ItemStatus.NotStarted))} />
                    Not Started
                  </span>
                </SelectItem>
                <SelectItem value={ItemStatus.InProgress}>
                  <span className="flex items-center gap-1.5">
                    <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", statusDotColor(ItemStatus.InProgress))} />
                    In Progress
                  </span>
                </SelectItem>
                <SelectItem value={ItemStatus.Completed}>
                  <span className="flex items-center gap-1.5">
                    <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", statusDotColor(ItemStatus.Completed))} />
                    Completed
                  </span>
                </SelectItem>
                <SelectItem value={ItemStatus.WontDo}>
                  <span className="flex items-center gap-1.5">
                    <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", statusDotColor(ItemStatus.WontDo))} />
                    Won&apos;t Do
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            {/* Assignee avatar stack with popover */}
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex -space-x-2 cursor-pointer hover:opacity-80"
                    >
                      {resolvedAssignees.length > 0 ? (
                        resolvedAssignees.map((assignee) => (
                          <Avatar
                            key={assignee.id}
                            className="h-8 w-8 border-2 border-background"
                          >
                            <AvatarFallback className="text-[11px]">
                              {assignee.initials}
                            </AvatarFallback>
                          </Avatar>
                        ))
                      ) : (
                        <Avatar className="h-8 w-8 border-2 border-dashed border-muted-foreground/50">
                          <AvatarFallback className="text-[11px] text-muted-foreground">
                            +
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Assignees</TooltipContent>
              </Tooltip>
              <PopoverContent className="w-48 p-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-muted-foreground px-2 py-1">
                    Assignees
                  </span>
                  {allAssignees.map((assignee) => {
                    const isAssigned = assigneeIds.includes(assignee.id);
                    return (
                      <div
                        key={assignee.id}
                        role="option"
                        aria-selected={isAssigned}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent transition-colors"
                        onClick={() => handleAssigneeToggle(assignee.id)}
                      >
                        <Checkbox checked={isAssigned} />
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">
                            {assignee.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span>{assignee.name}</span>
                      </div>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>

            {/* Delete button (current variant only) */}
            {isCurrent && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(action.id)}
              >
                <Trash2 className="!h-[18px] !w-[18px]" />
              </Button>
            )}
          </div>
        </div>

        {/* Body text */}
        {isCurrent && isEditing ? (
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commitEdit();
              }
              if (e.key === "Escape") {
                setEditText(action.body ?? "");
                setIsEditing(false);
              }
            }}
            className="flex-1 resize-none rounded border border-input bg-background px-2 py-1 ml-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
            rows={2}
          />
        ) : (
          <p
            className={cn(
              "text-sm leading-relaxed ml-2",
              isCompleted && "line-through",
              isCurrent &&
                "cursor-pointer rounded px-2 py-1 hover:bg-accent transition-colors"
            )}
            onClick={isCurrent ? () => setIsEditing(true) : undefined}
          >
            {action.body || "No description"}
          </p>
        )}

        {/* Footer: due date + session link (centered) */}
        <div className="flex justify-center text-xs text-muted-foreground ml-2">
          <div className="flex items-center gap-1.5">
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "flex items-center gap-1 hover:underline cursor-pointer",
                    isOverdue && "text-red-500 font-medium"
                  )}
                >
                  {isOverdue && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                  )}
                  Due:{" "}
                  {action.due_by
                    .setLocale(siteConfig.locale)
                    .toLocaleString(DateTime.DATE_MED)}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={action.due_by.toJSDate()}
                  onSelect={(date: Date | undefined) => {
                    if (date) {
                      onDueDateChange(action.id, DateTime.fromJSDate(date));
                      setCalendarOpen(false);
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
            {!isCurrent && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <Link
                  href={`/coaching-sessions/${action.coaching_session_id}?tab=actions`}
                  className="hover:underline hover:text-foreground transition-colors"
                >
                  From:{" "}
                  {action.created_at
                    .setLocale(siteConfig.locale)
                    .toLocaleString(DateTime.DATE_MED)}
                </Link>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export { SessionActionCard };
export type { SessionActionCardProps };
