"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Info, Pencil, CircleMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
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

// ── Compact Goal Card (flip-card interaction) ────────────────────────
//
// Front face: read-only — title, progress bar, progress icon, info button.
// Back face:  actions   — edit, unlink from session, "Done" to flip back.
//
// Inspired by macOS widget flip: clicking the info icon (ⓘ) flips the card
// to reveal actions. The card grows to accommodate the back-face content.
// A "Done" button in the top-right returns to the front face.

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
  const [isFlipped, setIsFlipped] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const frontRef = useRef<HTMLDivElement>(null);
  const hasBody = hasGoalBody(goal);

  const percent =
    progressMetrics.actions_total > 0
      ? Math.round(
          (progressMetrics.actions_completed / progressMetrics.actions_total) *
            100
        )
      : 0;

  const title = goalTitle(goal);

  // Animate container height to match the active face.
  // ResizeObserver handles body expansion on the front face and edit form on the back.
  useEffect(() => {
    const inner = cardRef.current?.querySelector(".goal-card-flip-inner") as HTMLElement | null;
    if (!inner) return;

    const measure = () => {
      const target = isFlipped ? backRef.current : frontRef.current;
      if (target) {
        inner.style.height = `${target.scrollHeight}px`;
      }
    };

    // Initial measurement after layout
    const frameId = requestAnimationFrame(measure);

    // Watch the active face for size changes (body expand, edit form toggle)
    const activeFace = isFlipped ? backRef.current : frontRef.current;
    let observer: ResizeObserver | undefined;
    if (activeFace) {
      observer = new ResizeObserver(measure);
      observer.observe(activeFace);
    }

    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
    };
  }, [isFlipped, isEditing]);

  // Close the back face when clicking outside
  useEffect(() => {
    if (!isFlipped) return;

    function handlePointerDown(e: PointerEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsFlipped(false);
        setIsEditing(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isFlipped]);

  const handleFlip = useCallback(() => {
    setIsFlipped(true);
  }, []);

  const handleDone = useCallback(() => {
    setIsFlipped(false);
    setIsEditing(false);
  }, []);

  const handleEditClick = useCallback(() => {
    setIsEditing(true);
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

  const handleRemove = useCallback(() => {
    if (onRemove) {
      onRemove();
      setIsFlipped(false);
      setIsEditing(false);
    }
  }, [onRemove]);

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
    <div
      ref={cardRef}
      className={cn(
        "goal-card-flip-container transition-[height] duration-500 ease-in-out",
        isFlipped ? "goal-card-flip-container--flipped" : ""
      )}
    >
      <div className="goal-card-flip-inner">
        {/* ── Front face ─────────────────────────────────────────── */}
        <div
          ref={frontRef}
          aria-hidden={isFlipped}
          className="goal-card-face goal-card-front rounded-lg border border-border bg-background p-3 space-y-2 group/card transition-colors shadow-sm hover:border-foreground/20"
        >
          <FrontFace
            titleRef={titleRef}
            title={title}
            canInteract={canInteract}
            onFlip={handleFlip}
            percent={percent}
            actionsCompleted={progressMetrics.actions_completed}
            actionsTotal={progressMetrics.actions_total}
            progress={progressMetrics.progress}
            hasBody={hasBody}
            body={goal.body}
          />
        </div>

        {/* ── Back face ──────────────────────────────────────────── */}
        <div
          ref={backRef}
          aria-hidden={!isFlipped}
          className="goal-card-face goal-card-back rounded-lg border border-border bg-background p-3 shadow-sm"
        >
          {isEditing ? (
            <GoalEditForm
              initialTitle={goal.title}
              initialBody={goal.body}
              onSave={handleEditSave}
              onCancel={handleEditCancel}
            />
          ) : (
            <BackFace
              title={title}
              body={goal.body}
              hasBody={hasBody}
              onDone={handleDone}
              onEdit={onUpdate ? handleEditClick : undefined}
              onRemove={onRemove ? handleRemove : undefined}
              percent={percent}
              actionsTotal={progressMetrics.actions_total}
              actionsCompleted={progressMetrics.actions_completed}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Front face content ──────────────────────────────────────────────

function FrontFace({
  titleRef,
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
  titleRef: React.RefObject<HTMLSpanElement | null>;
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
  const [showBody, setShowBody] = useState(false);

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <span
          ref={titleRef}
          onClick={hasBody ? () => setShowBody(prev => !prev) : undefined}
          className={cn(
            "text-[13px] font-medium line-clamp-2 min-w-0",
            hasBody && "cursor-pointer"
          )}
        >
          {title}
        </span>
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

      {hasBody && (
        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
            showBody ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <p className="text-[12px] text-muted-foreground/70 leading-relaxed whitespace-pre-wrap border-t border-border/30 pt-2">
            {body}
          </p>
        </div>
      )}
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
