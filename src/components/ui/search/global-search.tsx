"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import {
  Calendar,
  CheckSquare,
  ChevronDown,
  Handshake,
  MessageSquare,
  Search,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { DateTime } from "ts-luxon";

import { cn } from "@/components/lib/utils";
import { PersonAvatar } from "@/components/ui/avatar";
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
import type { MenuPerson } from "@/components/ui/join-session/types";
import {
  SearchPeopleStrip,
  keepEnterOnButton,
  resultCountLabel,
} from "@/components/ui/search/search-people-strip";
import { SearchSnippet } from "@/components/ui/search/search-snippet";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useSearch, type SearchFilters, type SearchState } from "@/lib/api/search";
import { otherParticipant } from "@/lib/people";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCoachingRelationshipStateStore } from "@/lib/providers/coaching-relationship-state-store-provider";
import { useOrganizationStateStore } from "@/lib/providers/organization-state-store-provider";
import { prefersReducedMotion } from "@/lib/utils/motion";
import { searchHitHref } from "@/lib/utils/search-hit-href";
import {
  type CoachingRelationshipWithUserNames,
  getRelationshipsForUser,
} from "@/types/coaching-relationship";
import { actionStatusToString, type Id } from "@/types/general";
import { type Option, Some, None } from "@/types/option";
import {
  SEARCHABLE_TYPE_OF,
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
  [SearchHitType.TranscriptSuggestion]: "Suggestion",
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
    case SearchHitType.TranscriptSuggestion:
      return <Sparkles className={className} aria-hidden />;
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
      break;
    case SearchHitType.TranscriptSuggestion:
      parts.push("Pending review", hit.session_title);
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
  { type: SearchHitType.TranscriptSuggestion, heading: "Suggestions" },
];

// Sent explicitly: left out, the backend searches every type it has, including ones not rendered here.
const RENDERED_TYPES: SearchFilters = {
  types: GROUP_ORDER.map(({ type }) => SEARCHABLE_TYPE_OF[type]),
};

/** Groups hits by kind, Sessions first; empty kinds are omitted. */
export function groupSearchHits(hits: SearchHit[]): SearchHitGroup[] {
  return GROUP_ORDER.map(({ type, heading }) => ({
    type,
    heading,
    hits: hits.filter((hit) => hit.type === type),
  })).filter((group) => group.hits.length > 0);
}

/** One person's hits, in the server's order. */
export interface PersonHitGroup {
  person: MenuPerson;
  hits: SearchHit[];
}

export interface HitsByPerson {
  /** In order of each person's first hit, so the best hit's person leads. */
  people: PersonHitGroup[];
  /** Hits with no relationship, or one that isn't in the loaded list. */
  other: SearchHit[];
}

/**
 * Groups hits by the other participant of each hit's relationship. Keyed by
 * person, not relationship: two people who coach each other are one group.
 */
export function groupSearchHitsByPerson(
  hits: SearchHit[],
  relationships: CoachingRelationshipWithUserNames[],
  userId: Id
): HitsByPerson {
  // An admin's list holds relationships they aren't part of; those have no "other" person.
  const relationshipsById = new Map(
    getRelationshipsForUser(userId, relationships).map((rel) => [rel.id, rel])
  );
  const groupsByPerson = new Map<Id, PersonHitGroup>();
  const other: SearchHit[] = [];
  for (const hit of hits) {
    if (!hit.coaching_relationship_id.some) {
      other.push(hit);
      continue;
    }
    const relationship = relationshipsById.get(hit.coaching_relationship_id.val);
    if (!relationship) {
      other.push(hit);
      continue;
    }
    const person = otherParticipant(relationship, userId);
    const group = groupsByPerson.get(person.userId);
    if (group) group.hits.push(hit);
    else groupsByPerson.set(person.userId, { person, hits: [hit] });
  }
  return { people: [...groupsByPerson.values()], other };
}

/** Rows shown per person before the band's count becomes an expander. */
export const PERSON_GROUP_ROW_CAP = 5;

type FieldState =
  | { kind: "collapsed"; returnFocus: boolean }
  | { kind: "collapsing"; returnFocus: boolean }
  | { kind: "expanded"; resultsOpen: boolean };

const COLLAPSED: FieldState = { kind: "collapsed", returnFocus: false };
const EXPANDED: FieldState = { kind: "expanded", resultsOpen: true };

// Slightly longer than the width transition, in case transitionend never fires.
const COLLAPSE_FALLBACK_MS = 260;

// From md up the field is an inline pill; below it, an overlay across the header.
const isInlineField = (): boolean =>
  typeof window.matchMedia === "function" && window.matchMedia("(min-width: 768px)").matches;

// The width animation only runs on the inline pill, and not under reduced motion.
const canAnimateCollapse = (): boolean =>
  isInlineField() && !prefersReducedMotion();

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
 * across sessions, goals, actions, agreements, topics and pending transcript
 * suggestions, with grouped
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
  const { state, loadMore } = useSearch(query, RENDERED_TYPES);
  const userId = useAuthStore((store) => store.userId);
  const currentOrganizationId = useOrganizationStateStore(
    (store) => store.currentOrganizationId
  );
  // Loaded once the field opens, and held through the collapse so groups don't reshuffle.
  const { relationships } = useCoachingRelationshipList(
    field.kind === "collapsed" ? null : currentOrganizationId
  );

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
          // The inline pill keeps showing the query; the overlay would hide the header.
          case "expanded":
            return query && isInlineField()
              ? { kind: "expanded", resultsOpen: false }
              : collapseTo(false);
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
        "flex w-9 shrink-0 justify-end transition-[width] duration-200 motion-reduce:transition-none md:relative",
        // The pill gives up width before the rest of the header row overflows.
        expanded && "md:w-[340px] md:min-w-[160px] md:shrink",
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
          // Below md the expanded field overlays the header row instead of squeezing it.
          className="absolute inset-0 z-10 flex items-center bg-background px-4 md:static md:block md:w-full md:bg-transparent md:px-0"
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
              placeholder="Search"
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
                // Safari doesn't focus a tapped button, so the input's blur would
                // close the overlay before this click lands.
                onMouseDown={(event) => event.preventDefault()}
                onClick={clearQuery}
                className="absolute right-1 h-7 w-7 rounded-full text-muted-foreground/60 hover:bg-fill-hover hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          {showResults && (
            <div
              className="absolute left-4 right-4 top-full z-50 mt-2 rounded-popover border bg-popover p-1.5 text-popover-foreground shadow-popover md:left-auto md:right-0 md:w-[420px] md:max-w-[calc(100vw-32px)]"
              // Keep focus in the input: otherwise mousedown blurs it and the
              // dropdown unmounts before the click reaches the item.
              onMouseDown={(event) => event.preventDefault()}
            >
              <SearchResults
                state={state}
                relationships={relationships}
                userId={userId}
                onSelect={handleSelect}
                onLoadMore={loadMore}
              />
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
  relationships: CoachingRelationshipWithUserNames[];
  userId: Id;
  onSelect: (hit: SearchHit) => void;
  onLoadMore: () => void;
}

function SearchResults({ state, relationships, userId, onSelect, onLoadMore }: SearchResultsProps) {
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
        // Keyed by query: a new search resets the spotlight and expanded groups; more pages don't.
        <LoadedResults
          key={state.query}
          state={state}
          relationships={relationships}
          userId={userId}
          onSelect={onSelect}
          onLoadMore={onLoadMore}
        />
      );
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled search state: ${_exhaustive}`);
    }
  }
}

const GROUP_HEADING_CLASSES =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground";

// A group dims piece by piece, not as a whole: opacity on the group would also fade the
// highlighted row, and a child can't undo a parent's opacity.
const DIMMABLE_CLASSES = "transition-opacity duration-150 motion-reduce:transition-none";
const DIMMED_CLASSES = "opacity-[0.32]";
const DIMMABLE_ROW_CLASSES =
  "[&_[cmdk-item]]:transition-opacity [&_[cmdk-item]]:duration-150 motion-reduce:[&_[cmdk-item]]:transition-none";
const DIMMED_ROW_CLASSES = "[&_[cmdk-item]:not([data-selected=true])]:opacity-[0.32]";
const DIMMABLE_HEADING_CLASSES =
  "[&_[cmdk-group-heading]]:transition-opacity [&_[cmdk-group-heading]]:duration-150 motion-reduce:[&_[cmdk-group-heading]]:transition-none";
const DIMMED_HEADING_CLASSES = "[&_[cmdk-group-heading]]:opacity-[0.32]";

interface LoadedResultsProps extends Omit<SearchResultsProps, "state"> {
  state: Extract<SearchState, { kind: "loaded" }>;
}

function LoadedResults({ state, relationships, userId, onSelect, onLoadMore }: LoadedResultsProps) {
  const [spotlight, setSpotlight] = useState<Option<Id>>(None);
  const [expanded, setExpanded] = useState<ReadonlySet<Id>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  const { people, other } = useMemo(
    () => groupSearchHitsByPerson(state.hits, relationships, userId),
    [state.hits, relationships, userId]
  );
  // Bands whenever "who" needs saying: several people, or one person beside unattributed hits.
  const banded = people.length > 1 || (people.length === 1 && other.length > 0);
  const soloPerson = people.length === 1 && other.length === 0 ? Some(people[0].person) : None;

  const pickPerson = (personId: Id) => {
    if (spotlight.some && spotlight.val === personId) {
      setSpotlight(None);
      return;
    }
    setSpotlight(Some(personId));
    const list = listRef.current;
    if (!list) return;
    const band = Array.from(list.querySelectorAll<HTMLElement>("[data-person-group]")).find(
      (group) => group.dataset.personGroup === personId
    );
    if (!band) return;
    list.scrollTo({
      top: band.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop,
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  };

  const toggleExpanded = (personId: Id) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(personId)) next.add(personId);
      return next;
    });

  const isDimmed = (personId: Option<Id>): boolean =>
    spotlight.some && !(personId.some && personId.val === spotlight.val);

  return (
    <>
      {people.length > 1 && (
        <SearchPeopleStrip
          people={people.map(({ person, hits }) => ({ person, count: hits.length }))}
          spotlight={spotlight}
          onPick={pickPerson}
        />
      )}
      {soloPerson.some && (
        <div className="mb-0.5 flex items-center gap-2 border-b border-hairline px-2.5 pb-2 pt-1.5 text-xs text-muted-foreground">
          <PersonAvatar
            userId={soloPerson.val.userId}
            initials={soloPerson.val.initials}
            size={20}
          />
          <span>
            All results are with{" "}
            <span className="font-medium text-foreground">{soloPerson.val.fullName}</span>
          </span>
        </div>
      )}
      <CommandList ref={listRef} className="max-h-[min(24rem,60vh)]">
        {banded ? (
          <>
            {people.map((group) => (
              <PersonResultGroup
                key={group.person.userId}
                group={group}
                expanded={expanded.has(group.person.userId)}
                dimmed={isDimmed(Some(group.person.userId))}
                onToggleExpanded={toggleExpanded}
                onSelect={onSelect}
              />
            ))}
            {other.length > 0 && (
              <CommandPrimitive.Group
                heading="Other results"
                data-dimmed={isDimmed(None)}
                className={cn(
                  GROUP_HEADING_CLASSES,
                  DIMMABLE_HEADING_CLASSES,
                  DIMMABLE_ROW_CLASSES,
                  "pt-2",
                  isDimmed(None) && [DIMMED_HEADING_CLASSES, DIMMED_ROW_CLASSES]
                )}
              >
                {other.map((hit) => (
                  <SearchResultRow key={`${hit.type}:${hit.id}`} hit={hit} onSelect={onSelect} />
                ))}
              </CommandPrimitive.Group>
            )}
          </>
        ) : (
          groupSearchHits(state.hits).map((group) => (
            <CommandPrimitive.Group
              key={group.type}
              heading={group.heading}
              className={GROUP_HEADING_CLASSES}
            >
              {group.hits.map((hit) => (
                <SearchResultRow key={`${hit.type}:${hit.id}`} hit={hit} onSelect={onSelect} />
              ))}
            </CommandPrimitive.Group>
          ))
        )}
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
    </>
  );
}

interface PersonResultGroupProps {
  group: PersonHitGroup;
  expanded: boolean;
  dimmed: boolean;
  onToggleExpanded: (personId: Id) => void;
  onSelect: (hit: SearchHit) => void;
}

// A plain group, not cmdk's: its heading is hidden from assistive tech and can't hold a button.
function PersonResultGroup({
  group: { person, hits },
  expanded,
  dimmed,
  onToggleExpanded,
  onSelect,
}: PersonResultGroupProps) {
  const label = resultCountLabel(hits.length);
  const visibleHits = expanded ? hits : hits.slice(0, PERSON_GROUP_ROW_CAP);
  return (
    <div
      role="group"
      aria-label={person.fullName}
      data-person-group={person.userId}
      data-dimmed={dimmed}
      className={cn(DIMMABLE_ROW_CLASSES, "pt-2 first:pt-1.5", dimmed && DIMMED_ROW_CLASSES)}
    >
      <div
        className={cn(
          "mb-0.5 flex h-10 items-center gap-2.5 rounded-input bg-well pl-[7px] pr-1.5",
          DIMMABLE_CLASSES,
          // Full strength while the expander holds keyboard focus.
          dimmed && [DIMMED_CLASSES, "focus-within:opacity-100"]
        )}
      >
        <PersonAvatar userId={person.userId} initials={person.initials} size={26} />
        <span className="min-w-0 flex-1 truncate text-item font-semibold text-foreground">
          {person.fullName}
        </span>
        {hits.length > PERSON_GROUP_ROW_CAP ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => onToggleExpanded(person.userId)}
            onKeyDown={keepEnterOnButton}
            className="inline-flex h-7 flex-none items-center gap-1 rounded-full pl-2.5 pr-1.5 text-pill font-medium text-ink-2 tabular-nums transition-colors duration-150 hover:bg-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {label}
            <ChevronDown
              className={cn(
                "h-[13px] w-[13px] transition-transform duration-200 motion-reduce:transition-none",
                expanded && "rotate-180"
              )}
              aria-hidden
            />
          </button>
        ) : (
          <span className="flex-none pr-1.5 text-pill font-medium text-muted-foreground tabular-nums">
            {label}
          </span>
        )}
      </div>
      {visibleHits.map((hit) => (
        <SearchResultRow key={`${hit.type}:${hit.id}`} hit={hit} onSelect={onSelect} />
      ))}
    </div>
  );
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
