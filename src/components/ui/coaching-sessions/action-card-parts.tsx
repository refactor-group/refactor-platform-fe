"use client";

import { useState } from "react";
import { PersonAvatar } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CalendarIcon, Check, UserRound } from "lucide-react";
import {
  FIELD_TRIGGER,
  FieldCaret,
  PICKER_CONTENT,
  PICKER_ROW,
} from "@/components/ui/card-field";
import { Id } from "@/types/general";
import {
  departedReason,
  useDepartedMembers,
} from "@/components/ui/coaching-sessions/departed-members-context";
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
// AssigneeAvatars
// ---------------------------------------------------------------------------

/** 26px assignee avatars, each named on hover unless the caller names them another way. */
export function AssigneeAvatars({
  assignees,
  named = true,
}: {
  assignees: AssigneeInfo[];
  named?: boolean;
}) {
  if (!named) {
    return (
      <span className="flex items-center -space-x-1.5" aria-hidden>
        {assignees.map((a) => (
          <PersonAvatar
            key={a.id}
            userId={a.id}
            initials={a.initials}
            size={26}
            className="ring-2 ring-background"
          />
        ))}
      </span>
    );
  }
  return (
    <div className="flex items-center -space-x-1.5">
      {assignees.map((a) => (
        <TooltipProvider key={a.id} delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span aria-label={a.name} role="img">
                <PersonAvatar
                  userId={a.id}
                  initials={a.initials}
                  size={26}
                  className="ring-2 ring-background"
                />
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {a.name}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  );
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
  /** Assignees that cannot be toggled, with the reason shown to the user. */
  disabledReasons?: Partial<Record<Id, string>>;
}

export function AssigneePickerPopover({
  allAssignees,
  resolvedAssignees,
  assigneeIds,
  onToggle,
  disabled = false,
  disabledReasons = {},
}: AssigneePickerPopoverProps) {
  const departed = useDepartedMembers();
  // Someone who left can still be unassigned, never newly assigned.
  const reasonsById: Partial<Record<Id, string>> = {
    ...Object.fromEntries(
      allAssignees
        .filter((a) => departed.has(a.id) && !assigneeIds.includes(a.id))
        .map((a) => [a.id, departedReason(a.name)])
    ),
    ...disabledReasons,
  };
  const reasons = [...new Set(Object.values(reasonsById))].filter(
    (r): r is string => r !== undefined
  );
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Assignees"
              className={cn(FIELD_TRIGGER, "pl-1")}
              disabled={disabled}
            >
              {resolvedAssignees.length > 0 ? (
                <AssigneeAvatars assignees={resolvedAssignees} named={false} />
              ) : (
                <>
                  <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full border border-dashed border-muted-foreground/50 text-muted-foreground">
                    <UserRound className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="text-muted-foreground">Unassigned</span>
                </>
              )}
              <FieldCaret />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Assignees</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className={cn("w-60", PICKER_CONTENT)} collisionPadding={8}>
        <div role="listbox" aria-label="Assignees" aria-multiselectable="true" className="flex flex-col">
          {allAssignees.map((assignee) => {
            const isAssigned = assigneeIds.includes(assignee.id);
            const reason = reasonsById[assignee.id];
            return (
              <div
                key={assignee.id}
                role="option"
                aria-selected={isAssigned}
                aria-disabled={reason !== undefined ? "true" : undefined}
                title={reason}
                className={cn(
                  PICKER_ROW,
                  reason !== undefined
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer hover:bg-well"
                )}
                onClick={() => {
                  if (reason === undefined) onToggle(assignee.id);
                }}
              >
                <PersonAvatar userId={assignee.id} initials={assignee.initials} size={26} />
                <span className="min-w-0 flex-1 truncate">{assignee.name}</span>
                {isAssigned && <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden />}
              </div>
            );
          })}
          {reasons.map((r) => (
            <p key={r} className="px-2 pb-1 pt-1.5 text-xs leading-snug text-muted-foreground">
              {r}
            </p>
          ))}
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
          <button type="button" className={FIELD_TRIGGER} disabled={disabled}>
            <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="tabular-nums">{formattedDate}</span>
            <FieldCaret />
          </button>
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
      <PopoverContent align="end" className={cn("w-auto p-0", PICKER_CONTENT)}>
        <Calendar
          mode="single"
          selected={value.toJSDate()}
          // Open on the due date's month, not today's.
          defaultMonth={value.toJSDate()}
          onSelect={handleSelect}
        />
      </PopoverContent>
    </Popover>
  );
}
