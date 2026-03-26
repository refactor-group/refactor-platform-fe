"use client";

import { TrendingUp, ArrowRight, TrendingDown } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GoalProgress } from "@/types/goal-progress";

interface GoalProgressIconProps {
  progress: GoalProgress;
  /** Show a tooltip with the progress label on hover. Defaults to true. */
  showTooltip?: boolean;
  /** When provided, the tooltip includes action completion details. */
  actionsCompleted?: number;
  actionsTotal?: number;
  className?: string;
}

function progressLabel(progress: GoalProgress): string {
  switch (progress) {
    case GoalProgress.SolidMomentum:
      return "Solid momentum";
    case GoalProgress.NeedsAttention:
      return "Needs attention";
    case GoalProgress.LetsRefocus:
      return "Let\u2019s refocus";
    default: {
      const _exhaustive: never = progress;
      throw new Error(`Unhandled GoalProgress: ${_exhaustive}`);
    }
  }
}

function ProgressIconRaw({ progress, className }: { progress: GoalProgress; className?: string }) {
  const iconClass = className ?? "h-3.5 w-3.5";

  switch (progress) {
    case GoalProgress.SolidMomentum:
      return <TrendingUp className={`${iconClass} text-emerald-700/60`} />;
    case GoalProgress.NeedsAttention:
      return <ArrowRight className={`${iconClass} text-amber-600/60`} />;
    case GoalProgress.LetsRefocus:
      return <TrendingDown className={`${iconClass} text-rose-500/60`} />;
    default: {
      const _exhaustive: never = progress;
      throw new Error(`Unhandled GoalProgress: ${_exhaustive}`);
    }
  }
}

export function GoalProgressIcon({
  progress,
  showTooltip = true,
  actionsCompleted,
  actionsTotal,
  className,
}: GoalProgressIconProps) {
  const icon = <ProgressIconRaw progress={progress} className={className} />;

  if (!showTooltip) return icon;

  const showActions = actionsTotal !== undefined;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-default">{icon}</span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">{progressLabel(progress)}</p>
          {showActions && (
            <p className="text-muted-foreground">
              {actionsCompleted ?? 0}/{actionsTotal} actions completed
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
