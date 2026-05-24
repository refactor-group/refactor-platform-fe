"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "ts-luxon";
import { toast as sonnerToast } from "sonner";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  SessionHoverDetail,
  SessionHoverDetailEmpty,
} from "@/components/ui/dashboard/coaching-sessions-hover-detail";
import { BucketList } from "./bucket-list";
import { ThisWeekAccordion } from "./this-week-accordion";
import { TodaySection } from "./today-section";
import {
  useCoachingSessionList,
  useEnrichedCoachingSessionsForUserCounts,
} from "@/lib/api/coaching-sessions";
import { useUserActionsList } from "@/lib/api/user-actions";
import {
  CoachingSessionBuckets,
  getSessionParticipantInfo,
} from "@/lib/utils/session";
import { selectReviewActionsForSession } from "@/lib/utils/select-review-actions-for-session";
import { Some, None } from "@/types/option";
import {
  CoachingSessionBucketCount,
  CoachingSessionBucketView,
} from "@/types/coaching-session-bucket";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { UserActionsScope } from "@/types/assigned-actions";

export interface BucketsContainerProps {
  userId: Id;
  relationshipFilter: Id | undefined;
  viewerId: Id;
  userTimezone: string;
  mountNow: DateTime;
  onReschedule: (session: EnrichedCoachingSession) => void;
  onRequestDelete: (session: EnrichedCoachingSession) => void;
}

const SHOW_MORE_INCREMENT_MONTHS = 6;

// Probe one increment beyond the displayed range so the buttons can be
// disabled when nothing lives in that window.
const LOOKAHEAD_MONTHS = SHOW_MORE_INCREMENT_MONTHS;

const TICK_MS = 60_000;

// Matches the coaching-session page's Actions/Due tab — see
// SESSION_LOOKBACK / SESSION_LOOKAHEAD in `use-panel-actions.ts`. The
// wide window guarantees the prior session is in the list, so the
// shared `selectReviewActionsForSession` helper computes the same
// review window the panel does.
const PRIOR_SESSION_LOOKBACK_YEARS = 5;
const PRIOR_SESSION_LOOKAHEAD_YEARS = 1;

export function BucketsContainer({
  userId,
  relationshipFilter,
  viewerId,
  userTimezone,
  mountNow,
  onReschedule,
  onRequestDelete,
}: BucketsContainerProps) {
  const [monthsForward, setMonthsForward] = useState(
    CoachingSessionBuckets.DEFAULT_MONTHS_FORWARD
  );
  const [monthsBack, setMonthsBack] = useState(
    CoachingSessionBuckets.DEFAULT_MONTHS_BACK
  );

  // `mountNow` is frozen and drives the bucket grid for stable SWR keys.
  // `now` ticks every minute and drives the past/future filter so a session
  // whose start time crosses the boundary while the dashboard is open
  // migrates between "This Week" and the past overlap bucket within ≤ 60s.
  const [now, setNow] = useState<DateTime>(() => DateTime.now());
  useEffect(() => {
    const id = setInterval(() => setNow(DateTime.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const buckets = useMemo(
    () => CoachingSessionBuckets.generate(mountNow, monthsForward, monthsBack),
    [mountNow, monthsForward, monthsBack]
  );

  // The overlap bucket (one whose calendar window straddles `mountNow`)
  // appears in BOTH columns — Upcoming filters its body to future sessions,
  // Previous filters to past.
  const { futureBuckets, pastBuckets, displayRangeStart, displayRangeEnd } =
    useMemo(() => {
      const nowMs = mountNow.toMillis();
      const future = buckets
        .filter((b) => b.end.toMillis() >= nowMs)
        .sort((a, b) => a.start.toMillis() - b.start.toMillis());
      const past = buckets
        .filter((b) => b.start.toMillis() <= nowMs)
        .sort((a, b) => b.start.toMillis() - a.start.toMillis());
      const all = buckets.flatMap((b) => [
        b.start.toMillis(),
        b.end.toMillis(),
      ]);
      return {
        futureBuckets: future,
        pastBuckets: past,
        displayRangeStart: DateTime.fromMillis(Math.min(...all), {
          zone: mountNow.zone,
        }),
        displayRangeEnd: DateTime.fromMillis(Math.max(...all), {
          zone: mountNow.zone,
        }),
      };
    }, [buckets, mountNow]);

  // Fetch one increment beyond the display range so we can tell whether
  // the next click would surface anything.
  const fetchRangeStart = useMemo(
    () => displayRangeStart.minus({ months: LOOKAHEAD_MONTHS }),
    [displayRangeStart]
  );
  const fetchRangeEnd = useMemo(
    () => displayRangeEnd.plus({ months: LOOKAHEAD_MONTHS }),
    [displayRangeEnd]
  );

  const {
    counts: monthCounts,
    isLoading: countsLoading,
    isError: countsError,
  } = useEnrichedCoachingSessionsForUserCounts(
    userId,
    fetchRangeStart,
    fetchRangeEnd,
    userTimezone,
    relationshipFilter
  );

  type ShowMoreDirection = "later" | "earlier";
  const [pendingDirection, setPendingDirection] = useState<
    ShowMoreDirection | undefined
  >();
  const [recentlyAddedKeys, setRecentlyAddedKeys] = useState<Set<string>>(
    new Set()
  );
  const previousBucketKeysRef = useRef<Set<string>>(new Set());
  const hasInitializedRef = useRef(false);

  // Clear the pending direction once new counts have landed, so the
  // spinner reflects the actual fetch state.
  const previousMonthCountsRef = useRef(monthCounts);
  useEffect(() => {
    if (monthCounts !== previousMonthCountsRef.current) {
      previousMonthCountsRef.current = monthCounts;
      if (pendingDirection) setPendingDirection(undefined);
    }
  }, [monthCounts, pendingDirection]);

  useEffect(() => {
    if (countsError && pendingDirection) {
      sonnerToast.error("Couldn't load additional sessions", {
        description: "Please try again.",
      });
      setPendingDirection(undefined);
    }
  }, [countsError, pendingDirection]);

  const { disableShowMoreLater, disableShowMoreEarlier } = useMemo(
    () =>
      CoachingSessionBuckets.computeShowMoreState(
        (monthCounts ?? []).map((c) => c.month),
        mountNow,
        monthsForward,
        monthsBack
      ),
    [monthCounts, mountNow, monthsForward, monthsBack]
  );

  // Identify newly-rendered bucket keys (those not present in the
  // previous bucket set) for the slide-in animation. The initial mount
  // is skipped so the first render doesn't animate every bucket.
  useEffect(() => {
    const currentKeys = new Set(buckets.map((b) => b.key));
    if (!hasInitializedRef.current) {
      previousBucketKeysRef.current = currentKeys;
      hasInitializedRef.current = true;
      return;
    }
    const newKeys = new Set<string>();
    for (const key of currentKeys) {
      if (!previousBucketKeysRef.current.has(key)) newKeys.add(key);
    }
    previousBucketKeysRef.current = currentKeys;
    if (newKeys.size === 0) return;
    setRecentlyAddedKeys(newKeys);
    const id = setTimeout(() => setRecentlyAddedKeys(new Set()), 600);
    return () => clearTimeout(id);
  }, [buckets]);

  const countsByKey = useMemo(() => {
    const monthMap = new Map<string, number>();
    for (const entry of monthCounts ?? []) {
      monthMap.set(entry.month, entry.count);
    }
    // While the initial fetch is in flight, treat missing months as
    // "unknown" so we don't briefly filter out buckets we haven't
    // proven empty yet. Once loading completes, an empty response is
    // authoritative — every absent month is a real Some(0).
    const result = new Map<string, CoachingSessionBucketCount>();
    for (const bucket of buckets) {
      const firstMonth = bucket.start.toFormat("yyyy-MM");
      const secondMonth = bucket.end.toFormat("yyyy-MM");
      const first = monthMap.get(firstMonth);
      const second = monthMap.get(secondMonth);
      if (first === undefined && second === undefined && countsLoading) {
        result.set(bucket.key, None);
      } else {
        result.set(bucket.key, Some((first ?? 0) + (second ?? 0)));
      }
    }
    return result;
  }, [monthCounts, buckets, countsLoading]);


  const [selectedSession, setSelectedSession] = useState<
    EnrichedCoachingSession | undefined
  >();
  const selectedId = selectedSession?.id;

  const actionsRelationshipId =
    relationshipFilter ?? selectedSession?.coaching_relationship_id;
  const { actions: allActions } = useUserActionsList(
    actionsRelationshipId ? userId : null,
    actionsRelationshipId
      ? {
          scope: UserActionsScope.Sessions,
          coaching_relationship_id: actionsRelationshipId,
        }
      : undefined
  );

  // Walked by selectReviewActionsForSession to find the prior session
  // in the relationship — same fetch shape as the coaching-session
  // page's Actions/Due tab, so both surfaces compute the same review
  // window. Range derived from mountNow → stable SWR key, one fetch
  // per relationship.
  const priorSessionLookupRange = useMemo(
    () => ({
      from: mountNow.minus({ years: PRIOR_SESSION_LOOKBACK_YEARS }),
      to: mountNow.plus({ years: PRIOR_SESSION_LOOKAHEAD_YEARS }),
    }),
    [mountNow]
  );
  const { coachingSessions: relationshipSessionsContext } = useCoachingSessionList(
    actionsRelationshipId ?? null,
    priorSessionLookupRange.from,
    priorSessionLookupRange.to,
    "date",
    "asc"
  );

  const selectedParticipant = useMemo(
    () =>
      selectedSession
        ? getSessionParticipantInfo(selectedSession, viewerId)
        : null,
    [selectedSession, viewerId]
  );

  const selectedReviewActions = useMemo(() => {
    if (!selectedSession) return [];
    // Merge selectedSession in case the relationship fetch hasn't
    // returned yet — the helper finds the target via `.id`. The
    // 5y/1y window means the actual prior session is almost always
    // in `relationshipSessionsContext`; no fallback floor needed,
    // matching the Due tab's `undefined`.
    const context = relationshipSessionsContext;
    const sessions = context.some((s) => s.id === selectedSession.id)
      ? context
      : [...context, selectedSession];
    return selectReviewActionsForSession(
      allActions,
      sessions,
      selectedSession.id,
      undefined
    );
  }, [allActions, relationshipSessionsContext, selectedSession]);

  const onShowLater = useCallback(() => {
    if (pendingDirection || disableShowMoreLater) return;
    setPendingDirection("later");
    setMonthsForward((m) => m + SHOW_MORE_INCREMENT_MONTHS);
  }, [pendingDirection, disableShowMoreLater]);
  const onShowEarlier = useCallback(() => {
    if (pendingDirection || disableShowMoreEarlier) return;
    setPendingDirection("earlier");
    setMonthsBack((m) => m + SHOW_MORE_INCREMENT_MONTHS);
  }, [pendingDirection, disableShowMoreEarlier]);

  return (
    <div className="flex flex-col md:flex-row flex-1 min-h-0">
      <Tabs
        defaultValue="upcoming"
        className="flex-1 min-w-0 flex flex-col min-h-0"
      >
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

        <TabsContent
          value="upcoming"
          className="mt-2 flex-1 min-h-0 overflow-y-auto"
        >
          <TodaySection
            view={CoachingSessionBucketView.Upcoming}
            mountNow={mountNow}
            now={now}
            userId={userId}
            relationshipId={relationshipFilter}
            viewerId={viewerId}
            userTimezone={userTimezone}
            selectedId={selectedId}
            onSelect={setSelectedSession}
            onReschedule={onReschedule}
            onRequestDelete={onRequestDelete}
          />
          <ThisWeekAccordion
            view={CoachingSessionBucketView.Upcoming}
            mountNow={mountNow}
            now={now}
            userId={userId}
            relationshipId={relationshipFilter}
            viewerId={viewerId}
            userTimezone={userTimezone}
            selectedId={selectedId}
            onSelect={setSelectedSession}
            onReschedule={onReschedule}
            onRequestDelete={onRequestDelete}
          />
          <BucketList
            buckets={futureBuckets}
            countsByKey={countsByKey}
            defaultExpandedKey={undefined}
            view={CoachingSessionBucketView.Upcoming}
            mountNow={mountNow}
            userId={userId}
            relationshipId={relationshipFilter}
            viewerId={viewerId}
            userTimezone={userTimezone}
            selectedId={selectedId}
            onSelect={setSelectedSession}
            onReschedule={onReschedule}
            onRequestDelete={onRequestDelete}
            recentlyAddedKeys={recentlyAddedKeys}
            showMoreLabel="Show additional future sessions"
            onShowMore={onShowLater}
            showMoreLoading={pendingDirection === "later"}
            showMoreDisabled={disableShowMoreLater}
          />
        </TabsContent>

        <TabsContent
          value="previous"
          className="mt-2 flex-1 min-h-0 overflow-y-auto"
        >
          <TodaySection
            view={CoachingSessionBucketView.Previous}
            mountNow={mountNow}
            now={now}
            userId={userId}
            relationshipId={relationshipFilter}
            viewerId={viewerId}
            userTimezone={userTimezone}
            selectedId={selectedId}
            onSelect={setSelectedSession}
            onReschedule={onReschedule}
            onRequestDelete={onRequestDelete}
          />
          <ThisWeekAccordion
            view={CoachingSessionBucketView.Previous}
            mountNow={mountNow}
            now={now}
            userId={userId}
            relationshipId={relationshipFilter}
            viewerId={viewerId}
            userTimezone={userTimezone}
            selectedId={selectedId}
            onSelect={setSelectedSession}
            onReschedule={onReschedule}
            onRequestDelete={onRequestDelete}
          />
          <BucketList
            buckets={pastBuckets}
            countsByKey={countsByKey}
            defaultExpandedKey={undefined}
            view={CoachingSessionBucketView.Previous}
            mountNow={mountNow}
            userId={userId}
            relationshipId={relationshipFilter}
            viewerId={viewerId}
            userTimezone={userTimezone}
            recentlyAddedKeys={recentlyAddedKeys}
            showMoreLoading={pendingDirection === "earlier"}
            showMoreDisabled={disableShowMoreEarlier}
            selectedId={selectedId}
            onSelect={setSelectedSession}
            onReschedule={onReschedule}
            onRequestDelete={onRequestDelete}
            showMoreLabel="Show additional past sessions"
            onShowMore={onShowEarlier}
          />
        </TabsContent>
      </Tabs>

      <div className="hidden md:block w-px bg-border shrink-0" />

      <div className="hidden md:flex flex-col flex-1 min-w-0 min-h-0 p-4 sm:p-6 gap-4 overflow-y-auto">
        {selectedSession && selectedParticipant ? (
          <SessionHoverDetail
            session={selectedSession}
            participantName={selectedParticipant.participantName}
            userTimezone={userTimezone}
            reviewActions={selectedReviewActions}
          />
        ) : (
          <SessionHoverDetailEmpty />
        )}
      </div>

      <div className="h-4 md:hidden" />
    </div>
  );
}
