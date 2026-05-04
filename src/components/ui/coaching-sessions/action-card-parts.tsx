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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CalendarIcon,
  CheckCircle2,
  Circle,
  CircleDot,
  PauseCircle,
  UserRound,
  XCircle,
} from "lucide-react";
import { ItemStatus, Id, actionStatusToString } from "@/types/general";
import { cn } from "@/components/lib/utils";
import { DateTime } from "ts-luxon";


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A small lucide glyph indicating an Action's status. Pure presentational. */
export interface ActionStatusIconProps {
  status: ItemStatus;
  className?: string;
}

function statusIconAndLabel(
  status: ItemStatus
): { Icon: typeof Circle; label: string } {
  switch (status) {
    case ItemStatus.NotStarted:
      return { Icon: Circle, label: "Not started" };
    case ItemStatus.InProgress:
      return { Icon: CircleDot, label: "In progress" };
    case ItemStatus.Completed:
      return { Icon: CheckCircle2, label: "Completed" };
    case ItemStatus.OnHold:
      return { Icon: PauseCircle, label: "On hold" };
    case ItemStatus.WontDo:
      return { Icon: XCircle, label: "Won't do" };
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}

export function ActionStatusIcon({ status, className }: ActionStatusIconProps) {
  const { Icon, label } = statusIconAndLabel(status);
  return (
    <Icon
      role="img"
      aria-label={label}
      className={cn("h-4 w-4 text-muted-foreground/60 shrink-0", className)}
    />
  );
}

/** Tailwind background class for a status dot indicator */
export function statusDotColor(status: ItemStatus): string {
  switch (status) {
    case ItemStatus.NotStarted:
      return "bg-muted-foreground";
    case ItemStatus.InProgress:
      return "bg-green-500";
    case ItemStatus.OnHold:
      return "bg-amber-400";
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
                  <AvatarFallback className="text-muted-foreground">
                    <UserRound className="!h-4 !w-4" />
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
      {variant === "button" ? (
        <PopoverTrigger asChild>
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
        </PopoverTrigger>
      ) : isOverdue ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-red-500 transition-colors hover:bg-accent cursor-pointer whitespace-nowrap"
              >
                Overdue
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {value.hasSame(DateTime.now(), "day")
              ? "This is due today"
              : `This was due on ${formattedDate}`}
          </TooltipContent>
        </Tooltip>
      ) : (
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-accent cursor-pointer whitespace-nowrap"
          >
            Due: {formattedDate}
          </button>
        </PopoverTrigger>
      )}
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

// ---------------------------------------------------------------------------
// StatusSelect
// ---------------------------------------------------------------------------

export interface StatusSelectProps {
  status: ItemStatus;
  onStatusChange: (newStatus: ItemStatus) => void;
}

export function StatusSelect({ status, onStatusChange }: StatusSelectProps) {
  return (
    <Select
      value={status}
      onValueChange={(value) => onStatusChange(value as ItemStatus)}
    >
      <SelectTrigger
        className="h-6 w-auto gap-1.5 rounded-full border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent whitespace-nowrap [&>svg]:h-3 [&>svg]:w-3"
      >
        <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", statusDotColor(status))} />
        {actionStatusToString(status)}
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
        <SelectItem value={ItemStatus.OnHold}>
          <span className="flex items-center gap-1.5">
            <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", statusDotColor(ItemStatus.OnHold))} />
            On Hold
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
  );
}
