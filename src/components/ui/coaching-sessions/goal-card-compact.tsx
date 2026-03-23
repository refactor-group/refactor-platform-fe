"use client";

import { useState, useCallback, useRef } from "react";
import { ChevronDown, ChevronUp, Pencil, Pause, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/components/lib/utils";
import { GoalProgressIcon } from "@/components/ui/coaching-sessions/goal-progress-icon";
import { GoalEditForm } from "@/components/ui/coaching-sessions/goal-edit-form";
import { useGoalProgress } from "@/lib/api/goal-progress";
import type { Goal } from "@/types/goal";
import { goalTitle, hasGoalBody } from "@/types/goal";
import { Some } from "@/types/option";

// ── Compact Goal Card ─────────────────────────────────────────────────

export interface CompactGoalCardProps {
  goal: Goal;
  onRemove?: () => void;
  onUpdate?: (goalId: string, title: string, body: string) => Promise<void>;
  /** When set, clicking the card selects/links the goal */
  onSelect?: () => void;
  /** When set, card shows a "put on hold" affordance instead of normal interactions */
  swapMode?: {
    onSelect: () => void;
  };
  /** When true, card shows a visual indicator that it will be put on hold */
  pendingHold?: boolean;
}

export function CompactGoalCard({ goal, onRemove, onUpdate, onSelect, swapMode, pendingHold }: CompactGoalCardProps) {
  const { progressMetrics } = useGoalProgress(Some(goal.id));
  const titleRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [showBody, setShowBody] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const hasBody = hasGoalBody(goal);

  const checkTruncation = useCallback(() => {
    const el = titleRef.current;
    if (el) {
      setIsTruncated(el.scrollHeight > el.clientHeight);
    }
  }, []);

  const percent =
    progressMetrics.actions_total > 0
      ? Math.round(
          (progressMetrics.actions_completed / progressMetrics.actions_total) *
            100
        )
      : 0;

  const title = goalTitle(goal);

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setShowBody(false);
  }, []);

  const handleEditSave = useCallback(
    async (newTitle: string, newBody: string) => {
      if (onUpdate) {
        await onUpdate(goal.id, newTitle, newBody);
      }
      setIsEditing(false);
    },
    [goal.id, onUpdate]
  );

  const handleEditCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Edit mode renders an inline form pre-populated with current values
  if (isEditing) {
    return (
      <GoalEditForm
        initialTitle={goal.title}
        initialBody={goal.body}
        onSave={handleEditSave}
        onCancel={handleEditCancel}
      />
    );
  }

  // Swap mode card doesn't use progress bar or actions info
  const cardContent = swapMode ? (
    <button
      type="button"
      onClick={swapMode.onSelect}
      onMouseEnter={checkTruncation}
      className="w-full text-left rounded-lg border border-border/50 bg-background p-3 space-y-2 transition-all hover:border-border cursor-pointer group/card"
    >
      <div className="flex items-start justify-between gap-2">
        <span ref={titleRef} className="text-[13px] font-medium line-clamp-2 min-w-0">
          {title}
        </span>
        <Pause className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/card:text-muted-foreground shrink-0 mt-0.5 transition-colors" />
      </div>

      <div className="flex items-center justify-end text-[11px]">
        <span className="text-muted-foreground/0 group-hover/card:text-muted-foreground/70 transition-colors">
          Put on hold
        </span>
      </div>
    </button>
  ) : (
    <div
      onMouseEnter={checkTruncation}
      onClick={onSelect ?? (hasBody ? () => setShowBody(!showBody) : undefined)}
      className={cn(
        "rounded-lg border p-3 space-y-2 group/card transition-colors shadow-sm",
        pendingHold
          ? "border-border bg-muted/30"
          : onSelect
            ? "border-border/50 bg-background hover:border-border cursor-pointer"
            : "border-border/50 bg-background hover:border-border",
        hasBody && !pendingHold && !onSelect && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span ref={titleRef} className={cn(
          "text-[13px] font-medium line-clamp-2 min-w-0",
          pendingHold && "text-muted-foreground"
        )}>
          {title}
        </span>
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {pendingHold ? (
            <Pause className="h-3 w-3 text-muted-foreground/70" />
          ) : onSelect ? (
            hasBody ? (
              <button
                type="button"
                aria-label={showBody ? `Collapse ${title}` : `Expand ${title}`}
                onClick={(e) => { e.stopPropagation(); setShowBody(!showBody); }}
                className="rounded-md p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
              >
                {showBody ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            ) : null
          ) : (
            <>
              {onUpdate && (
                <button
                  type="button"
                  aria-label={`Edit ${title}`}
                  onClick={handleEditClick}
                  className="rounded-md p-0.5 text-muted-foreground/0 group-hover/card:text-muted-foreground/40 hover:!text-foreground transition-colors"
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              {onRemove && (
                <TooltipProvider delayDuration={400}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={`Remove ${title}`}
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="rounded-md p-0.5 text-muted-foreground/0 group-hover/card:text-muted-foreground/40 hover:!text-destructive hover:!bg-destructive/10 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                      Remove from session
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </>
          )}
        </div>
      </div>

      {!pendingHold && progressMetrics.actions_total > 0 && (
        <div className="h-1 w-full rounded-full bg-border/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground/20 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-end text-[11px] text-muted-foreground/60">
        {pendingHold ? (
          <span className="text-muted-foreground/60 italic mr-auto">Will be put on hold</span>
        ) : (
          <GoalProgressIcon progress={progressMetrics.progress} />
        )}
      </div>

      <div
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
          showBody && hasBody ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <p className="text-[12px] text-muted-foreground/70 leading-relaxed whitespace-pre-wrap border-t border-border/30 pt-2">
          {goal.body}
        </p>
      </div>
    </div>
  );

  if (!isTruncated) return cardContent;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{cardContent}</TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[280px]">
          <p className="font-medium">{title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
