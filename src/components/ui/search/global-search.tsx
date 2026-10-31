"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FocusEvent,
} from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
      if (hit.session_title.some) parts.push(hit.session_title.val);
      break;
    case SearchHitType.Agreement:
      if (hit.session_title.some) parts.push(hit.session_title.val);
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

/** Hits of one kind, in the server's order. */
export interface SearchHitGroup {
  type: SearchHitType;
  heading: string;
  hits: SearchHit[];
}

const GROUP_ORDER: ReadonlyArray<{ type: SearchHitType; heading: string }> = [
  { type: SearchHitType.CoachingSession, heading: "Sessions" },
  { type: SearchHitType.Goal, heading: "Goals" },
  { type: SearchHitType.Action, heading: "Actions" },
  { type: SearchHitType.Agreement, heading: "Agreements" },
  { type: SearchHitType.Topic, heading: "Topics" },
];

/** Groups hits by kind, Sessions first; empty kinds are omitted. */
export function groupSearchHits(hits: SearchHit[]): SearchHitGroup[] {
  return GROUP_ORDER.map(({ type, heading }) => ({
    type,
    heading,
    hits: hits.filter((hit) => hit.type === type),
  })).filter((group) => group.hits.length > 0);
}

type FieldState =
  | { kind: "collapsed"; returnFocus: boolean }
  | { kind: "collapsing"; returnFocus: boolean }
  | { kind: "expanded"; resultsOpen: boolean };

const COLLAPSED: FieldState = { kind: "collapsed", returnFocus: false };
const EXPANDED: FieldState = { kind: "expanded", resultsOpen: true };

// Slightly longer than the width transition, in case transitionend never fires.
const COLLAPSE_FALLBACK_MS = 260;

// The width animation only runs on the sm+ inline pill, and not under reduced motion.
const canAnimateCollapse = (): boolean =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(min-width: 640px)").matches &&
  !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const collapseTo = (returnFocus: boolean): FieldState => ({
  kind: canAnimateCollapse() ? "collapsing" : "collapsed",
  returnFocus,
});

const finishCollapse = (current: FieldState): FieldState =>
  current.kind === "collapsing" ? { kind: "collapsed", returnFocus: current.returnFocus } : current;

interface GlobalSearchProps {
  className?: string;
}

/**
 * Header search: a magnifier that expands into a debounced keyword search
 * across sessions, goals, actions, agreements and topics, with grouped
 * results beneath. Cmd/Ctrl+K or "/" opens it from outside a text input.
 */
export function GlobalSearch({ className }: GlobalSearchProps) {
  const router = useRouter();
  const setCurrentCoachingRelationshipId = useCoachingRelationshipStateStore(
    (state) => state.setCurrentCoachingRelationshipId
  );
  const [query, setQuery] = useState("");
  const [field, setField] = useState<FieldState>(COLLAPSED);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { state, loadMore } = useSearch(query);

  const expanded = field.kind === "expanded";
  const collapsing = field.kind === "collapsing";

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  useEffect(() => {
    if (field.kind === "collapsed" && field.returnFocus) buttonRef.current?.focus();
  }, [field]);

  useEffect(() => {
    if (!collapsing) return;
    const timer = setTimeout(() => setField(finishCollapse), COLLAPSE_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [collapsing]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut =
        (event.key === "k" && (event.metaKey || event.ctrlKey)) || event.key === "/";
      if (!isShortcut || isTypingTarget(event.target)) return;
      event.preventDefault();
      setField((current) => (current.kind === "expanded" ? current : EXPANDED));
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const setResultsOpen = (resultsOpen: boolean) =>
    setField({ kind: "expanded", resultsOpen });

  const clearQuery = () => {
    setQuery("");
    inputRef.current?.focus();
  };

  const handleEscape = () => {
    if (query) clearQuery();
    else setField(collapseTo(true));
  };

  const handleBlur = useCallback(
    (event: FocusEvent<HTMLDivElement>) => {
      if (rootRef.current?.contains(event.relatedTarget)) return;
      setField((current) => {
        switch (current.kind) {
          case "collapsed":
            return current;
          // Focus went elsewhere, so don't pull it back when the collapse finishes.
          case "collapsing":
            return { ...current, returnFocus: false };
          case "expanded":
            return query ? { kind: "expanded", resultsOpen: false } : collapseTo(false);
          default: {
            const _exhaustive: never = current;
            throw new Error(`Unhandled search field state: ${_exhaustive}`);
          }
        }
      });
    },
    [query]
  );

  const handleSelect = useCallback(
    (hit: SearchHit) => {
      const href = searchHitHref(hit);
      if (href.none) return;
      // The dashboard fallback for a goal only shows it under its own relationship.
      if (hit.type === SearchHitType.Goal && hit.coaching_relationship_id.some) {
        setCurrentCoachingRelationshipId(hit.coaching_relationship_id.val);
      }
      setQuery("");
      setField(collapseTo(false));
      router.push(href.val);
    },
    [router, setCurrentCoachingRelationshipId]
  );

  const showResults = expanded && field.resultsOpen && isSearchableQuery(query);

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex w-9 shrink-0 justify-end transition-[width] duration-200 motion-reduce:transition-none sm:relative",
        expanded && "sm:w-[340px]",
        // ease-spring front-loads the shrink so much that collapsing reads as a snap.
        collapsing ? "overflow-hidden ease-in-out" : "ease-spring",
        className
      )}
      onBlur={handleBlur}
      onTransitionEnd={(event) => {
        if (event.propertyName === "width" && event.target === event.currentTarget) {
          setField(finishCollapse);
        }
      }}
    >
      {field.kind !== "collapsed" ? (
        <CommandPrimitive
          shouldFilter={false}
          loop
          label="Search"
          // Below sm the expanded field overlays the header row instead of squeezing it.
          className="absolute inset-0 z-10 flex items-center bg-background px-4 sm:static sm:block sm:w-full sm:bg-transparent sm:px-0"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              handleEscape();
            }
          }}
        >
          <div className="relative flex w-full min-w-0 items-center">
            <Search
              className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground/60"
              aria-hidden
            />
            <CommandPrimitive.Input
              ref={inputRef}
              value={query}
              onValueChange={(value) => {
                setQuery(value);
                setResultsOpen(true);
              }}
              onFocus={() => setResultsOpen(true)}
              onClick={() => collapsing && setField(EXPANDED)}
              tabIndex={collapsing ? -1 : undefined}
              placeholder="Search sessions, topics, agreements, actions…"
              className={cn(
                "h-9 w-full min-w-0 rounded-full border-0 bg-fill pl-9 text-item transition-colors duration-150 hover:bg-fill-hover focus:bg-card",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-border",
                query ? "pr-9" : "pr-3"
              )}
            />
            {query && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Clear search"
                onClick={clearQuery}
                className="absolute right-1 h-7 w-7 rounded-full text-muted-foreground/60 hover:bg-fill-hover hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {showResults && (
            <div
              className="absolute left-4 right-4 top-full z-50 mt-2 overflow-hidden rounded-popover border bg-popover p-1.5 text-popover-foreground shadow-popover sm:left-auto sm:right-0 sm:w-[420px] sm:max-w-[calc(100vw-32px)]"
              // Keep focus in the input: otherwise mousedown blurs it and the
              // dropdown unmounts before the click reaches the item.
              onMouseDown={(event) => event.preventDefault()}
            >
              <SearchResults state={state} onSelect={handleSelect} onLoadMore={loadMore} />
            </div>
          )}
        </CommandPrimitive>
      ) : (
        <OpenSearchButton
          ref={buttonRef}
          onClick={() => setField(EXPANDED)}
        />
      )}
    </div>
  );
}

const OpenSearchButton = forwardRef<HTMLButtonElement, { onClick: () => void }>(
  function OpenSearchButton({ onClick }, ref) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              ref={ref}
              type="button"
              variant="secondary"
              size="icon-sm"
              aria-label="Open search"
              onClick={onClick}
            >
              <Search />
            </Button>
          </TooltipTrigger>
          <TooltipContent className="flex items-center gap-2">
            Search
            <span className="text-tiny text-muted-foreground">⌘K</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
);

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
      // A page of only unrecognised hit types parses to no hits but can still have more pages.
      if (state.hits.length === 0 && state.nextCursor.none) {
        return (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">
            No results for “{state.query.trim()}”
          </p>
        );
      }
      return (
        <CommandList className="max-h-[min(24rem,60vh)]">
          {groupSearchHits(state.hits).map((group) => (
            <CommandPrimitive.Group
              key={group.type}
              heading={group.heading}
              className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {group.hits.map((hit) => (
                <SearchResultRow key={`${hit.type}:${hit.id}`} hit={hit} onSelect={onSelect} />
              ))}
            </CommandPrimitive.Group>
          ))}
          {state.loadMoreError.some && (
            <p role="alert" className="px-3 py-2 text-center text-xs text-destructive">
              {errorMessage(state.loadMoreError.val)}
            </p>
          )}
          {state.nextCursor.some && (
            <CommandItem
              value="__load_more__"
              onSelect={onLoadMore}
              disabled={state.isLoadingMore}
              className="m-1 justify-center text-xs text-muted-foreground"
            >
              {state.isLoadingMore ? (
                <>
                  <Spinner className="mr-2 h-3.5 w-3.5" />
                  Loading more…
                </>
              ) : state.loadMoreError.some ? (
                "Try again"
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
        <div className="truncate text-[13px] font-medium text-foreground">{hit.title}</div>
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
      <span className="ml-auto shrink-0 text-tiny text-faint">{TYPE_LABELS[hit.type]}</span>
    </CommandItem>
  );
}
