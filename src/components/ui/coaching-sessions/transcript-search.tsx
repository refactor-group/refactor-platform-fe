"use client";

import { ChevronDown, ChevronUp, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/lib/utils";

interface TranscriptSearchProps {
  query: string;
  onQueryChange: (query: string) => void;
  totalMatches: number;
  /** Zero-based index of the currently-focused match. */
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
  onClear: () => void;
  placeholder?: string;
}

/**
 * Presentational search input with navigate-mode match controls:
 *
 *   [🔍 query input........] [n/m] [↑] [↓] [✕]
 *
 * Keyboard:
 *   - Enter       → next match
 *   - Shift+Enter → previous match
 *   - Escape      → clear query
 *
 * All state is driven externally; this component owns nothing.
 */
export function TranscriptSearch({
  query,
  onQueryChange,
  totalMatches,
  activeIndex,
  onPrev,
  onNext,
  onClear,
  placeholder = "Search transcript",
}: TranscriptSearchProps) {
  const hasQuery = query.length > 0;
  const hasMatches = totalMatches > 0;
  const counter = formatCounter(hasMatches, activeIndex, totalMatches);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey) onPrev();
      else onNext();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClear();
    }
  };

  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "w-full h-9 pl-9 rounded-lg bg-muted/70 border-0 text-sm placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring/30",
          hasQuery ? "pr-40" : "pr-3"
        )}
      />
      {hasQuery && (
        <SearchControls
          counter={counter}
          hasMatches={hasMatches}
          onPrev={onPrev}
          onNext={onNext}
          onClear={onClear}
        />
      )}
    </div>
  );
}

interface SearchControlsProps {
  counter: string;
  hasMatches: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClear: () => void;
}

function SearchControls({
  counter,
  hasMatches,
  onPrev,
  onNext,
  onClear,
}: SearchControlsProps) {
  return (
    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
      <span
        className="text-[11px] tabular-nums text-muted-foreground px-1.5"
        aria-live="polite"
        aria-atomic="true"
      >
        {counter}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded"
        disabled={!hasMatches}
        onClick={onPrev}
        aria-label="Previous match"
        title="Previous match (Shift+Enter)"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded"
        disabled={!hasMatches}
        onClick={onNext}
        aria-label="Next match"
        title="Next match (Enter)"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 rounded"
        onClick={onClear}
        aria-label="Clear search"
        title="Clear"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

function formatCounter(
  hasMatches: boolean,
  activeIndex: number,
  totalMatches: number
): string {
  if (!hasMatches) return "0";
  return `${activeIndex + 1}/${totalMatches}`;
}
