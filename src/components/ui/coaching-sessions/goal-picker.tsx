"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { Plus, Pause, ChevronDown, ChevronLeft, ChevronRight, Search, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/components/lib/utils";
import type { Goal } from "@/types/goal";
import { goalTitle, isOnHold, isInProgress, DEFAULT_MAX_ACTIVE_GOALS } from "@/types/goal";
import { ItemStatus } from "@/types/general";

type PickerView = "search" | "create";

interface GoalPickerProps {
  linkedGoalIds: Set<string>;
  allGoals: Goal[];
  linkedGoals: Goal[];
  onLink: (goalId: string) => void;
  onCreateAndLink: (title: string) => void;
  onCreateAndSwap: (title: string, swapGoalId: string) => void;
  onSwapAndLink: (newGoalId: string, swapGoalId: string) => void;
  /** True when the session has max goals linked. */
  atLimit: boolean;
}

export function GoalPicker({
  linkedGoalIds,
  allGoals,
  linkedGoals,
  onLink,
  onCreateAndLink,
  onCreateAndSwap,
  onSwapAndLink,
  atLimit,
}: GoalPickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PickerView>("search");
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [swapGoalId, setSwapGoalId] = useState<string | null>(null);
  const [showAllGoals, setShowAllGoals] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const titleInputRef = useRef<HTMLTextAreaElement>(null);

  const RECENT_COUNT = 3;

  // Show NotStarted and OnHold goals that aren't already linked to this session,
  // sorted by recency in a single unified list
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

  // Filter by search query
  const filteredGoals = useMemo(() => {
    if (!searchQuery.trim()) return availableGoals;
    const q = searchQuery.toLowerCase();
    return availableGoals.filter((g) =>
      g.title.toLowerCase().includes(q)
    );
  }, [availableGoals, searchQuery]);

  const recentGoals = filteredGoals.slice(0, RECENT_COUNT);
  const olderGoals = filteredGoals.slice(RECENT_COUNT);
  const hasMoreGoals = olderGoals.length > 0;
  const noResults = filteredGoals.length === 0;


  const resetCreate = useCallback(() => {
    setView("search");
    setNewGoalTitle("");
    setSwapGoalId(null);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) {
        resetCreate();
        setShowAllGoals(false);
        setSearchQuery("");
      }
    },
    [resetCreate]
  );

  const handleCreateClick = useCallback(() => {
    setView("create");
    requestAnimationFrame(() => titleInputRef.current?.focus());
  }, []);

  const handleCreateSubmit = useCallback(() => {
    const title = newGoalTitle.trim();
    if (!title) return;

    if (atLimit) {
      if (!swapGoalId) return;
      onCreateAndSwap(title, swapGoalId);
    } else {
      onCreateAndLink(title);
    }
    handleOpenChange(false);
  }, [
    newGoalTitle,
    atLimit,
    swapGoalId,
    onCreateAndSwap,
    onCreateAndLink,
    handleOpenChange,
  ]);

  const handleGoalClick = useCallback(
    (goalId: string) => {
      if (atLimit) {
        // At session limit — need a swap target first
        if (!swapGoalId) return;
        onSwapAndLink(goalId, swapGoalId);
      } else {
        onLink(goalId);
      }
      handleOpenChange(false);
    },
    [atLimit, swapGoalId, onLink, onSwapAndLink, handleOpenChange]
  );

  const isExpanded = view === "create";

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
          Link goal
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "p-0 transition-all duration-200 ease-out",
          isExpanded ? "w-[640px]" : "w-72 md:w-80 lg:w-96"
        )}
        align="start"
      >
        <div className="flex">
          {/* Left panel: search list */}
          <div
            className={cn(
              "min-w-0 flex flex-col",
              isExpanded ? "w-[248px] shrink-0" : "flex-1"
            )}
          >
            {/* Swap selector — shown when at session limit */}
            {atLimit && (
              <div className="border-b border-border/30 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground/60 mb-2">
                  All {DEFAULT_MAX_ACTIVE_GOALS} slots used. Select one to replace:
                </p>
                <div className="space-y-1">
                  {linkedGoals.map((goal) => (
                    <button
                      key={goal.id}
                      type="button"
                      onClick={() => setSwapGoalId(goal.id)}
                      className={cn(
                        "flex items-center gap-2.5 w-full text-left rounded-md px-2 py-1.5 text-sm transition-all",
                        swapGoalId === goal.id
                          ? "bg-muted/60 text-foreground"
                          : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                      )}
                    >
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                          swapGoalId === goal.id
                            ? "border-foreground bg-foreground"
                            : "border-muted-foreground/30"
                        )}
                      >
                        {swapGoalId === goal.id && (
                          <div className="h-1.5 w-1.5 rounded-full bg-background" />
                        )}
                      </div>
                      <span className="truncate flex-1">
                        {goalTitle(goal)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Search input */}
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                type="text"
                placeholder="Search goals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {/* Hint */}
            <p className="px-3 py-1.5 text-[11px] text-muted-foreground/50">
              {atLimit
                ? swapGoalId
                  ? "Now select a replacement goal or create a new one"
                  : "Select a goal above to replace, then choose its replacement"
                : "Select a recent goal or create a new one to link to this session"}
            </p>

            {/* Goal list */}
            <div className={cn(
              "overflow-y-auto p-1",
              showAllGoals ? "max-h-[320px]" : "max-h-[220px]",
              atLimit && !swapGoalId && "opacity-40 pointer-events-none"
            )}>
              {noResults && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  No goals found.
                </p>
              )}

              {recentGoals.length > 0 && (
                <GoalGroup heading="Recent">
                  {recentGoals.map((goal) => (
                    <GoalListItem
                      key={goal.id}
                      goal={goal}
                      onClick={() => handleGoalClick(goal.id)}
                    />
                  ))}
                </GoalGroup>
              )}

              {hasMoreGoals && showAllGoals && (
                <GoalGroup heading="More goals">
                  {olderGoals.map((goal) => (
                    <GoalListItem
                      key={goal.id}
                      goal={goal}
                      onClick={() => handleGoalClick(goal.id)}
                    />
                  ))}
                </GoalGroup>
              )}

            </div>

            {/* Show more toggle */}
            {hasMoreGoals && !showAllGoals && !(atLimit && !swapGoalId) && (
              <div className="px-1.5 py-1">
                <button
                  type="button"
                  onClick={() => setShowAllGoals(true)}
                  className="flex items-center gap-1.5 w-full rounded-md px-2 py-1 text-[11px] text-muted-foreground/60 hover:text-foreground hover:bg-muted/30 transition-colors"
                >
                  <ChevronDown className="h-3 w-3" />
                  <span>Show {olderGoals.length} more</span>
                </button>
              </div>
            )}

            {/* Create button */}
            <div className="border-t border-border/30 px-1.5 py-1.5">
              <button
                type="button"
                aria-label="Create new goal"
                onClick={handleCreateClick}
                className={cn(
                  "flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors",
                  isExpanded
                    ? "bg-muted/50 text-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create new goal</span>
                {!isExpanded && <ChevronRight className="h-3.5 w-3.5 ml-auto text-muted-foreground/40" />}
              </button>
            </div>
          </div>

          {/* Right panel: creation form (slides in) */}
          {isExpanded && (
            <>
              <div className="w-px bg-border/30 shrink-0" />
              <div className="flex-1 p-4 min-w-0">
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={resetCreate}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="h-3 w-3" />
                    Back
                  </button>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
                    New goal
                  </p>
                </div>

                <textarea
                  ref={titleInputRef}
                  rows={3}
                  value={newGoalTitle}
                  onChange={(e) => setNewGoalTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                      handleCreateSubmit();
                    if (e.key === "Escape") resetCreate();
                  }}
                  placeholder="I want to ... because I..."
                  className="w-full rounded-lg border border-border/50 bg-background px-3 py-2 text-sm placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-foreground/10 focus:border-border resize-none"
                />

                {atLimit ? (
                  <>
                    {/* At-limit context message + swap selector */}
                    <div className="mt-3 p-2.5 rounded-lg bg-muted/40 border border-border/30">
                      <p className="text-[12px] text-muted-foreground/70 leading-snug">
                        All {DEFAULT_MAX_ACTIVE_GOALS} goal slots are in use.
                        Select one to put on hold.
                      </p>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      {linkedGoals.map((goal) => (
                        <button
                          key={goal.id}
                          type="button"
                          onClick={() => setSwapGoalId(goal.id)}
                          className={cn(
                            "flex items-center gap-2.5 w-full text-left rounded-lg px-3 py-2 text-sm transition-all border",
                            swapGoalId === goal.id
                              ? "border-foreground/20 bg-muted/60"
                              : "border-transparent hover:bg-muted/30"
                          )}
                        >
                          <div
                            className={cn(
                              "h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                              swapGoalId === goal.id
                                ? "border-foreground bg-foreground"
                                : "border-muted-foreground/30"
                            )}
                          >
                            {swapGoalId === goal.id && (
                              <div className="h-1.5 w-1.5 rounded-full bg-background" />
                            )}
                          </div>
                          <span className="truncate flex-1">
                            {goalTitle(goal)}
                          </span>
                          <Pause className="h-3 w-3 text-muted-foreground/30 shrink-0" />
                        </button>
                      ))}
                    </div>

                    <Button
                      size="sm"
                      className="w-full mt-3 h-8 text-xs"
                      disabled={!newGoalTitle.trim() || !swapGoalId}
                      onClick={handleCreateSubmit}
                    >
                      Create &amp; swap
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      size="sm"
                      className="w-full mt-3 h-8 text-xs"
                      disabled={!newGoalTitle.trim()}
                      onClick={handleCreateSubmit}
                    >
                      Create &amp; link
                    </Button>
                  </>
                )}

              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Helper components ───────────────────────────────────────────────────

function GoalGroup({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden p-1">
      <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
        {heading}
      </p>
      {children}
    </div>
  );
}

function GoalListItem({
  goal,
  onClick,
}: {
  goal: Goal;
  onClick: () => void;
}) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const checkTruncation = useCallback(() => {
    const el = textRef.current;
    if (el) {
      setIsTruncated(el.scrollWidth > el.clientWidth);
    }
  }, []);

  const statusLabel = isOnHold(goal)
    ? "On Hold"
    : isInProgress(goal)
      ? "In Progress"
      : "Not Started";

  const content = (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={checkTruncation}
      className="group flex items-start gap-2.5 py-2 px-2 w-full text-left rounded-sm text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <span className={cn(
        "h-1.5 w-1.5 rounded-full shrink-0 mt-1.5",
        isOnHold(goal) ? "bg-amber-500/50" : "bg-emerald-800/50"
      )} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span ref={textRef} className="truncate flex-1">{goalTitle(goal)}</span>
          <Link className="h-3 w-3 shrink-0 text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors" />
        </div>
        <span className="text-[10px] text-muted-foreground/50">
          {statusLabel}
        </span>
      </div>
    </button>
  );

  if (!isTruncated) return content;

  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs max-w-[280px]">
          <p className="font-medium">{goalTitle(goal)}</p>
          <p className="text-muted-foreground mt-0.5">{statusLabel}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
