"use client";

import { useState } from "react";
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
import { Check, Link2, Unlink } from "lucide-react";
import { FIELD_TRIGGER, FieldCaret, PICKER_CONTENT, PICKER_ROW } from "@/components/ui/card-field";
import type { Goal } from "@/types/goal";
import type { Id } from "@/types/general";
import { cn } from "@/components/lib/utils";

// ---------------------------------------------------------------------------
// GoalPickerPopover
// ---------------------------------------------------------------------------

interface GoalPickerPopoverProps {
  goals: Goal[];
  selectedGoalId?: Id;
  onChange: (goalId: Id | undefined) => void;
  disabled?: boolean;
}

export function GoalPickerPopover({
  goals,
  selectedGoalId,
  onChange,
  disabled = false,
}: GoalPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const selectedGoal = selectedGoalId
    ? goals.find((g) => g.id === selectedGoalId)
    : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(FIELD_TRIGGER, !selectedGoal && "text-muted-foreground")}
              disabled={disabled}
            >
              <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">
                {selectedGoal ? selectedGoal.title : "None"}
              </span>
              <FieldCaret />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {selectedGoal ? selectedGoal.title : "No goal linked to this action"}
        </TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className={cn("w-72", PICKER_CONTENT)}>
        <div className="flex flex-col">
          <span className="px-2 pb-1 pt-1 text-label font-medium text-muted-foreground">
            Current session goals
          </span>
          {goals.length === 0 ? (
            <span className="px-2 py-2 text-item text-muted-foreground">
              No goals in this session
            </span>
          ) : (
            <div role="listbox" className="max-h-48 overflow-y-auto">
              {goals.map((goal) => {
                const isSelected = goal.id === selectedGoalId;
                return (
                  <div
                    key={goal.id}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(PICKER_ROW, "cursor-pointer py-1.5 hover:bg-well")}
                    onClick={() => { onChange(goal.id); setOpen(false); }}
                  >
                    <span className="min-w-0 flex-1 line-clamp-2">{goal.title}</span>
                    {isSelected && <Check className="h-4 w-4 shrink-0 text-brand" aria-hidden />}
                  </div>
                );
              })}
            </div>
          )}
          {selectedGoalId && (
            <>
              <div className="my-1 h-px bg-hairline" />
              <div
                role="option"
                aria-selected={false}
                className={cn(PICKER_ROW, "cursor-pointer text-muted-foreground hover:bg-well")}
                onClick={() => { onChange(undefined); setOpen(false); }}
              >
                <Unlink className="h-4 w-4 shrink-0" aria-hidden />
                <span>Unlink</span>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
