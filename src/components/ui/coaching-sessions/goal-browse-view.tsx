"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/lib/utils";
import { CompactGoalCard } from "@/components/ui/coaching-sessions/goal-card-compact";
import type { Goal } from "@/types/goal";

const RECENT_COUNT = 3;

interface GoalBrowseViewProps {
  availableGoals: Goal[];
  onGoalClick: (goalId: string) => void;
  onCreateNew: () => void;
  onCancel: () => void;
  hint?: string;
}

export function GoalBrowseView({
  availableGoals,
  onGoalClick,
  onCreateNew,
  onCancel,
  hint,
}: GoalBrowseViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const setInputRef = useCallback((el: HTMLInputElement | null) => {
    inputRef.current = el;
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
    <div className="rounded-lg border border-border bg-background p-3 space-y-3">
      {/* Header row: hint text + Create new button */}
      <div className="flex items-start justify-between gap-2">
        {hint && (
          <p className="text-[12px] text-muted-foreground pt-1">{hint}</p>
        )}
        <Button
          size="sm"
          className="h-8 gap-1 text-xs shrink-0"
          onClick={onCreateNew}
        >
          <Plus className="h-3.5 w-3.5" />
          Create new
        </Button>
      </div>

      {/* Search input */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={setInputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search goals..."
          className="w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70"
        />
      </div>

      {/* Goal list */}
      <div className={cn(
        "overflow-y-auto space-y-2",
        showAll ? "max-h-[360px]" : "max-h-[280px]"
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
          className="flex items-center gap-1.5 w-full rounded-md px-2 py-1.5 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <ChevronDown className="h-3 w-3" />
          <span>Show {olderGoals.length} more</span>
        </button>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end pt-2 border-t border-border/30">
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
