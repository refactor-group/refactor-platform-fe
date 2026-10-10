"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import { useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import {
  Calendar,
  CheckSquare,
  Handshake,
  MessageSquare,
  Search,
  Target,
  X,
} from "lucide-react";
import { DateTime } from "ts-luxon";

import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { CommandItem, CommandList } from "@/components/ui/command";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { SearchSnippet } from "@/components/ui/search/search-snippet";
import { useSearch, type SearchState } from "@/lib/api/search";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import { searchHitHref } from "@/lib/utils/search-hit-href";
import { actionStatusToString } from "@/types/general";
import { type Option, Some, None } from "@/types/option";
import {
  SearchHitType,
  isSearchableQuery,
  type SearchError,
  type SearchHit,
} from "@/types/search";

const TYPE_LABELS: Record<SearchHitType, string> = {
  [SearchHitType.CoachingSession]: "Session",
  [SearchHitType.Goal]: "Goal",
  [SearchHitType.Action]: "Action",
  [SearchHitType.Agreement]: "Agreement",
  [SearchHitType.Topic]: "Topic",
};

function HitIcon({ type, className }: { type: SearchHitType; className?: string }) {
  switch (type) {
    case SearchHitType.CoachingSession:
      return <Calendar className={className} aria-hidden />;
    case SearchHitType.Goal:
      return <Target className={className} aria-hidden />;
    case SearchHitType.Action:
      return <CheckSquare className={className} aria-hidden />;
    case SearchHitType.Agreement:
      return <Handshake className={className} aria-hidden />;
    case SearchHitType.Topic:
      return <MessageSquare className={className} aria-hidden />;
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unhandled search hit type: ${_exhaustive}`);
    }
  }
}

// Session dates arrive as naive ISO strings; read them as UTC so the calendar day is stable.
const formatDate = (iso: string): string =>
  DateTime.fromISO(iso, { zone: "utc" }).toFormat("MMM d, yyyy");

/** The secondary line under a hit's title, or None when there is nothing worth showing. */
function hitMeta(hit: SearchHit): Option<string> {
  const parts: string[] = [];
  switch (hit.type) {
    case SearchHitType.CoachingSession:
      parts.push(formatDate(hit.date));
      break;
    case SearchHitType.Goal:
      parts.push(actionStatusToString(hit.status));
      break;
    case SearchHitType.Action:
      parts.push(actionStatusToString(hit.status));
      if (hit.session_display_title.some) parts.push(hit.session_display_title.val);
      break;
    case SearchHitType.Agreement:
      if (hit.session_display_title.some) parts.push(hit.session_display_title.val);
      if (hit.session_date.some) parts.push(formatDate(hit.session_date.val));
      break;
    case SearchHitType.Topic:
      parts.push(hit.status);
      if (hit.priority.some) parts.push(`${hit.priority.val} priority`);
      break;
    default: {
      const _exhaustive: never = hit;
      throw new Error(`Unhandled search hit type: ${_exhaustive}`);
    }
  }
  return parts.length > 0 ? Some(parts.join(" · ")) : None;
}

function errorMessage(error: SearchError): string {
  switch (error.kind) {
    case "validation":
      return error.message;
    case "rate_limited":
      return "Too many searches at once. Pause a moment and try again.";
    case "unavailable":
      return "Search is temporarily unavailable.";
    case "network":
      return "Can't reach the server. Check your connection.";
    case "unknown":
      return "Something went wrong while searching.";
    default: {
      const _exhaustive: never = error;
      throw new Error(`Unhandled search error: ${_exhaustive}`);
    }
  }
}

const isTypingTarget = (target: EventTarget | null): boolean =>
  (target instanceof HTMLElement && target.isContentEditable) ||
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  target instanceof HTMLSelectElement;

interface GlobalSearchProps {
  className?: string;
}

/**
 * Header search field: debounced keyword search across sessions, goals,
 * actions, agreements and topics, with results in a dropdown beneath the
 * field. Cmd/Ctrl+K or "/" focuses it from anywhere outside a text input.
 */
export function GlobalSearch({ className }: GlobalSearchProps) {
  const router = useRouter();
  const setCurrentCoachingRelationshipId = useCoachingRelationshipStateStore(
    (state) => state.setCurrentCoachingRelationshipId
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { state, loadMore } = useSearch(query);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut =
        (event.key === "k" && (event.metaKey || event.ctrlKey)) || event.key === "/";
      if (!isShortcut || isTypingTarget(event.target)) return;
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const reset = useCallback(() => {
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }, []);

  const handleBlur = useCallback((event: FocusEvent<HTMLDivElement>) => {
    if (!rootRef.current?.contains(event.relatedTarget)) setOpen(false);
  }, []);

  const handleSelect = useCallback(
    (hit: SearchHit) => {
      const href = searchHitHref(hit);
      if (href.none) return;
      // The dashboard fallback for a goal only shows it under its own relationship.
      if (hit.type === SearchHitType.Goal && hit.coaching_relationship_id.some) {
        setCurrentCoachingRelationshipId(hit.coaching_relationship_id.val);
      }
      reset();
      router.push(href.val);
    },
    [reset, router, setCurrentCoachingRelationshipId]
  );

  const showResults = open && isSearchableQuery(query);

  return (
    <div
      ref={rootRef}
      className={cn("relative w-full", className)}
      onBlur={handleBlur}
    >
      <CommandPrimitive
        shouldFilter={false}
        loop
        label="Search"
        className="w-full"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (query) reset();
            else inputRef.current?.blur();
          }
        }}
      >
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-4 w-4 text-muted-foreground/60"
            aria-hidden
          />
          <CommandPrimitive.Input
            ref={inputRef}
            value={query}
            onValueChange={(value) => {
              setQuery(value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Search sessions, notes, actions…"
            className={cn(
              "h-8 w-full rounded-md border border-input bg-background pl-8 text-sm",
              "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              query ? "pr-8" : "pr-14"
            )}
          />
          {query ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Clear search"
              onClick={reset}
              className="absolute right-0.5 h-7 w-7 rounded-full text-muted-foreground/60 hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <kbd className="pointer-events-none absolute right-1.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
              ⌘K
            </kbd>
          )}
        </div>

        {showResults && (
          <div
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md"
            // Keep focus in the input: otherwise mousedown blurs it and the
            // dropdown unmounts before the click reaches the item.
            onMouseDown={(event) => event.preventDefault()}
          >
            <SearchResults state={state} onSelect={handleSelect} onLoadMore={loadMore} />
          </div>
        )}
      </CommandPrimitive>
    </div>
  );
}

interface SearchResultsProps {
  state: SearchState;
  onSelect: (hit: SearchHit) => void;
  onLoadMore: () => void;
}

function SearchResults({ state, onSelect, onLoadMore }: SearchResultsProps) {
  switch (state.kind) {
    case "idle":
      return null;
    case "loading":
      return <SearchResultsSkeleton />;
    case "error":
      return (
        <p role="alert" className="px-3 py-4 text-sm text-destructive">
          {errorMessage(state.error)}
        </p>
      );
    case "loaded":
      if (state.hits.length === 0) {
        return (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No results for “{state.query.trim()}”
          </p>
        );
      }
      return (
        <CommandList className="max-h-[min(24rem,60vh)]">
          <CommandPrimitive.Group className="p-1">
            {state.hits.map((hit) => (
              <SearchResultRow key={`${hit.type}:${hit.id}`} hit={hit} onSelect={onSelect} />
            ))}
          </CommandPrimitive.Group>
          {state.nextCursor.some && (
            <CommandItem
              value="__load_more__"
              onSelect={onLoadMore}
              disabled={state.isLoadingMore}
              className="mx-1 mb-1 justify-center text-xs text-muted-foreground"
            >
              {state.isLoadingMore ? (
                <>
                  <Spinner className="mr-2 h-3.5 w-3.5" />
                  Loading more…
                </>
              ) : (
                "Show more results"
              )}
            </CommandItem>
          )}
        </CommandList>
      );
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled search state: ${_exhaustive}`);
    }
  }
}

const SKELETON_ROW_COUNT = 3;

/** Placeholder rows shaped like results so the dropdown height holds steady when hits land. */
function SearchResultsSkeleton() {
  return (
    <div role="status" aria-label="Searching" className="p-1">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
        <div key={index} className="flex items-start gap-3 px-2 py-2">
          <Skeleton className="mt-0.5 h-4 w-4 rounded-sm" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface SearchResultRowProps {
  hit: SearchHit;
  onSelect: (hit: SearchHit) => void;
}

function SearchResultRow({ hit, onSelect }: SearchResultRowProps) {
  const href = searchHitHref(hit);
  const meta = hitMeta(hit);
  return (
    <CommandItem
      value={`${hit.type}:${hit.id}`}
      onSelect={() => onSelect(hit)}
      disabled={href.none}
      className="cursor-pointer items-start gap-3 px-2 py-2"
    >
      <HitIcon type={hit.type} className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13px] font-medium text-foreground">{hit.title}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{TYPE_LABELS[hit.type]}</span>
        </div>
        {hit.snippet.some && (
          <SearchSnippet
            snippet={hit.snippet.val}
            className="mt-0.5 line-clamp-2 text-xs text-muted-foreground"
          />
        )}
        {meta.some && (
          <div className="mt-0.5 truncate text-xs text-muted-foreground tabular-nums">
            {meta.val}
          </div>
        )}
      </div>
    </CommandItem>
  );
}
