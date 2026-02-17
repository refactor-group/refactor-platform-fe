"use client";

import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { CalendarIcon } from "lucide-react";
import { Id } from "@/types/general";
import { cn } from "@/components/lib/utils";
import { DateTime } from "ts-luxon";


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Derive initials from a display name (e.g. "Alex Rivera" -> "AR") */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

export interface AssigneeInfo {
  id: Id;
  name: string;
  initials: string;
}

/** Builds the full assignee list and resolves which are currently assigned. */
export function resolveAssignees(
  assigneeIds: Id[],
  coachId: Id,
  coachName: string,
  coacheeId: Id,
  coacheeName: string
): { allAssignees: AssigneeInfo[]; resolvedAssignees: AssigneeInfo[] } {
  const allAssignees = [
    { id: coachId, name: coachName, initials: getInitials(coachName) },
    { id: coacheeId, name: coacheeName, initials: getInitials(coacheeName) },
  ].filter((a) => a.id);

  const resolvedAssignees = assigneeIds
    .map((id) => allAssignees.find((a) => a.id === id))
    .filter((a): a is AssigneeInfo => a !== undefined);

  return { allAssignees, resolvedAssignees };
}

// ---------------------------------------------------------------------------
// AssigneePickerPopover
// ---------------------------------------------------------------------------

interface AssigneePickerPopoverProps {
  allAssignees: AssigneeInfo[];
  resolvedAssignees: AssigneeInfo[];
  assigneeIds: Id[];
  onToggle: (assigneeId: Id) => void;
  disabled?: boolean;
}

export function AssigneePickerPopover({
  allAssignees,
  resolvedAssignees,
  assigneeIds,
  onToggle,
  disabled = false,
}: AssigneePickerPopoverProps) {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex -space-x-2 cursor-pointer hover:opacity-80"
              disabled={disabled}
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
                onClick={() => onToggle(assignee.id)}
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
  );
}

// ---------------------------------------------------------------------------
// DueDatePicker
// ---------------------------------------------------------------------------

interface DueDatePickerProps {
  value: DateTime;
  onChange: (date: DateTime) => void;
  locale: string;
  /** Render as a Button (for forms) or a plain text link (for footers). */
  variant?: "button" | "text";
  isOverdue?: boolean;
  disabled?: boolean;
}

export function DueDatePicker({
  value,
  onChange,
  locale,
  variant = "button",
  isOverdue = false,
  disabled = false,
}: DueDatePickerProps) {
  const [open, setOpen] = useState(false);

  const formattedDate = value
    .setLocale(locale)
    .toLocaleString(DateTime.DATE_MED);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(DateTime.fromJSDate(date));
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {variant === "button" ? (
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 text-xs gap-1.5",
              !value && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {formattedDate}
          </Button>
        ) : (
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
            Due: {formattedDate}
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value.toJSDate()}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}
