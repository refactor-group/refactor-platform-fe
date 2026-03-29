"use client";

import { useRef } from "react";
import { Info, Pencil, CircleMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EditableCardCompact } from "@/components/ui/coaching-sessions/editable-card-compact";
import { ExpandableContent } from "@/components/ui/coaching-sessions/expandable-content";
import { GoalProgressIcon } from "@/components/ui/coaching-sessions/goal-progress-icon";
import { GoalEditForm } from "@/components/ui/coaching-sessions/goal-edit-form";
import { useGoalProgress } from "@/lib/api/goal-progress";
import type { Goal } from "@/types/goal";
import { goalTitle, hasGoalBody } from "@/types/goal";
import { Some } from "@/types/option";

// ── Compact Goal Card (flip-card interaction) ────────────────────────
//
// Front face: read-only — title, progress bar, progress icon, info button.
// Back face:  actions   — edit, unlink from session, "Done" to flip back.
//
// Uses EditableCardCompact for shared card infrastructure (state, animation,
// outside-click). Swap mode and select mode are early returns that bypass
// the flip card entirely.

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
}

export function CompactGoalCard({ goal, onRemove, onUpdate, onSelect, swapMode }: CompactGoalCardProps) {
  const { progressMetrics } = useGoalProgress(Some(goal.id));
  const titleRef = useRef<HTMLSpanElement>(null);
  const hasBody = hasGoalBody(goal);

  const percent =
    progressMetrics.actions_total > 0
      ? Math.round(
          (progressMetrics.actions_completed / progressMetrics.actions_total) *
            100
        )
      : 0;

  const title = goalTitle(goal);

  // Swap mode card — no flip interaction, just a selectable card
  if (swapMode) {
    return (
      <button
        type="button"
        onClick={swapMode.onSelect}
        className="w-full text-left rounded-lg border border-border bg-background p-3 space-y-2 transition-all hover:border-foreground/20 cursor-pointer group/card"
      >
        <div className="flex items-start justify-between gap-2">
          <span ref={titleRef} className="text-[13px] font-medium line-clamp-2 min-w-0">
            {title}
          </span>
        </div>
        <div className="flex items-center justify-end text-[11px]">
          <span className="text-muted-foreground/0 group-hover/card:text-muted-foreground transition-colors">
            Replace this goal
          </span>
        </div>
      </button>
    );
  }

  // Selectable card (used in browse view) — no flip, just clickable
  if (onSelect) {
    return (
      <div
        onClick={onSelect}
        className="rounded-lg border border-border bg-background p-3 space-y-2 group/card transition-colors shadow-sm hover:border-foreground/20 cursor-pointer"
      >
        <div className="flex items-start justify-between gap-2">
          <span ref={titleRef} className="text-[13px] font-medium line-clamp-2 min-w-0">
            {title}
          </span>
        </div>

        {progressMetrics.actions_total > 0 && (
          <div className="h-1 w-full rounded-full bg-border/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-foreground/20 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}

        <div className="flex items-center justify-end text-[11px] text-muted-foreground/60">
          <GoalProgressIcon
            progress={progressMetrics.progress}
            actionsCompleted={progressMetrics.actions_completed}
            actionsTotal={progressMetrics.actions_total}
          />
        </div>
      </div>
    );
  }

  const canInteract = Boolean(onRemove || onUpdate);

  // ── Flip card ────────────────────────────────────────────────────────

  return (
    <EditableCardCompact
      canFlip={canInteract}
      renderFront={({ onFlip }) => (
        <FrontFace
          title={title}
          canInteract={canInteract}
          onFlip={onFlip}
          percent={percent}
          actionsCompleted={progressMetrics.actions_completed}
          actionsTotal={progressMetrics.actions_total}
          progress={progressMetrics.progress}
          hasBody={hasBody}
          body={goal.body}
        />
      )}
      renderBack={({ onDone, isEditing, onEditStart, onEditEnd }) =>
        isEditing ? (
          <GoalEditForm
            initialTitle={goal.title}
            initialBody={goal.body}
            onSave={async (newTitle, newBody) => {
              if (onUpdate) await onUpdate(goal.id, newTitle, newBody);
              onEditEnd();
            }}
            onCancel={onEditEnd}
          />
        ) : (
          <BackFace
            title={title}
            body={goal.body}
            hasBody={hasBody}
            onDone={onDone}
            onEdit={onUpdate ? onEditStart : undefined}
            onRemove={onRemove ? () => {
              onRemove();
              onDone();
            } : undefined}
            percent={percent}
            actionsTotal={progressMetrics.actions_total}
            actionsCompleted={progressMetrics.actions_completed}
          />
        )
      }
    />
  );
}

// ── Front face content ──────────────────────────────────────────────

function FrontFace({
  title,
  canInteract,
  onFlip,
  percent,
  actionsCompleted,
  actionsTotal,
  progress,
  hasBody,
  body,
}: {
  title: string;
  canInteract?: boolean;
  onFlip: () => void;
  percent: number;
  actionsCompleted: number;
  actionsTotal: number;
  progress: import("@/types/goal-progress").GoalProgress;
  hasBody: boolean;
  body: string;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <ExpandableContent
          text={title}
          className="text-[13px] font-medium"
          overflowText={hasBody ? body : undefined}
          hasOverflow={hasBody}
        />
        <div className="flex items-center gap-1 shrink-0 mt-0.5">
          {canInteract ? (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Goal options for ${title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onFlip();
                    }}
                    className="rounded-full p-0.5 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  Edit or remove goal
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
      </div>

      {actionsTotal > 0 && (
        <div className="h-1 w-full rounded-full bg-border/40 overflow-hidden">
          <div
            className="h-full rounded-full bg-foreground/20 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-end text-[11px] text-muted-foreground/60">
        <GoalProgressIcon
          progress={progress}
          actionsCompleted={actionsCompleted}
          actionsTotal={actionsTotal}
        />
      </div>
    </>
  );
}

// ── Back face content ───────────────────────────────────────────────

function BackFace({
  title,
  body,
  hasBody,
  onDone,
  onEdit,
  onRemove,
  percent,
  actionsTotal,
  actionsCompleted,
}: {
  title: string;
  body: string;
  hasBody: boolean;
  onDone: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  percent: number;
  actionsTotal: number;
  actionsCompleted: number;
}) {
  return (
    <div className="space-y-3">
      {/* Done button — top right, matching macOS widget pattern */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onDone}
          className="text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Done
        </button>
      </div>

      {/* Full goal title */}
      <p className="text-[13px] font-medium">
        {title}
      </p>

      {/* Goal body preview */}
      {hasBody && (
        <p className="text-[12px] text-muted-foreground/70 leading-relaxed line-clamp-3 whitespace-pre-wrap">
          {body}
        </p>
      )}

      {/* Progress summary */}
      {actionsTotal > 0 && (
        <div className="space-y-1.5">
          <div className="h-1 w-full rounded-full bg-border/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-foreground/20 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground/60">
            {actionsCompleted}/{actionsTotal} actions &middot; {percent}%
          </p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-3">
        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 text-[11px] px-2"
            onClick={onEdit}
          >
            <Pencil className="!h-2.5 !w-2.5" />
            Edit
          </Button>
        )}
        {onRemove && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-6 gap-1 text-[11px] px-2"
                  onClick={onRemove}
                >
                  <CircleMinus className="!h-2.5 !w-2.5" />
                  Remove
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                Remove this goal from the session
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
