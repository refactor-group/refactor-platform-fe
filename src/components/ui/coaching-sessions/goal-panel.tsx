"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Plus,
  Search,
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
import { cn } from "@/components/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { GoalChip } from "@/components/ui/coaching-sessions/goal-chip";
import { CompactGoalCard } from "@/components/ui/coaching-sessions/goal-card-compact";
import { GoalCreateForm } from "@/components/ui/coaching-sessions/goal-create-form";
import {
  useGoalsBySession,
  useGoalList,
  useGoalMutation,
  GoalApi,
} from "@/lib/api/goals";
import { useGoalProgress } from "@/lib/api/goal-progress";
import type { Goal } from "@/types/goal";
import {
  defaultGoal,
  DEFAULT_MAX_ACTIVE_GOALS,
  extractActiveGoalLimitError,
  isAtGoalLimit,
} from "@/types/goal";
import type { Id } from "@/types/general";
import { ItemStatus } from "@/types/general";
import { Some } from "@/types/option";

// ── Shared props for both layouts ──────────────────────────────────────

interface GoalPanelSharedProps {
  linkedGoals: Goal[];
  allGoals: Goal[];
  linkedGoalIds: Set<string>;
  atLimit: boolean;
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

enum SlideDirection {
  Forward = "forward",
  Backward = "backward",
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
  const [direction, setDirection] = useState<SlideDirection>(SlideDirection.Forward);

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
    setDirection(SlideDirection.Forward);
    if (atLimit) {
      setFlow({ step: "selecting-swap" });
    } else {
      setFlow({ step: "browsing" });
    }
  }, [atLimit]);

  const handleSwapSelected = useCallback((goalId: string) => {
    setDirection(SlideDirection.Forward);
    setFlow({ step: "browsing", swapGoalId: goalId });
  }, []);

  const handleBrowseGoalClick = useCallback(
    (goalId: string) => {
      setDirection(SlideDirection.Backward);
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
    setDirection(SlideDirection.Forward);
    const swapGoalId = flow.step === "browsing" ? flow.swapGoalId : undefined;
    setFlow({ step: "creating", swapGoalId });
  }, [flow]);

  const handleCreateBack = useCallback(() => {
    setDirection(SlideDirection.Backward);
    const swapGoalId = flow.step === "creating" ? flow.swapGoalId : undefined;
    setFlow({ step: "browsing", swapGoalId });
  }, [flow]);

  const handleFormSubmit = useCallback(
    async (title: string, body?: string) => {
      setDirection(SlideDirection.Backward);
      if (flow.step === "creating" && flow.swapGoalId) {
        await onCreateAndSwap(title, flow.swapGoalId, body);
      } else {
        await onCreateAndLink(title, body);
      }
      setFlow({ step: "idle" });
    },
    [flow, onCreateAndLink, onCreateAndSwap]
  );

  const handleBack = useCallback(() => {
    setDirection(SlideDirection.Backward);
    switch (flow.step) {
      case "creating":
        setFlow({ step: "browsing", swapGoalId: flow.swapGoalId });
        break;
      case "browsing":
        if (flow.swapGoalId) {
          setFlow({ step: "selecting-swap" });
        } else {
          setFlow({ step: "idle" });
        }
        break;
      case "selecting-swap":
        setFlow({ step: "idle" });
        break;
      case "idle":
        break;
      default: {
        const _exhaustive: never = flow;
        throw new Error(`Unhandled flow step: ${(_exhaustive as GoalFlowState).step}`);
      }
    }
  }, [flow]);

  const handleCancel = useCallback(() => {
    setDirection(SlideDirection.Backward);
    setFlow({ step: "idle" });
  }, []);

  return {
    flow,
    direction,
    availableGoals,
    handleBack,
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
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/40"
        />
      </div>

      {/* Goal list */}
      <div className={cn(
        "overflow-y-auto space-y-2",
        showAll ? "max-h-[280px]" : "max-h-[180px]"
      )}>
        {filteredGoals.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground/50">
            No goals found.
          </p>
        ) : (
          <>
            {recentGoals.map((goal) => (
              <CompactGoalCard
                key={goal.id}
                goal={goal}
                onSelect={() => onGoalClick(goal.id)}
              />
            ))}
            {hasMore && showAll &&
              olderGoals.map((goal) => (
                <CompactGoalCard
                  key={goal.id}
                  goal={goal}
                  onSelect={() => onGoalClick(goal.id)}
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
          size="sm"
          className="h-8 gap-1 text-xs"
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

// ── Slide Panel (animate in on mount via CSS) ────────────────────────

function SlidePanel({
  children,
  direction = SlideDirection.Forward,
}: {
  children: React.ReactNode;
  direction?: SlideDirection;
}) {
  return (
    <div className={cn(
      "animate-in fade-in duration-200 fill-mode-both",
      direction === SlideDirection.Forward
        ? "slide-in-from-right-4"
        : "slide-in-from-left-4"
    )}>
      {children}
    </div>
  );
}

// ── Flow Action Buttons (renders the right controls for each state) ───

// ── Goal Flow Pages (shared wizard content for both layouts) ─────────

function GoalFlowPages({
  linkedGoals,
  goalFlow,
  readOnly,
  onUnlink,
  onUpdateGoal,
}: {
  linkedGoals: Goal[];
  goalFlow: ReturnType<typeof useGoalFlow>;
  readOnly: boolean;
  onUnlink: (goalId: string) => void;
  onUpdateGoal: (goalId: string, title: string, body: string) => Promise<void>;
}) {
  const { flow } = goalFlow;

  switch (flow.step) {
    case "idle":
      return (
        <div className="space-y-3">
          {linkedGoals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/50 py-6 px-4 text-center">
              <p className="text-sm text-muted-foreground/50 italic">
                No goals added yet
              </p>
            </div>
          ) : (
            linkedGoals.map((goal) => (
              <CompactGoalCard
                key={goal.id}
                goal={goal}
                onRemove={readOnly ? undefined : () => onUnlink(goal.id)}
                onUpdate={readOnly ? undefined : onUpdateGoal}
              />
            ))
          )}
          {!readOnly && (
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={goalFlow.handleAddGoalClick}
            >
              <Plus className="h-3.5 w-3.5" />
              Add goal
            </Button>
          )}
        </div>
      );

    case "selecting-swap":
      return (
        <SlidePanel direction={goalFlow.direction}>
          <div className="space-y-3">
            <p className="text-[12px] text-muted-foreground/70">
              Which goal should be put on hold?
            </p>
            {linkedGoals.map((goal) => (
              <CompactGoalCard
                key={goal.id}
                goal={goal}
                swapMode={{ onSelect: () => goalFlow.handleSwapSelected(goal.id) }}
              />
            ))}
          </div>
        </SlidePanel>
      );

    case "browsing":
      return (
        <SlidePanel direction={goalFlow.direction}>
          <InlineBrowseView
            availableGoals={goalFlow.availableGoals}
            onGoalClick={goalFlow.handleBrowseGoalClick}
            onCreateNew={goalFlow.handleCreateNewClick}
            onCancel={goalFlow.handleBack}
            hint={flow.swapGoalId
              ? "Choose a replacement or create a new goal"
              : "Choose an existing goal or create a new one"
            }
          />
        </SlidePanel>
      );

    case "creating":
      return (
        <SlidePanel direction={goalFlow.direction}>
          <GoalCreateForm
            onSubmit={goalFlow.handleFormSubmit}
            onCancel={goalFlow.handleBack}
            submitLabel="Save"
          />
        </SlidePanel>
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
}

/** Width the panel expands to during add/create/swap flows (px). */
const EXPANDED_WIDTH = 420;

function GoalsPanelDesktop({
  linkedGoals,
  allGoals,
  linkedGoalIds,
  atLimit,
  onLink,
  onUnlink,
  onCreateAndLink,
  onCreateAndSwap,
  onSwapAndLink,
  onUpdateGoal,
  readOnly = false,
  collapsed = false,
}: GoalsPanelDesktopProps) {
  const panelRef = useRef<HTMLDivElement>(null);
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

  // Dismiss the flow when clicking outside the expanded panel
  useEffect(() => {
    if (flow.step === "idle") return;

    function handlePointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        goalFlow.handleCancel();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [flow.step, goalFlow]);

  if (collapsed) {
    return (
      <div className="hidden md:flex md:flex-col md:items-center md:gap-2 md:pt-3 md:pb-3 md:px-1 h-full rounded-lg border border-border/50 bg-card">
        <span className="text-[11px] font-medium text-muted-foreground [writing-mode:vertical-lr]">
          Goals
        </span>
        {linkedGoals.length > 0 && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
            {linkedGoals.length}/{DEFAULT_MAX_ACTIVE_GOALS}
          </span>
        )}
      </div>
    );
  }

  const isInFlow = flow.step !== "idle";

  const headerTitle = flow.step === "idle" || flow.step === "selecting-swap"
    ? "Goals"
    : flow.step === "browsing"
      ? "Add goal"
      : "New goal";

  return (
    // Wrapper stays in the grid's 300px column; the Card overlays rightward when expanded
    <div ref={panelRef} className="hidden md:block relative">
      <Card
        className={cn(
          "flex flex-col h-full transition-[width,box-shadow] duration-300 ease-in-out",
          isInFlow
            ? "absolute inset-y-0 left-0 z-10 shadow-xl"
            : "relative shadow-sm"
        )}
        style={{ width: isInFlow ? `${EXPANDED_WIDTH}px` : "100%" }}
      >
        <CardHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isInFlow && (
                <button
                  type="button"
                  onClick={goalFlow.handleBack}
                  aria-label="Back"
                  className="rounded-md p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <h3 className="text-sm font-semibold text-foreground">{headerTitle}</h3>
              {flow.step === "idle" && linkedGoals.length > 0 && (
                <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                  {linkedGoals.length}/{DEFAULT_MAX_ACTIVE_GOALS}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3 flex-1 min-h-0 overflow-hidden">
          <GoalFlowPages
            linkedGoals={linkedGoals}
            goalFlow={goalFlow}
            readOnly={readOnly}
            onUnlink={onUnlink}
            onUpdateGoal={onUpdateGoal}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ── Mobile Goals Panel ─────────────────────────────────────────────────

function GoalsPanelMobile({
  linkedGoals,
  allGoals,
  linkedGoalIds,
  atLimit,
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
  const isInFlow = flow.step !== "idle";

  const headerTitle = flow.step === "idle" || flow.step === "selecting-swap"
    ? "Goals"
    : flow.step === "browsing"
      ? "Add goal"
      : "New goal";

  return (
    <Card className="md:hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-3 min-h-[44px] px-4">
          {isInFlow && (
            <button
              type="button"
              onClick={goalFlow.handleBack}
              aria-label="Back"
              className="rounded-md p-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <span className="text-sm font-semibold text-foreground shrink-0">
            {headerTitle}
          </span>
          {flow.step === "idle" && linkedGoals.length > 0 && (
            <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">
              {linkedGoals.length}/{DEFAULT_MAX_ACTIVE_GOALS}
            </span>
          )}
          {!isInFlow && (
            <>
              <div className="flex flex-wrap items-center gap-2 flex-1 py-1">
                {linkedGoals.length === 0 ? (
                  <span className="text-sm text-muted-foreground/50 italic">
                    No goals added yet
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
            </>
          )}
        </div>

        <CollapsibleContent>
          <div className="px-4 pt-1 pb-4 space-y-3">
            <GoalFlowPages
              linkedGoals={linkedGoals}
              goalFlow={goalFlow}
              readOnly={readOnly}
              onUnlink={onUnlink}
              onUpdateGoal={onUpdateGoal}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

// ── Goal Panel (main export) ──────────────────────────────────────────

interface GoalPanelProps {
  coachingSessionId: Id;
  coachingRelationshipId: Id;
  collapsed?: boolean;
  /** When true, goal linkage is immutable (past sessions) */
  readOnly?: boolean;
}

export function GoalPanel({
  coachingSessionId,
  coachingRelationshipId,
  collapsed = false,
  readOnly = false,
}: GoalPanelProps) {
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
    onLink: handleLink,
    onUnlink: handleUnlink,
    onCreateAndLink: handleCreateAndLink,
    onCreateAndSwap: handleCreateAndSwap,
    onSwapAndLink: handleSwapAndLink,
    onUpdateGoal: handleUpdateGoal,
    readOnly,
  };

  return (
    <>
      <GoalsPanelDesktop
        {...sharedProps}
        collapsed={collapsed}
      />
      <GoalsPanelMobile {...sharedProps} />
    </>
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
