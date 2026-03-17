"use client";

import { useState, useRef, useCallback } from "react";
import { Plus, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/components/lib/utils";
import type { Goal } from "@/types/goal";
import { goalTitle, DEFAULT_MAX_ACTIVE_GOALS } from "@/types/goal";
import { ItemStatus } from "@/types/general";

type PickerView = "search" | "create";

interface GoalPickerProps {
  linkedGoalIds: Set<string>;
  allGoals: Goal[];
  linkedGoals: Goal[];
  onLink: (goalId: string) => void;
  onCreateAndLink: (title: string) => void;
  onCreateAndSwap: (title: string, swapGoalId: string) => void;
  atLimit: boolean;
}

export function GoalPicker({
  linkedGoalIds,
  allGoals,
  linkedGoals,
  onLink,
  onCreateAndLink,
  onCreateAndSwap,
  atLimit,
}: GoalPickerProps) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<PickerView>("search");
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [swapGoalId, setSwapGoalId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLTextAreaElement>(null);

  const availableGoals = allGoals
    .filter((g) => !linkedGoalIds.has(g.id) && g.status === ItemStatus.InProgress)
    .sort((a, b) => a.title.localeCompare(b.title));

  const onHoldGoals = allGoals
    .filter((g) => g.status === ItemStatus.WontDo)
    .sort((a, b) => a.title.localeCompare(b.title));

  const resetCreate = useCallback(() => {
    setView("search");
    setNewGoalTitle("");
    setSwapGoalId(null);
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) resetCreate();
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
  }, [newGoalTitle, atLimit, swapGoalId, onCreateAndSwap, onCreateAndLink, handleOpenChange]);

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
          isExpanded ? "w-[640px]" : "w-72"
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
            <Command className="flex flex-col flex-1 min-h-0">
              <CommandInput placeholder="Search goals..." className="h-9" />
              <CommandList className="max-h-[220px]">
                <CommandEmpty>No goals found.</CommandEmpty>
                {availableGoals.length > 0 && (
                  <CommandGroup heading="Active Goals">
                    {availableGoals.map((goal) => (
                      <CommandItem
                        key={goal.id}
                        value={goal.title}
                        onSelect={() => {
                          if (!atLimit) {
                            onLink(goal.id);
                            handleOpenChange(false);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-2.5 py-2",
                          atLimit && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-800/50 shrink-0" />
                        <span className="truncate flex-1">
                          {goalTitle(goal)}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {onHoldGoals.length > 0 && (
                  <CommandGroup heading="On Hold">
                    {onHoldGoals.map((goal) => (
                      <CommandItem
                        key={goal.id}
                        value={goal.title}
                        onSelect={() => {
                          if (!atLimit) {
                            onLink(goal.id);
                            handleOpenChange(false);
                          }
                        }}
                        className={cn(
                          "flex items-center gap-2.5 py-2",
                          atLimit && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        <Pause className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        <span className="truncate flex-1 text-muted-foreground">
                          {goalTitle(goal)}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1.5 border-border/50 text-muted-foreground/50"
                        >
                          On Hold
                        </Badge>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>

            {/* Create button outside Command so cmdk doesn't swallow the click */}
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
              </button>
            </div>
          </div>

          {/* Right panel: creation form (slides in) */}
          {isExpanded && (
            <>
              <div className="w-px bg-border/30 shrink-0" />
              <div className="flex-1 p-4 min-w-0">
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60 mb-3">
                  New goal
                </p>

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
                    <p className="text-[11px] text-muted-foreground/50 mt-2">
                      Will be linked to this session automatically.
                    </p>
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

                <button
                  type="button"
                  onClick={resetCreate}
                  className="w-full mt-2 text-[11px] text-muted-foreground/50 hover:text-foreground transition-colors py-1"
                >
                  &larr; Back to search
                </button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
