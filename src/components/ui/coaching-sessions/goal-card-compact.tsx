"use client";

import { useRef } from "react";
import { Pencil, CircleMinus } from "lucide-react";
import { cn } from "@/components/lib/utils";
import {
  CARD_BUTTON,
  CARD_DONE,
  CARD_FACE,
  CARD_SURFACE,
  CARD_TITLE,
  CardDetailsButton,
} from "@/components/ui/card-field";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BaseCardCompactEditable } from "@/components/ui/base-card-compact-editable";
import { ContentExpandable } from "@/components/ui/content-expandable";
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
// Uses BaseCardCompactEditable for shared card infrastructure (state, animation,
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
        className={cn(CARD_SURFACE, "w-full cursor-pointer space-y-2 text-left group/card")}
      >
        <div className="flex items-start justify-between gap-2">
          <span ref={titleRef} className={cn(CARD_TITLE, "line-clamp-2 min-w-0")}>
            {title}
          </span>
        </div>
        <div className="flex items-center justify-end text-xs">
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
        className={cn(CARD_SURFACE, "cursor-pointer space-y-2 group/card")}
      >
        <div className="flex items-start justify-between gap-2">
          <span ref={titleRef} className={cn(CARD_TITLE, "line-clamp-2 min-w-0")}>
            {title}
          </span>
        </div>

        <div className="flex items-center justify-end text-xs text-muted-foreground">
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
    <BaseCardCompactEditable
      canFlip={canInteract}
      faceClassName={CARD_FACE}
      renderFront={({ onFlip }) => (
        <FrontFace
          title={title}
          canInteract={canInteract}
          onFlip={onFlip}
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
  actionsCompleted,
  actionsTotal,
  progress,
  hasBody,
  body,
}: {
  title: string;
  canInteract?: boolean;
  onFlip: () => void;
  actionsCompleted: number;
  actionsTotal: number;
  progress: import("@/types/goal-progress").GoalProgress;
  hasBody: boolean;
  body: string;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <ContentExpandable
          text={title}
          className={CARD_TITLE}
          overflowText={hasBody ? body : undefined}
          hasOverflow={hasBody}
        />
        {canInteract && (
          <CardDetailsButton
            label={`Goal options for ${title}`}
            tooltip="Edit or remove goal"
            onClick={onFlip}
          />
        )}
      </div>

      <div className="flex items-center justify-end text-xs text-muted-foreground">
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
        <button type="button" onClick={onDone} className={CARD_DONE}>
          Done
        </button>
      </div>

      {/* Full goal title */}
      <p className={CARD_TITLE}>
        {title}
      </p>

      {/* Goal body preview */}
      {hasBody && (
        <p className="text-label leading-relaxed text-muted-foreground line-clamp-3 whitespace-pre-wrap">
          {body}
        </p>
      )}

      {/* Progress summary */}
      {actionsTotal > 0 && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {actionsCompleted}/{actionsTotal} actions &middot; {percent}%
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-3">
        {onEdit && (
          <Button variant="secondary" size="sm" className={CARD_BUTTON} onClick={onEdit}>
            <Pencil className="!h-3 !w-3" aria-hidden />
            Edit
          </Button>
        )}
        {onRemove && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="destructive" size="sm" className={CARD_BUTTON} onClick={onRemove}>
                  <CircleMinus className="!h-3 !w-3" aria-hidden />
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
