"use client";

import { useState, useRef, useCallback } from "react";
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
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const checkTruncation = useCallback(() => {
    const el = textRef.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, []);

  const percent =
    actionsTotal > 0
      ? Math.round((actionsCompleted / actionsTotal) * 100)
      : 0;

  const chip = (
    <div
      onMouseEnter={checkTruncation}
      className="inline-flex items-center gap-2 rounded-lg bg-muted/50 pl-3 pr-1.5 py-1.5 text-sm transition-all hover:bg-muted group"
    >
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
      <span
        ref={textRef}
        className="font-medium text-[13px] truncate max-w-[180px] md:max-w-[260px] lg:max-w-[360px]"
      >
        {goalTitle(goal)}
      </span>
      <button
        type="button"
        aria-label={`Remove ${goalTitle(goal)}`}
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="rounded-md p-1 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );

  if (!isTruncated) return chip;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[240px]">
          <p className="font-medium">{goalTitle(goal)}</p>
          {actionsTotal > 0 && (
            <p className="text-muted-foreground mt-0.5">
              {actionsCompleted}/{actionsTotal} actions &middot; {percent}%
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
