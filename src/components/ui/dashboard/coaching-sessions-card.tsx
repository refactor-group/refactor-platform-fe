"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Clock, List, ListFilter, MessageSquare, X } from "lucide-react";
import { DateTime, type DurationObject } from "ts-luxon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { SessionGoalList } from "@/components/ui/session-goal-list";
import { ActionStatusIcon } from "@/components/ui/coaching-sessions/action-card-parts";
import { cn } from "@/components/lib/utils";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useEnrichedCoachingSessionsForUser } from "@/lib/api/coaching-sessions";
import { useUserActionsList } from "@/lib/api/user-actions";
import { selectReviewActionsForSession } from "@/lib/utils/select-review-actions-for-session";
import { formatDateWithTime } from "@/lib/utils/date";
import { getSessionParticipantInfo } from "@/lib/utils/session";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import {
  CoachingSessionInclude,
  type CoachingSession,
  type EnrichedCoachingSession,
} from "@/types/coaching-session";
import {
  isUserCoachInRelationship,
  isUserCoacheeInRelationship,
  sortRelationshipsByParticipantName,
} from "@/types/coaching-relationship";
import { ItemStatus, type Id } from "@/types/general";
import { UserActionsScope } from "@/types/assigned-actions";
import type { Action } from "@/types/action";
import { userSessionFirstLastLettersToString } from "@/types/user-session";

// Time-window options for the Filters popover. The same window is applied
// symmetrically to both tabs (display filter only — see HISTORY_WINDOW below):
//   Upcoming = [now, now + window)   sorted ascending
//   Previous = (now − window, now]   sorted descending
enum SessionTimeWindow {
  Day = "24h",
  Week = "7d",
  Month = "30d",
  Quarter = "90d",
}

const TIME_WINDOW_DURATIONS: Record<SessionTimeWindow, DurationObject> = {
  [SessionTimeWindow.Day]: { hours: 24 },
  [SessionTimeWindow.Week]: { days: 7 },
  [SessionTimeWindow.Month]: { days: 30 },
  [SessionTimeWindow.Quarter]: { days: 90 },
};

const TIME_WINDOW_LABELS: Record<SessionTimeWindow, string> = {
  [SessionTimeWindow.Day]: "24 hours",
  [SessionTimeWindow.Week]: "7 days",
  [SessionTimeWindow.Month]: "30 days",
  [SessionTimeWindow.Quarter]: "90 days",
};

const ENRICHMENT_INCLUDES = [
  CoachingSessionInclude.Relationship,
  CoachingSessionInclude.Goal,
];

interface RelationshipOption {
  id: Id;
  label: string;
}

type SessionView = "list" | "timeline";

export interface CoachingSessionsCardProps {
  /** Opens the create/edit dialog with the given session pre-filled. */
  onReschedule: (session: CoachingSession | EnrichedCoachingSession) => void;
  /** Notify the parent so it can refresh sibling cards (e.g. UpcomingSessionCard). */
  onSessionDeleted?: () => void;
}

/**
 * Coaching Sessions card — replaces the legacy `CoachingSessionList`.
 *
 * Scoped to the *current user* across all of their relationships. Both tabs
 * are driven by the same universal hook (`useEnrichedCoachingSessionsForUser`)
 * with mirrored 24-hour windows around `now` — Upcoming asc, Previous desc.
 */
export function CoachingSessionsCard({
  onReschedule,
}: CoachingSessionsCardProps) {
  const userSession = useAuthStore((s) => s.userSession);
  const userId = userSession?.id;
  const { currentOrganizationId } = useCurrentOrganization();

  // ── Filter state ─────────────────────────────────────────────────────
  const [timeWindow, setTimeWindow] = useState<SessionTimeWindow>(
    SessionTimeWindow.Day
  );
  const [relationshipFilter, setRelationshipFilter] = useState<Id | undefined>(
    undefined
  );

  // Build the relationship options (mirrors the pattern in
  // ActionsPageContainer): only the user's own relationships, alphabetized
  // by counterpart name, labeled "Coach → Coachee" with "You" inserted.
  const { relationships } = useCoachingRelationshipList(currentOrganizationId);
  const relationshipOptions = useMemo<RelationshipOption[]>(() => {
    if (!relationships || !userId) return [];
    const userRelationships = relationships.filter(
      (r) => r.coach_id === userId || r.coachee_id === userId
    );
    return sortRelationshipsByParticipantName(userRelationships, userId).map(
      (r) => {
        const coachLabel = isUserCoachInRelationship(userId, r)
          ? "You"
          : `${r.coach_first_name} ${r.coach_last_name}`;
        const coacheeLabel = isUserCoacheeInRelationship(userId, r)
          ? "You"
          : `${r.coachee_first_name} ${r.coachee_last_name}`;
        return { id: r.id, label: `${coachLabel} → ${coacheeLabel}` };
      }
    );
  }, [relationships, userId]);

  const selectedRelationshipLabel = relationshipFilter
    ? relationshipOptions.find((r) => r.id === relationshipFilter)?.label
    : undefined;

  // ── Date window — symmetric around `now`, sized by the time-window filter ─
  // The fetch matches the displayed window (no over-fetching). For the OLDEST
  // session in the list, the helper's prior-session lookup will fall back to
  // `windowFloor` so it never shows actions due before the user's selection.
  const now = useMemo(() => DateTime.now(), []);
  const windowDuration = TIME_WINDOW_DURATIONS[timeWindow];
  const upcomingFromDate = now;
  const upcomingToDate = useMemo(
    () => now.plus(windowDuration),
    [now, windowDuration]
  );
  const previousFromDate = useMemo(
    () => now.minus(windowDuration),
    [now, windowDuration]
  );
  const previousToDate = now;

  const {
    enrichedSessions: upcomingSessions,
    isLoading: upcomingLoading,
    isError: upcomingError,
  } = useEnrichedCoachingSessionsForUser(
    userId ?? null,
    upcomingFromDate,
    upcomingToDate,
    ENRICHMENT_INCLUDES,
    "date",
    "asc",
    relationshipFilter
  );

  const {
    enrichedSessions: previousSessions,
    isLoading: previousLoading,
    isError: previousError,
  } = useEnrichedCoachingSessionsForUser(
    userId ?? null,
    previousFromDate,
    previousToDate,
    ENRICHMENT_INCLUDES,
    "date",
    "desc",
    relationshipFilter
  );

  // Session-scoped actions for the user — narrowed to the chosen relationship
  // when the filter is set, so hover-panel "actions due" stays consistent.
  const { actions: allActions } = useUserActionsList(
    userId ?? null,
    {
      scope: UserActionsScope.Sessions,
      ...(relationshipFilter && {
        coaching_relationship_id: relationshipFilter,
      }),
    }
  );

  const isLoading = upcomingLoading || previousLoading;
  const isError = !!upcomingError || !!previousError;

  return (
    <TooltipProvider delayDuration={200}>
      {/* `md:h-[360px]` is a *fixed* height (~50% taller than the two cards
          above) — the card never grows past it. Both inner viewports (left
          list and right hover panel) scroll internally when their content
          overflows, so the dashboard's vertical rhythm stays stable
          regardless of how many sessions or actions there are. On smaller
          screens the upper cards stack and grow with content, so we let this
          one auto-size to match. */}
      <Card className="border shadow-none flex flex-col md:h-[360px] overflow-hidden">
        <CardContent className="p-0 flex flex-col flex-1 min-h-0">
          <CardHeaderRow
            timeWindow={timeWindow}
            onTimeWindowChange={setTimeWindow}
            relationshipFilter={relationshipFilter}
            onRelationshipFilterChange={setRelationshipFilter}
            relationshipOptions={relationshipOptions}
            selectedRelationshipLabel={selectedRelationshipLabel}
          />

          {!userSession || isLoading ? (
            <StateLoading />
          ) : isError ? (
            <StateError />
          ) : (
            <ListView
              upcomingSessions={upcomingSessions}
              previousSessions={previousSessions}
              allActions={allActions}
              viewerId={userSession.id}
              userTimezone={userSession.timezone || getBrowserTimezone()}
              fallbackPriorSessionDate={previousFromDate}
              onReschedule={onReschedule}
            />
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}

// ── Header row ──────────────────────────────────────────────────────────

interface CardHeaderRowProps {
  timeWindow: SessionTimeWindow;
  onTimeWindowChange: (w: SessionTimeWindow) => void;
  relationshipFilter: Id | undefined;
  onRelationshipFilterChange: (id: Id | undefined) => void;
  relationshipOptions: RelationshipOption[];
  selectedRelationshipLabel: string | undefined;
}

function CardHeaderRow({
  timeWindow,
  onTimeWindowChange,
  relationshipFilter,
  onRelationshipFilterChange,
  relationshipOptions,
  selectedRelationshipLabel,
}: CardHeaderRowProps) {
  return (
    <div className="px-6 pt-6 pb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
      <h2 className="text-base font-semibold">Coaching Sessions</h2>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Time-window chip is always shown so the user can see the current
            window at a glance. X resets to the default (24 hours). */}
        <Badge variant="secondary" className="gap-1 text-xs h-7 pl-2.5 pr-1.5">
          {TIME_WINDOW_LABELS[timeWindow]}
          {timeWindow !== SessionTimeWindow.Day && (
            <button
              type="button"
              aria-label="Reset time window to default"
              onClick={() => onTimeWindowChange(SessionTimeWindow.Day)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </Badge>
        {selectedRelationshipLabel && (
          <Badge
            variant="secondary"
            className="gap-1 text-xs h-7 pl-2.5 pr-1.5"
          >
            {selectedRelationshipLabel}
            <button
              type="button"
              aria-label="Clear relationship filter"
              onClick={() => onRelationshipFilterChange(undefined)}
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        <FiltersPopover
          timeWindow={timeWindow}
          onTimeWindowChange={onTimeWindowChange}
          relationshipFilter={relationshipFilter}
          onRelationshipFilterChange={onRelationshipFilterChange}
          relationshipOptions={relationshipOptions}
        />
        <ViewToggle />
      </div>
    </div>
  );
}

// ── Filters popover ─────────────────────────────────────────────────────

interface FiltersPopoverProps {
  timeWindow: SessionTimeWindow;
  onTimeWindowChange: (w: SessionTimeWindow) => void;
  relationshipFilter: Id | undefined;
  onRelationshipFilterChange: (id: Id | undefined) => void;
  relationshipOptions: RelationshipOption[];
}

function FiltersPopover({
  timeWindow,
  onTimeWindowChange,
  relationshipFilter,
  onRelationshipFilterChange,
  relationshipOptions,
}: FiltersPopoverProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          aria-label="Filters"
        >
          <ListFilter className="h-3.5 w-3.5" />
          Filters
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-4"
        onInteractOutside={(e) => {
          // Keep the popover open while interacting with Select dropdowns
          // (their content portals outside this Popover).
          const target = e.target as HTMLElement | null;
          if (target?.closest?.('[role="listbox"]')) {
            e.preventDefault();
          }
        }}
      >
        <div className="space-y-4">
          {/* Time window — applied symmetrically to both tabs */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Time window
            </Label>
            <Select
              value={timeWindow}
              onValueChange={(v) => onTimeWindowChange(v as SessionTimeWindow)}
            >
              <SelectTrigger
                className="w-full h-7 text-xs"
                aria-label="Time window"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.values(SessionTimeWindow) as SessionTimeWindow[]).map(
                  (w) => (
                    <SelectItem key={w} value={w}>
                      {TIME_WINDOW_LABELS[w]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Relationship — narrows both lists to a single coachee/coach */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Relationship
            </Label>
            <Select
              value={relationshipFilter ?? "all"}
              onValueChange={(v) =>
                onRelationshipFilterChange(v === "all" ? undefined : v)
              }
            >
              <SelectTrigger
                className="w-full h-7 text-xs"
                aria-label="Relationship filter"
              >
                <SelectValue placeholder="All relationships" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All relationships</SelectItem>
                {relationshipOptions.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ViewToggle() {
  // Only the List view is wired in this PR; the Clock button is placed for
  // PR 3d (timeline view) but disabled until then.
  const view: SessionView = "list";

  return (
    <div className="flex items-center rounded-md border p-0.5">
      <button
        type="button"
        className={cn(
          "rounded-sm p-1.5 transition-colors",
          view === "list"
            ? "bg-muted text-foreground"
            : "text-muted-foreground/50 hover:text-muted-foreground"
        )}
        aria-label="List view"
        aria-pressed={view === "list"}
      >
        <List className="h-3.5 w-3.5" />
      </button>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* span wrapper so Tooltip still fires on a disabled button (Radix
              tooltips ignore pointer events on disabled elements). */}
          <span tabIndex={0}>
            <button
              type="button"
              disabled
              className="rounded-sm p-1.5 text-muted-foreground/40 cursor-not-allowed"
              aria-label="Timeline view"
              aria-pressed={false}
            >
              <Clock className="h-3.5 w-3.5" />
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">Timeline view coming soon</TooltipContent>
      </Tooltip>
    </div>
  );
}

// ── States ──────────────────────────────────────────────────────────────

function StateLoading() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 min-h-[160px] gap-2 py-8">
      <Spinner />
      <p className="text-xs text-muted-foreground">
        Loading your coaching sessions…
      </p>
    </div>
  );
}

function StateError() {
  return (
    <div className="flex items-center justify-center flex-1 min-h-[160px] py-8">
      <p className="text-sm text-destructive">
        Couldn&apos;t load your coaching sessions. Please refresh.
      </p>
    </div>
  );
}

// ── List view (Tabs + master-detail layout) ─────────────────────────────

interface ListViewProps {
  upcomingSessions: EnrichedCoachingSession[];
  previousSessions: EnrichedCoachingSession[];
  allActions: Action[];
  viewerId: Id;
  userTimezone: string;
  /** Lower bound on the action-due window when no prior session is in view —
   *  matches the user's selected display window so the oldest session never
   *  shows actions due before that. */
  fallbackPriorSessionDate: DateTime;
  onReschedule: (session: EnrichedCoachingSession) => void;
}

function ListView({
  upcomingSessions,
  previousSessions,
  allActions,
  viewerId,
  userTimezone,
  fallbackPriorSessionDate,
  onReschedule,
}: ListViewProps) {
  const [hoveredSessionId, setHoveredSessionId] = useState<Id | undefined>(
    undefined
  );

  // Combine for hover lookup; the helper filters by relationship internally.
  const allSessions = useMemo(
    () => [...previousSessions, ...upcomingSessions],
    [previousSessions, upcomingSessions]
  );

  const hoveredSession = useMemo(
    () => allSessions.find((s) => s.id === hoveredSessionId),
    [allSessions, hoveredSessionId]
  );

  const hoveredParticipant = useMemo(
    () =>
      hoveredSession
        ? getSessionParticipantInfo(hoveredSession, viewerId)
        : null,
    [hoveredSession, viewerId]
  );

  const hoveredReviewActions = useMemo(
    () =>
      hoveredSession
        ? selectReviewActionsForSession(
            allActions,
            allSessions,
            hoveredSession.id,
            fallbackPriorSessionDate
          )
        : [],
    [allActions, allSessions, hoveredSession, fallbackPriorSessionDate]
  );

  const handleHover = useCallback(
    (id: Id | undefined) => setHoveredSessionId(id),
    []
  );
  const clearHover = useCallback(() => setHoveredSessionId(undefined), []);

  return (
    <div
      className="flex flex-col md:flex-row flex-1 min-h-0"
      onMouseLeave={clearHover}
    >
      {/* Left: tabbed session list */}
      <Tabs defaultValue="upcoming" className="flex-1 min-w-0 flex flex-col min-h-0">
        <div className="px-6 shrink-0">
          <TabsList className="h-8 p-0.5 w-auto">
            <TabsTrigger value="upcoming" className="text-xs h-7 px-3">
              Upcoming
            </TabsTrigger>
            <TabsTrigger value="previous" className="text-xs h-7 px-3">
              Previous
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Each TabsContent gets `flex-1 min-h-0` so the inner scroll
            container can constrain to the remaining card-body height. */}
        <TabsContent value="upcoming" className="mt-2 flex-1 min-h-0">
          <SessionListColumn
            sessions={upcomingSessions}
            viewerId={viewerId}
            userTimezone={userTimezone}
            isPast={false}
            hoveredId={hoveredSessionId}
            onHover={handleHover}
            onReschedule={onReschedule}
          />
        </TabsContent>

        <TabsContent value="previous" className="mt-2 flex-1 min-h-0">
          <SessionListColumn
            sessions={previousSessions}
            viewerId={viewerId}
            userTimezone={userTimezone}
            isPast={true}
            hoveredId={hoveredSessionId}
            onHover={handleHover}
            onReschedule={onReschedule}
          />
        </TabsContent>
      </Tabs>

      {/* Vertical divider */}
      <div className="hidden md:block w-px bg-border shrink-0" />

      {/* Right: hover detail — `min-h-0 + overflow-y-auto` lets it scroll
          internally instead of growing the card. */}
      <div className="hidden md:flex flex-col flex-1 min-w-0 min-h-0 px-6 pt-3 pb-4 overflow-y-auto">
        <HoverDetail
          session={hoveredSession}
          participantName={hoveredParticipant?.participantName ?? ""}
          reviewActions={hoveredReviewActions}
        />
      </div>

      <div className="h-4 md:hidden" />
    </div>
  );
}

// ── Session list column (one per tab) ───────────────────────────────────

interface SessionListColumnProps {
  sessions: EnrichedCoachingSession[];
  viewerId: Id;
  userTimezone: string;
  isPast: boolean;
  hoveredId: Id | undefined;
  onHover: (id: Id | undefined) => void;
  onReschedule: (session: EnrichedCoachingSession) => void;
}

function SessionListColumn({
  sessions,
  viewerId,
  userTimezone,
  isPast,
  hoveredId,
  onHover,
  onReschedule,
}: SessionListColumnProps) {
  if (sessions.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-sm text-muted-foreground/60">
        No {isPast ? "previous" : "upcoming"} sessions.
      </div>
    );
  }

  return (
    <div className="px-6 h-full overflow-y-auto divide-y">
      {sessions.map((session) => (
        <SessionRow
          key={session.id}
          session={session}
          viewerId={viewerId}
          userTimezone={userTimezone}
          isPast={isPast}
          isHovered={hoveredId === session.id}
          onHover={onHover}
          onReschedule={onReschedule}
        />
      ))}
    </div>
  );
}

// ── Session row ─────────────────────────────────────────────────────────

interface SessionRowProps {
  session: EnrichedCoachingSession;
  viewerId: Id;
  userTimezone: string;
  isPast: boolean;
  isHovered: boolean;
  onHover: (id: Id | undefined) => void;
  onReschedule: (session: EnrichedCoachingSession) => void;
}

function SessionRow({
  session,
  viewerId,
  userTimezone,
  isPast,
  isHovered,
  onHover,
  onReschedule,
}: SessionRowProps) {
  const participant = useMemo(
    () => getSessionParticipantInfo(session, viewerId),
    [session, viewerId]
  );

  const showReschedule = !isPast && participant?.isCoach === true;
  const participantName = participant?.participantName ?? "Unknown";
  const participantInitials = participant
    ? userSessionFirstLastLettersToString(
        participant.firstName,
        participant.lastName
      )
    : "?";
  const dateLabel = useMemo(() => {
    // Backend returns naive ISO strings (no zone suffix) — interpret as UTC
    // before converting to the user's timezone, matching the canonical pattern
    // in `formatSessionTime` (src/lib/utils/session.ts).
    const dt = DateTime.fromISO(session.date, { zone: "utc" }).setZone(
      userTimezone
    );
    return formatDateWithTime(dt, "·");
  }, [session.date, userTimezone]);

  return (
    <div
      className={cn(
        "flex items-center justify-between py-4 group transition-colors rounded-md -mx-2 px-2",
        isHovered && "bg-muted/40"
      )}
      onMouseEnter={() => onHover(session.id)}
      data-testid={`session-row-${session.id}`}
    >
      <div className="flex gap-3 items-center min-w-0 flex-1">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
            {participantInitials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          {/* `text-[13px] font-medium text-foreground` mirrors GoalRow in the
              GoalsOverviewCard — the equivalent row primary-text style. */}
          <p className="text-[13px] font-medium text-foreground truncate">
            {participantName}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums truncate mt-0.5">
            {dateLabel}
          </p>
        </div>
      </div>

      {/* Hover-revealed actions are desktop-only; touch devices can't trigger
          hover, so on mobile we hide them entirely and the user navigates by
          tapping the link below (Join/View). `h-8 text-xs` matches the
          UpcomingSessionCard footer button sizing. */}
      <div className="hidden sm:flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {showReschedule && (
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={() => onReschedule(session)}
          >
            Reschedule
          </Button>
        )}
        <Link href={`/coaching-sessions/${session.id}`}>
          <Button
            variant={isPast ? "outline" : "default"}
            size="sm"
            className="text-xs h-8"
          >
            {isPast ? "View" : "Join"}
          </Button>
        </Link>
      </div>

      {/* Mobile-only always-visible affordance — touch users get a tap target
          without needing hover. */}
      <Link
        href={`/coaching-sessions/${session.id}`}
        className="sm:hidden shrink-0"
      >
        <Button
          variant={isPast ? "outline" : "default"}
          size="sm"
          className="text-xs h-8"
        >
          {isPast ? "View" : "Join"}
        </Button>
      </Link>
    </div>
  );
}

// ── Hover detail panel ──────────────────────────────────────────────────

interface HoverDetailProps {
  session: EnrichedCoachingSession | undefined;
  participantName: string;
  reviewActions: Action[];
}

function HoverDetail({
  session,
  participantName,
  reviewActions,
}: HoverDetailProps) {
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground/20 mb-3" />
        <p className="text-sm text-muted-foreground/40">
          Hover over a session to see actions due
        </p>
      </div>
    );
  }

  const goals = session.goals ?? [];

  return (
    <>
      <div className="mb-4">
        {/* Sub-header inside the hover panel — `text-[13px] font-medium
            text-foreground` mirrors the GoalRow primary text in
            GoalsOverviewCard for visual parity. */}
        <p className="text-[13px] font-medium text-foreground">
          Session with {participantName}
        </p>
        {goals.length > 0 && (
          <SessionGoalList
            goals={goals}
            textClassName="text-xs text-muted-foreground"
            gapClassName="gap-1 mt-1"
          />
        )}
      </div>

      {/* Same eyebrow style as "UPCOMING SESSION" in UpcomingSessionCard:
          `text-xs font-medium uppercase tracking-wider text-muted-foreground/60`. */}
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground/60 mb-2">
        Actions
      </p>

      {reviewActions.length === 0 ? (
        <p className="text-xs text-muted-foreground/50">
          No actions due for this session.
        </p>
      ) : (
        <div className="space-y-3">
          {reviewActions.map((action) => (
            <ActionDueRow key={action.id} action={action} />
          ))}
        </div>
      )}
    </>
  );
}

function ActionDueRow({ action }: { action: Action }) {
  const isCompleted = action.status === ItemStatus.Completed;
  const dueLabel = useMemo(
    () => action.due_by.toFormat("MMM d"),
    [action.due_by]
  );

  return (
    <div className="flex items-start gap-2.5">
      <ActionStatusIcon status={action.status} className="mt-0.5" />
      <div className="min-w-0">
        <p
          className={cn(
            "text-sm leading-snug",
            isCompleted && "text-muted-foreground line-through"
          )}
        >
          {action.body}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">Due {dueLabel}</p>
      </div>
    </div>
  );
}
