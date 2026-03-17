"use client";

import { X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Goal } from "@/types/goal";
import { goalTitle } from "@/types/goal";

interface GoalChipProps {
  goal: Goal;
  actionsCompleted: number;
  actionsTotal: number;
  onRemove: () => void;
}

export function GoalChip({
  goal,
  actionsCompleted,
  actionsTotal,
  onRemove,
}: GoalChipProps) {
  const percent =
    actionsTotal > 0
      ? Math.round((actionsCompleted / actionsTotal) * 100)
      : 0;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center gap-2 rounded-lg bg-muted/50 pl-3 pr-1.5 py-1.5 text-sm transition-all hover:bg-muted group">
            {/* Mini progress ring */}
            {actionsTotal > 0 && (
              <div className="relative h-4 w-4 shrink-0">
                <svg className="h-4 w-4 -rotate-90" viewBox="0 0 16 16">
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    fill="none"
                    stroke="currentColor"
                    className="text-muted-foreground/15"
                    strokeWidth="2"
                  />
                  <circle
                    cx="8"
                    cy="8"
                    r="6"
                    fill="none"
                    stroke="currentColor"
                    className="text-emerald-800/50"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={`${percent * 0.377} 100`}
                  />
                </svg>
              </div>
            )}
            <span className="font-medium text-[13px] truncate max-w-[180px]">
              {goalTitle(goal)}
            </span>
            <button
              type="button"
              aria-label={`Unlink ${goalTitle(goal)}`}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="rounded-md p-1 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          {actionsTotal > 0 ? (
            <span>
              {actionsCompleted}/{actionsTotal} actions &middot; {percent}%
            </span>
          ) : (
            <span>No actions yet</span>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
