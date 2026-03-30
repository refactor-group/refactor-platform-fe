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
import { Check, ChevronDown, Link2, Unlink } from "lucide-react";
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
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent cursor-pointer whitespace-nowrap max-w-[160px]",
                !selectedGoal && "text-muted-foreground border-dashed"
              )}
              disabled={disabled}
            >
              <Link2 className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {selectedGoal ? selectedGoal.title : "None"}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {selectedGoal ? selectedGoal.title : "No goal linked to this action"}
        </TooltipContent>
      </Tooltip>
      <PopoverContent className="w-72 p-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-medium text-muted-foreground px-2 py-1">
            Current Session Goals
          </span>
          {goals.length === 0 ? (
            <span className="text-[11px] text-muted-foreground px-2 py-1.5">
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
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] hover:bg-accent transition-colors"
                    onClick={() => { onChange(goal.id); setOpen(false); }}
                  >
                    {isSelected ? (
                      <Check className="h-3 w-3 shrink-0 text-primary" />
                    ) : (
                      <span className="h-3 w-3 shrink-0" />
                    )}
                    <span className="line-clamp-2">{goal.title}</span>
                  </div>
                );
              })}
            </div>
          )}
          {selectedGoalId && (
            <>
              <div className="my-1 h-px bg-border" />
              <div
                role="option"
                aria-selected={false}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-accent transition-colors"
                onClick={() => { onChange(undefined); setOpen(false); }}
              >
                <Unlink className="h-3 w-3 shrink-0" />
                <span>Unlink</span>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
