"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  Link,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Pause,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/components/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { GoalChip } from "@/components/ui/coaching-sessions/goal-chip";
import { GoalProgressIcon } from "@/components/ui/coaching-sessions/goal-progress-icon";
import {
  useGoalsBySession,
  useGoalList,
  useGoalMutation,
  GoalApi,
} from "@/lib/api/goals";
import { useGoalProgress } from "@/lib/api/goal-progress";
import type { Goal } from "@/types/goal";
import {
  goalTitle,
  defaultGoal,
  DEFAULT_MAX_ACTIVE_GOALS,
  extractActiveGoalLimitError,
  isAtGoalLimit,
  isOnHold,
  isInProgress,
  hasGoalBody,
} from "@/types/goal";
import type { Id } from "@/types/general";
import { ItemStatus } from "@/types/general";
import { GoalProgress } from "@/types/goal-progress";
import type { GoalProgressMetrics } from "@/types/goal-progress";
import { Some } from "@/types/option";

// ── Health signal helpers ──────────────────────────────────────────────

function progressDotColor(progress: GoalProgress): string {
  switch (progress) {
    case GoalProgress.SolidMomentum:
      return "bg-emerald-800/50";
    case GoalProgress.NeedsAttention:
      return "bg-amber-500/60";
    case GoalProgress.LetsRefocus:
      return "bg-rose-500/50";
    default: {
      const _exhaustive: never = progress;
      throw new Error(`Unhandled GoalProgress: ${_exhaustive}`);
    }
  }
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

// ── Compact Goal Card (used in both desktop panel and mobile expanded) ─

interface CompactGoalCardProps {
  goal: Goal;
  onRemove?: () => void;
  onUpdate?: (goalId: string, title: string, body: string) => Promise<void>;
  /** When set, card shows a "put on hold" affordance instead of normal interactions */
  swapMode?: {
    onSelect: () => void;
  };
  /** When true, card shows a visual indicator that it will be put on hold */
  pendingHold?: boolean;
}

function CompactGoalCard({ goal, onRemove, onUpdate, swapMode, pendingHold }: CompactGoalCardProps) {
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
      <InlineEditForm
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
      className="w-full text-left rounded-lg border border-border/50 bg-background p-3 space-y-2 transition-all hover:border-amber-500/50 hover:bg-amber-50/30 cursor-pointer group/card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full shrink-0 mt-1.5",
              progressDotColor(progressMetrics.progress)
            )}
          />
          <span ref={titleRef} className="text-[13px] font-medium line-clamp-2">
            {title}
          </span>
        </div>
        <Pause className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/card:text-amber-600 shrink-0 mt-0.5 transition-colors" />
      </div>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground/60">
        <span>{progressLabel(progressMetrics.progress)}</span>
        <span className="text-muted-foreground/0 group-hover/card:text-amber-600/70 transition-colors">
          Put on hold
        </span>
      </div>
    </button>
  ) : (
    <div
      onMouseEnter={checkTruncation}
      onClick={hasBody ? () => setShowBody(!showBody) : undefined}
      className={cn(
        "rounded-lg border p-3 space-y-2 group/card transition-colors",
        pendingHold
          ? "border-amber-300/60 bg-amber-50/30"
          : "border-border/50 bg-background hover:border-border",
        hasBody && !pendingHold && "cursor-pointer"
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
            <Pause className="h-3 w-3 text-amber-600/70" />
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
                <button
                  type="button"
                  aria-label={`Remove ${title}`}
                  onClick={(e) => { e.stopPropagation(); onRemove(); }}
                  className="rounded-md p-0.5 text-muted-foreground/0 group-hover/card:text-muted-foreground/40 hover:!text-destructive hover:!bg-destructive/10 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
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
          <span className="text-amber-600/60 italic mr-auto">Will be put on hold</span>
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

// ── Inline Create Form ─────────────────────────────────────────────────

interface InlineCreateFormProps {
  onSubmit: (title: string, body?: string) => void;
  onCancel: () => void;
  /** Label for the submit button */
  submitLabel: string;
}

function InlineCreateForm({
  onSubmit,
  onCancel,
  submitLabel,
}: InlineCreateFormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [showBody, setShowBody] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  const setInputRef = useCallback((el: HTMLInputElement | null) => {
    (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    if (el) el.focus();
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) return;

    const trimmedBody = body.trim() || undefined;
    await onSubmit(trimmed, trimmedBody);
  }, [title, body, onSubmit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [handleSubmit, onCancel]
  );

  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-2">
      <input
        ref={setInputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="What do you want to achieve?"
        className="w-full rounded-md border border-border/50 bg-background px-2 py-1.5 text-[13px] font-medium placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-border"
      />

      {showBody ? (
        <textarea
          rows={3}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add detail to your goal..."
          className="w-full rounded-md border border-border/50 bg-background px-2 py-1.5 text-[12px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-border resize-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowBody(true)}
          className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
        >
          + Add a goal description
        </button>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1 h-8 text-xs"
          disabled={!title.trim()}
          onClick={handleSubmit}
        >
          {submitLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Inline Edit Form ──────────────────────────────────────────────────

interface InlineEditFormProps {
  initialTitle: string;
  initialBody: string;
  onSave: (title: string, body: string) => Promise<void>;
  onCancel: () => void;
}

function InlineEditForm({
  initialTitle,
  initialBody,
  onSave,
  onCancel,
}: InlineEditFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const inputRef = useRef<HTMLInputElement>(null);

  const setInputRef = useCallback((el: HTMLInputElement | null) => {
    (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const hasChanges =
    title.trim() !== initialTitle || body !== initialBody;

  const handleSave = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    await onSave(trimmed, body);
  }, [title, body, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (hasChanges) handleSave();
      }
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [handleSave, hasChanges, onCancel]
  );

  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-2">
      <input
        ref={setInputRef}
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Goal title"
        className="w-full rounded-md border border-border/50 bg-background px-2 py-1.5 text-[13px] font-medium placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-border"
      />

      <textarea
        rows={4}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add detail to your goal..."
        className="w-full rounded-md border border-border/50 bg-background px-2 py-1.5 text-[12px] placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-border resize-none"
      />

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="flex-1 h-8 text-xs"
          disabled={!title.trim() || !hasChanges}
          onClick={handleSave}
        >
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Full Goal Progress Card (used in mobile expanded view) ─────────────

interface GoalProgressCardProps {
  goal: Goal;
}

function GoalProgressCard({ goal }: GoalProgressCardProps) {
  const { progressMetrics } = useGoalProgress(Some(goal.id));

  const percent =
    progressMetrics.actions_total > 0
      ? Math.round(
          (progressMetrics.actions_completed / progressMetrics.actions_total) *
            100
        )
      : 0;
  const remaining =
    progressMetrics.actions_total - progressMetrics.actions_completed;

  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 overflow-hidden transition-colors hover:border-border">
      <div className="flex flex-col md:flex-row">
        {/* Left panel — goal summary */}
        <div className="flex-1 p-4 space-y-3 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full shrink-0",
                  progressDotColor(progressMetrics.progress)
                )}
              />
              <span className="text-[13px] font-medium truncate">
                {goalTitle(goal)}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground/60 shrink-0">
              {progressLabel(progressMetrics.progress)}
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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {progressMetrics.actions_total > 0 ? (
              <>
                <span>
                  {remaining} action{remaining !== 1 ? "s" : ""} remaining
                </span>
                <span className="text-muted-foreground/30">&middot;</span>
                <span>{percent}% complete</span>
              </>
            ) : (
              <span className="italic text-muted-foreground/50">
                No actions yet
              </span>
            )}
          </div>

          <p className="text-[11px] text-muted-foreground/50">
            {progressMetrics.linked_session_count > 0
              ? `${progressMetrics.linked_session_count} session${progressMetrics.linked_session_count !== 1 ? "s" : ""}`
              : "Not discussed yet"}
            {progressMetrics.last_session_date.some && (
              <span> &middot; Last discussed {progressMetrics.last_session_date.val}</span>
            )}
          </p>
        </div>

        {/* Divider — vertical on desktop, horizontal on mobile */}
        <div className="h-px md:h-auto md:w-px bg-border/30 shrink-0" />

        {/* Right panel — actions for review */}
        <div className="flex-1 p-4 min-w-0">
          <div className="flex items-center justify-between mb-2.5">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Actions for review
            </p>
          </div>
          {progressMetrics.actions_total === 0 ? (
            <p className="text-xs text-muted-foreground/40 italic">
              No actions yet
            </p>
          ) : (
            <p className="text-xs text-muted-foreground/50">
              {progressMetrics.actions_completed} of{" "}
              {progressMetrics.actions_total} actions completed
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared props for both layouts ──────────────────────────────────────

interface GoalPanelSharedProps {
  linkedGoals: Goal[];
  allGoals: Goal[];
  linkedGoalIds: Set<string>;
  atLimit: boolean;
  inProgressGoals: Goal[];
  onLink: (goalId: string) => void;
  onUnlink: (goalId: string) => void;
  onCreateAndLink: (title: string, body?: string) => void;
  onCreateAndSwap: (title: string, swapGoalId: string, body?: string) => void;
  onSwapAndLink: (newGoalId: string, swapGoalId: string) => void;
  onUpdateGoal: (goalId: string, title: string, body: string) => Promise<void>;
  /** When true, goal linkage is immutable (past sessions) */
  readOnly?: boolean;
}

// ── Goal Flow State Machine ────────────────────────────────────────────

type GoalFlowState =
  | { step: "idle" }
  | { step: "selecting-swap" }
  | { step: "browsing"; swapGoalId?: string }
  | { step: "creating"; swapGoalId?: string };

interface GoalFlowCallbacks {
  atLimit: boolean;
  allGoals: Goal[];
  linkedGoalIds: Set<string>;
  onLink: (goalId: string) => void;
  onSwapAndLink: (newGoalId: string, swapGoalId: string) => void;
  onCreateAndLink: (title: string, body?: string) => void;
  onCreateAndSwap: (title: string, swapGoalId: string, body?: string) => void;
}

function useGoalFlow({
  atLimit,
  allGoals,
  linkedGoalIds,
  onLink,
  onSwapAndLink,
  onCreateAndLink,
  onCreateAndSwap,
}: GoalFlowCallbacks) {
  const [flow, setFlow] = useState<GoalFlowState>({ step: "idle" });

  const availableGoals = useMemo(
    () =>
      allGoals
        .filter(
          (g) =>
            !linkedGoalIds.has(g.id) &&
            g.status !== ItemStatus.Completed &&
            g.status !== ItemStatus.WontDo
        )
        .sort(
          (a, b) =>
            new Date(String(b.created_at)).getTime() -
            new Date(String(a.created_at)).getTime()
        ),
    [allGoals, linkedGoalIds]
  );

  const handleAddGoalClick = useCallback(() => {
    if (atLimit) {
      setFlow({ step: "selecting-swap" });
    } else {
      setFlow({ step: "browsing" });
    }
  }, [atLimit]);

  const handleSwapSelected = useCallback((goalId: string) => {
    setFlow({ step: "browsing", swapGoalId: goalId });
  }, []);

  const handleBrowseGoalClick = useCallback(
    (goalId: string) => {
      if (flow.step === "browsing" && flow.swapGoalId) {
        onSwapAndLink(goalId, flow.swapGoalId);
      } else {
        onLink(goalId);
      }
      setFlow({ step: "idle" });
    },
    [flow, onLink, onSwapAndLink]
  );

  const handleCreateNewClick = useCallback(() => {
    const swapGoalId = flow.step === "browsing" ? flow.swapGoalId : undefined;
    setFlow({ step: "creating", swapGoalId });
  }, [flow]);

  const handleCreateBack = useCallback(() => {
    const swapGoalId = flow.step === "creating" ? flow.swapGoalId : undefined;
    setFlow({ step: "browsing", swapGoalId });
  }, [flow]);

  const handleFormSubmit = useCallback(
    async (title: string, body?: string) => {
      if (flow.step === "creating" && flow.swapGoalId) {
        await onCreateAndSwap(title, flow.swapGoalId, body);
      } else {
        await onCreateAndLink(title, body);
      }
      setFlow({ step: "idle" });
    },
    [flow, onCreateAndLink, onCreateAndSwap]
  );

  const handleCancel = useCallback(() => {
    setFlow({ step: "idle" });
  }, []);

  return {
    flow,
    availableGoals,
    handleAddGoalClick,
    handleSwapSelected,
    handleBrowseGoalClick,
    handleCreateNewClick,
    handleCreateBack,
    handleFormSubmit,
    handleCancel,
  };
}

// ── Inline Browse View ────────────────────────────────────────────────

const RECENT_COUNT = 3;

interface InlineBrowseViewProps {
  availableGoals: Goal[];
  onGoalClick: (goalId: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
  hint?: string;
}

function InlineBrowseView({
  availableGoals,
  onGoalClick,
  onCreateNew,
  onCancel,
  hint,
}: InlineBrowseViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const setInputRef = useCallback((el: HTMLInputElement | null) => {
    (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    if (el) el.focus();
  }, []);

  const filteredGoals = useMemo(() => {
    if (!searchQuery.trim()) return availableGoals;
    const q = searchQuery.toLowerCase();
    return availableGoals.filter((g) =>
      g.title.toLowerCase().includes(q)
    );
  }, [availableGoals, searchQuery]);

  const recentGoals = filteredGoals.slice(0, RECENT_COUNT);
  const olderGoals = filteredGoals.slice(RECENT_COUNT);
  const hasMore = olderGoals.length > 0;

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [onCancel]
  );

  return (
    <div className="rounded-lg border border-border bg-background p-3 space-y-2">
      {hint && (
        <p className="text-[11px] text-muted-foreground/60">{hint}</p>
      )}

      {/* Search input */}
      <div className="flex items-center gap-2 rounded-md border border-border/50 bg-background px-3 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        <input
          ref={setInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search goals..."
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/40"
        />
      </div>

      {/* Goal list */}
      <div className={cn(
        "overflow-y-auto -mx-1",
        showAll ? "max-h-[280px]" : "max-h-[180px]"
      )}>
        {filteredGoals.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground/50">
            No goals found.
          </p>
        ) : (
          <>
            {recentGoals.map((goal) => (
              <BrowseGoalItem
                key={goal.id}
                goal={goal}
                onClick={() => onGoalClick(goal.id)}
              />
            ))}
            {hasMore && showAll &&
              olderGoals.map((goal) => (
                <BrowseGoalItem
                  key={goal.id}
                  goal={goal}
                  onClick={() => onGoalClick(goal.id)}
                />
              ))
            }
          </>
        )}
      </div>

      {/* Show more toggle */}
      {hasMore && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="flex items-center gap-1.5 w-full rounded-md px-2 py-1 text-[11px] text-muted-foreground/60 hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <ChevronDown className="h-3 w-3" />
          <span>Show {olderGoals.length} more</span>
        </button>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/30">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={onCreateNew}
        >
          <Plus className="h-3.5 w-3.5" />
          Create new
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

function BrowseGoalItem({
  goal,
  onClick,
}: {
  goal: Goal;
  onClick: () => void;
}) {
  const statusLabel = isOnHold(goal)
    ? "On Hold"
    : isInProgress(goal)
      ? "In Progress"
      : "Not Started";

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-start gap-2.5 py-2 px-2 w-full text-left rounded-md text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <span className={cn(
        "h-1.5 w-1.5 rounded-full shrink-0 mt-1.5",
        isOnHold(goal) ? "bg-amber-500/50" : "bg-emerald-800/50"
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate flex-1 text-[13px]">{goalTitle(goal)}</span>
          <Link className="h-3 w-3 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors" />
        </div>
        <span className="text-[10px] text-muted-foreground/50">
          {statusLabel}
        </span>
      </div>
    </button>
  );
}

// ── Flow Action Buttons (renders the right controls for each state) ───

function FlowActions({
  flow,
  readOnly,
  handlers,
  availableGoals,
}: {
  flow: GoalFlowState;
  readOnly: boolean;
  handlers: ReturnType<typeof useGoalFlow>;
  availableGoals: Goal[];
}) {
  if (readOnly) return null;

  switch (flow.step) {
    case "idle":
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
          onClick={handlers.handleAddGoalClick}
        >
          <Plus className="h-3.5 w-3.5" />
          Add goal
        </Button>
      );

    case "selecting-swap":
      return (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-muted-foreground"
          onClick={handlers.handleCancel}
        >
          Cancel
        </Button>
      );

    case "browsing":
      return (
        <InlineBrowseView
          availableGoals={availableGoals}
          onGoalClick={handlers.handleBrowseGoalClick}
          onCreateNew={handlers.handleCreateNewClick}
          onCancel={handlers.handleCancel}
          hint={flow.swapGoalId
            ? "Select a replacement goal or create a new one"
            : "Select a goal to link to this session"
          }
        />
      );

    case "creating":
      return (
        <div className="space-y-2">
          <InlineCreateForm
            onSubmit={handlers.handleFormSubmit}
            onCancel={flow.swapGoalId ? handlers.handleCreateBack : handlers.handleCancel}
            submitLabel="Save"
          />
        </div>
      );

    default: {
      const _exhaustive: never = flow;
      throw new Error(`Unhandled flow step: ${(_exhaustive as GoalFlowState).step}`);
    }
  }
}

// ── Desktop Goals Panel ────────────────────────────────────────────────

interface GoalsPanelDesktopProps extends GoalPanelSharedProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

function GoalsPanelDesktop({
  linkedGoals,
  allGoals,
  linkedGoalIds,
  atLimit,
  inProgressGoals,
  onLink,
  onUnlink,
  onCreateAndLink,
  onCreateAndSwap,
  onSwapAndLink,
  onUpdateGoal,
  readOnly = false,
  collapsed = false,
  onCollapsedChange,
}: GoalsPanelDesktopProps) {
  const goalFlow = useGoalFlow({
    atLimit,
    allGoals,
    linkedGoalIds,
    onLink,
    onSwapAndLink,
    onCreateAndLink,
    onCreateAndSwap,
  });

  const { flow } = goalFlow;

  if (collapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onCollapsedChange?.(false)}
              aria-label="Expand goals panel"
              className="hidden md:flex md:flex-col md:items-center md:gap-2 md:pt-3 md:pb-3 md:px-1 h-full rounded-lg border border-border/50 bg-card hover:bg-accent cursor-pointer transition-colors"
            >
              <PanelLeftOpen className="h-4 w-4 text-muted-foreground" />
              <span className="text-[11px] font-medium text-muted-foreground [writing-mode:vertical-lr]">
                Goals
              </span>
              {linkedGoals.length > 0 && (
                <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                  {linkedGoals.length}/{DEFAULT_MAX_ACTIVE_GOALS}
                </span>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Expand goals</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card className="hidden md:flex md:flex-col h-full">
      <CardHeader className="p-4 pb-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Goals</h3>
            {linkedGoals.length > 0 && (
              <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                {linkedGoals.length}/{DEFAULT_MAX_ACTIVE_GOALS}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-foreground"
                    onClick={() => onCollapsedChange?.(true)}
                    aria-label="Collapse goals panel"
                  >
                    <PanelLeftClose className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Collapse goals</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {flow.step === "selecting-swap" && (
          <p className="text-[12px] text-muted-foreground/70">
            Which goal should be put on hold?
          </p>
        )}

        {linkedGoals.length === 0 && flow.step === "idle" && (
          <div className="rounded-lg border border-dashed border-border/50 py-6 px-4 text-center">
            <p className="text-sm text-muted-foreground/50 italic">
              No goals set for this session
            </p>
          </div>
        )}

        {linkedGoals.length > 0 &&
          linkedGoals.map((goal) => (
            <CompactGoalCard
              key={goal.id}
              goal={goal}
              onRemove={readOnly ? undefined : () => onUnlink(goal.id)}
              onUpdate={readOnly ? undefined : onUpdateGoal}
              swapMode={flow.step === "selecting-swap"
                ? { onSelect: () => goalFlow.handleSwapSelected(goal.id) }
                : undefined
              }
              pendingHold={
                (flow.step === "browsing" || flow.step === "creating") &&
                flow.swapGoalId === goal.id
              }
            />
          ))
        }

        <FlowActions
          flow={flow}
          readOnly={readOnly}
          handlers={goalFlow}
          availableGoals={goalFlow.availableGoals}
        />
      </CardContent>
    </Card>
  );
}

// ── Mobile Goals Panel ─────────────────────────────────────────────────

function GoalsPanelMobile({
  linkedGoals,
  allGoals,
  linkedGoalIds,
  atLimit,
  inProgressGoals,
  onLink,
  onUnlink,
  onCreateAndLink,
  onCreateAndSwap,
  onSwapAndLink,
  onUpdateGoal,
  readOnly = false,
}: GoalPanelSharedProps) {
  const [isOpen, setIsOpen] = useState(false);
  const goalFlow = useGoalFlow({
    atLimit,
    allGoals,
    linkedGoalIds,
    onLink,
    onSwapAndLink,
    onCreateAndLink,
    onCreateAndSwap,
  });

  const { flow } = goalFlow;

  return (
    <Card className="md:hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-3 min-h-[44px] px-4">
          <span className="text-sm font-semibold text-foreground shrink-0">
            Goals
          </span>
          {linkedGoals.length > 0 && (
            <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">
              {linkedGoals.length}/{DEFAULT_MAX_ACTIVE_GOALS}
            </span>
          )}
          <div className="flex flex-wrap items-center gap-2 flex-1 py-1">
            {linkedGoals.length === 0 ? (
              <span className="text-sm text-muted-foreground/50 italic">
                No goals set for this session
              </span>
            ) : (
              linkedGoals.map((goal) => (
                <GoalChipWithProgress
                  key={goal.id}
                  goal={goal}
                  onRemove={readOnly ? undefined : () => onUnlink(goal.id)}
                />
              ))
            )}
          </div>

          <div className="flex items-center shrink-0">
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label={isOpen ? "Collapse goals" : "Expand goals"}
              >
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <div className="px-4 pt-1 pb-4 space-y-3">
            {flow.step === "selecting-swap" && (
              <p className="text-[12px] text-muted-foreground/70">
                Which goal should be put on hold?
              </p>
            )}

            {linkedGoals.length === 0 && flow.step === "idle" && (
              <p className="text-sm text-muted-foreground/50 italic py-2">
                Set a goal to see its progress here.
              </p>
            )}

            {linkedGoals.length > 0 &&
              linkedGoals.map((goal) =>
                flow.step === "selecting-swap" ||
                ((flow.step === "browsing" || flow.step === "creating") && flow.swapGoalId) ? (
                  <CompactGoalCard
                    key={goal.id}
                    goal={goal}
                    onRemove={readOnly ? undefined : () => onUnlink(goal.id)}
                    swapMode={flow.step === "selecting-swap"
                      ? { onSelect: () => goalFlow.handleSwapSelected(goal.id) }
                      : undefined
                    }
                    pendingHold={
                      (flow.step === "browsing" || flow.step === "creating") &&
                      flow.swapGoalId === goal.id
                    }
                  />
                ) : (
                  <GoalProgressCard key={goal.id} goal={goal} />
                )
              )
            }

            <FlowActions
              flow={flow}
              readOnly={readOnly}
              handlers={goalFlow}
              availableGoals={goalFlow.availableGoals}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ── Goal Drawer (main export) ──────────────────────────────────────────

interface GoalDrawerProps {
  coachingSessionId: Id;
  coachingRelationshipId: Id;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  hidden?: boolean;
  /** When true, goal linkage is immutable (past sessions) */
  readOnly?: boolean;
}

export function GoalDrawer({
  coachingSessionId,
  coachingRelationshipId,
  collapsed = false,
  onCollapsedChange,
  hidden = false,
  readOnly = false,
}: GoalDrawerProps) {
  const { goals: linkedGoals, refresh: refreshSessionGoals } =
    useGoalsBySession(coachingSessionId);
  const { goals: allGoals, refresh: refreshAllGoals } =
    useGoalList(coachingRelationshipId);
  const { create: createGoal, update: updateGoal } = useGoalMutation();

  const linkedGoalIds = new Set(linkedGoals.map((g) => g.id));
  const inProgressGoals = allGoals.filter((g) => g.status === ItemStatus.InProgress);
  const atLimit = isAtGoalLimit(inProgressGoals, linkedGoals);

  const handleLink = useCallback(
    async (goalId: string) => {
      // If the goal is OnHold, transition it to InProgress before linking
      const goal = allGoals.find((g) => g.id === goalId);
      if (goal && goal.status === ItemStatus.OnHold) {
        try {
          await updateGoal(goalId, { ...goal, status: ItemStatus.InProgress });
        } catch (err) {
          const limitInfo = extractActiveGoalLimitError(err);
          if (limitInfo) {
            toast({
              variant: "destructive",
              title: "Goal limit reached",
              description: `You already have ${limitInfo.maxActiveGoals} goals in progress. Please complete or change the status of one before starting another.`,
            });
          } else {
            console.error("Failed to activate goal:", err);
          }
          return;
        }
      }

      const result = await GoalApi.linkToSession(coachingSessionId, goalId);
      result.match(
        () => {
          refreshSessionGoals();
          refreshAllGoals();
        },
        (err) => {
          console.error("Failed to link goal:", err);
          toast({
            variant: "destructive",
            title: "Failed to link goal",
            description: err.message,
          });
        }
      );
    },
    [coachingSessionId, allGoals, updateGoal, refreshSessionGoals, refreshAllGoals]
  );

  const handleUnlink = useCallback(
    async (goalId: string) => {
      const result = await GoalApi.unlinkFromSession(
        coachingSessionId,
        goalId
      );
      result.match(
        async () => {
          // Auto-hold the goal when unlinking from a current/future session
          if (!readOnly) {
            const goal = allGoals.find((g) => g.id === goalId);
            if (goal && goal.status === ItemStatus.InProgress) {
              try {
                await updateGoal(goalId, { ...goal, status: ItemStatus.OnHold });
              } catch (err) {
                console.error("Failed to put goal on hold after unlink:", err);
              }
            }
          }
          refreshSessionGoals();
          refreshAllGoals();
        },
        (err) => {
          console.error("Failed to unlink goal:", err);
          toast({
            variant: "destructive",
            title: "Failed to unlink goal",
            description: err.message,
          });
        }
      );
    },
    [coachingSessionId, readOnly, allGoals, updateGoal, refreshSessionGoals, refreshAllGoals]
  );

  const handleCreateAndLink = useCallback(
    async (title: string, body?: string) => {
      try {
        const newGoal = defaultGoal();
        newGoal.coaching_relationship_id = coachingRelationshipId;
        newGoal.created_in_session_id = coachingSessionId;
        newGoal.title = title;
        if (body) newGoal.body = body;
        newGoal.status = ItemStatus.InProgress;

        await createGoal(newGoal);
        refreshSessionGoals();
        refreshAllGoals();
      } catch (err) {
        const limitInfo = extractActiveGoalLimitError(err);
        if (limitInfo) {
          toast({
            variant: "destructive",
            title: "Goal limit reached",
            description: `You already have ${limitInfo.maxActiveGoals} goals in progress. Please complete or change the status of one before starting another.`,
          });
        } else {
          console.error("Failed to create goal:", err);
        }
      }
    },
    [
      coachingRelationshipId,
      coachingSessionId,
      createGoal,
      refreshSessionGoals,
      refreshAllGoals,
    ]
  );

  const handleCreateAndSwap = useCallback(
    async (title: string, swapGoalId: string, body?: string) => {
      try {
        // 1. Put the swapped goal on hold
        const swapGoal = allGoals.find((g) => g.id === swapGoalId);
        if (swapGoal) {
          await updateGoal(swapGoalId, {
            ...swapGoal,
            status: ItemStatus.OnHold,
          });
        }

        // 2. Unlink the swapped goal from this session (only if it's linked here)
        if (linkedGoalIds.has(swapGoalId)) {
          const unlinkResult = await GoalApi.unlinkFromSession(coachingSessionId, swapGoalId);
          if (unlinkResult.isErr()) {
            console.error("Failed to unlink goal during swap:", unlinkResult.error);
            toast({
              variant: "destructive",
              title: "Failed to swap goal",
              description: unlinkResult.error.message,
            });
            return;
          }
        }

        // 3. Create the new goal (backend auto-links via created_in_session_id)
        const newGoal = defaultGoal();
        newGoal.coaching_relationship_id = coachingRelationshipId;
        newGoal.created_in_session_id = coachingSessionId;
        newGoal.title = title;
        if (body) newGoal.body = body;
        newGoal.status = ItemStatus.InProgress;

        await createGoal(newGoal);

        refreshSessionGoals();
        refreshAllGoals();
      } catch (err) {
        console.error("Failed to create and swap goal:", err);
        toast({
          variant: "destructive",
          title: "Failed to swap goal",
          description: "An error occurred while swapping goals.",
        });
      }
    },
    [
      allGoals,
      linkedGoalIds,
      coachingSessionId,
      coachingRelationshipId,
      createGoal,
      updateGoal,
      refreshSessionGoals,
      refreshAllGoals,
    ]
  );

  const handleSwapAndLink = useCallback(
    async (newGoalId: string, swapGoalId: string) => {
      try {
        // 1. Put the swapped goal on hold
        const swapGoal = allGoals.find((g) => g.id === swapGoalId);
        if (swapGoal) {
          await updateGoal(swapGoalId, {
            ...swapGoal,
            status: ItemStatus.OnHold,
          });
        }

        // 2. Unlink the swapped goal from this session (only if it's linked here)
        if (linkedGoalIds.has(swapGoalId)) {
          const unlinkResult = await GoalApi.unlinkFromSession(coachingSessionId, swapGoalId);
          if (unlinkResult.isErr()) {
            console.error("Failed to unlink goal during swap:", unlinkResult.error);
            toast({
              variant: "destructive",
              title: "Failed to swap goal",
              description: unlinkResult.error.message,
            });
            return;
          }
        }

        // 3. Link the replacement goal
        const linkResult = await GoalApi.linkToSession(coachingSessionId, newGoalId);
        if (linkResult.isErr()) {
          console.error("Failed to link replacement goal:", linkResult.error);
          toast({
            variant: "destructive",
            title: "Failed to link replacement goal",
            description: linkResult.error.message,
          });
          return;
        }

        refreshSessionGoals();
        refreshAllGoals();
      } catch (err) {
        console.error("Failed to swap and link goal:", err);
        toast({
          variant: "destructive",
          title: "Failed to swap goal",
          description: "An error occurred while swapping goals.",
        });
      }
    },
    [
      allGoals,
      linkedGoalIds,
      coachingSessionId,
      updateGoal,
      refreshSessionGoals,
      refreshAllGoals,
    ]
  );

  const handleUpdateGoal = useCallback(
    async (goalId: string, title: string, body: string) => {
      const goal = allGoals.find((g) => g.id === goalId);
      if (!goal) return;
      try {
        await updateGoal(goalId, { ...goal, title, body });
        refreshSessionGoals();
        refreshAllGoals();
      } catch (err) {
        console.error("Failed to update goal:", err);
        toast({
          variant: "destructive",
          title: "Failed to update goal",
          description: "An error occurred while saving changes.",
        });
      }
    },
    [allGoals, updateGoal, refreshSessionGoals, refreshAllGoals]
  );

  const sharedProps: GoalPanelSharedProps = {
    linkedGoals,
    allGoals,
    linkedGoalIds,
    atLimit,
    inProgressGoals,
    onLink: handleLink,
    onUnlink: handleUnlink,
    onCreateAndLink: handleCreateAndLink,
    onCreateAndSwap: handleCreateAndSwap,
    onSwapAndLink: handleSwapAndLink,
    onUpdateGoal: handleUpdateGoal,
    readOnly,
  };

  return (
    <div className={cn(
      "transition-[opacity,max-width] duration-300 ease-in-out overflow-hidden",
      hidden ? "max-w-0 opacity-0" : "max-w-[300px] opacity-100"
    )}>
      <GoalsPanelDesktop
        {...sharedProps}
        collapsed={collapsed}
        onCollapsedChange={onCollapsedChange}
      />
      <GoalsPanelMobile {...sharedProps} />
    </div>
  );
}

// ── GoalChip wrapper that fetches its own progress ─────────────────────

function GoalChipWithProgress({
  goal,
  onRemove,
}: {
  goal: Goal;
  onRemove?: () => void;
}) {
  const { progressMetrics } = useGoalProgress(Some(goal.id));

  return (
    <GoalChip
      goal={goal}
      actionsCompleted={progressMetrics.actions_completed}
      actionsTotal={progressMetrics.actions_total}
      onRemove={onRemove}
    />
  );
}
