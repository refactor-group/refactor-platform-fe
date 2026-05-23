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
import { SessionHoverDetail } from "@/components/ui/dashboard/coaching-sessions-hover-detail";
import { BucketList } from "./bucket-list";
import { PinnedWeekSection } from "./pinned-week-section";
import { useEnrichedCoachingSessionsForUserCounts } from "@/lib/api/coaching-sessions";
import { useUserActionsList } from "@/lib/api/user-actions";
import {
  CoachingSessionBuckets,
  getSessionParticipantInfo,
} from "@/lib/utils/session";
import { selectReviewActionsForSession } from "@/lib/utils/select-review-actions-for-session";
import { Some, None } from "@/types/option";
import {
  CoachingSessionBucketCount,
  CoachingSessionBucketKind,
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

const SHOW_MORE_INCREMENT_MONTHS = 12;

const TICK_MS = 60_000;

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
  // Previous filters to past — so users find a Mon-of-current-month past
  // session in Previous even though the bucket label spans into the future.
  const { futureBuckets, pastBuckets, fetchRangeStart, fetchRangeEnd } =
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
        fetchRangeStart: DateTime.fromMillis(Math.min(...all), {
          zone: mountNow.zone,
        }),
        fetchRangeEnd: DateTime.fromMillis(Math.max(...all), {
          zone: mountNow.zone,
        }),
      };
    }, [buckets, mountNow]);

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

  // ── Show additional state ────────────────────────────────────────────
  // Tracks which extension button (if any) is currently loading, whether
  // we've exhausted sessions in either direction, and which bucket keys
  // were just added so we can animate them in.
  type ShowMoreDirection = "later" | "earlier";
  const [pendingDirection, setPendingDirection] = useState<
    ShowMoreDirection | undefined
  >();
  const [outOfFuture, setOutOfFuture] = useState(false);
  const [outOfPast, setOutOfPast] = useState(false);
  const [recentlyAddedKeys, setRecentlyAddedKeys] = useState<Set<string>>(
    new Set()
  );
  const previousBoundariesRef = useRef({ monthsForward, monthsBack });
  const previousBucketKeysRef = useRef<Set<string>>(new Set());
  const hasInitializedRef = useRef(false);

  // Reset exhaustion + pending when the relationship filter changes —
  // a different relationship has its own data range entirely.
  useEffect(() => {
    setOutOfFuture(false);
    setOutOfPast(false);
    setPendingDirection(undefined);
    previousBoundariesRef.current = { monthsForward, monthsBack };
    // Intentionally only reset on `relationshipFilter` — months* are
    // read for the ref snapshot but should not retrigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationshipFilter]);

  // Surface a one-time toast for the initial counts fetch failure too
  // — without this, the dashboard would silently render no badges
  // (the existing graceful-fallback path) and a user with a flaky
  // connection would never know why.
  const initialCountsErrorToastedRef = useRef(false);
  useEffect(() => {
    if (countsError && !initialCountsErrorToastedRef.current && !pendingDirection) {
      sonnerToast.error("Couldn't load session counts", {
        description: "Bucket badges may be missing. Refresh to retry.",
      });
      initialCountsErrorToastedRef.current = true;
    }
    if (!countsError) {
      initialCountsErrorToastedRef.current = false;
    }
  }, [countsError, pendingDirection]);

  // Mark a direction exhausted via two paths:
  //   1. Post-click strict check — clicking Show additional extended
  //      the range but the response brings no new months past the
  //      previous boundary.
  //   2. Initial-load heuristic — the response's bounding month is
  //      ≥ EXHAUSTION_GAP_THRESHOLD_MONTHS inside the requested
  //      boundary. The gap proves the user has no sessions in those
  //      tail months; we extrapolate that they have none beyond
  //      either. False positives are possible for users with a
  //      multi-month gap before a far-out session.
  useEffect(() => {
    if (countsLoading) return;
    if (countsError) {
      if (pendingDirection) {
        sonnerToast.error("Couldn't load additional sessions", {
          description: "Please try again.",
        });
        setPendingDirection(undefined);
      }
      return;
    }
    const result = CoachingSessionBuckets.detectExhaustion(
      (monthCounts ?? []).map((c) => c.month),
      mountNow,
      monthsForward,
      monthsBack,
      pendingDirection
        ? {
            pendingDirection,
            previousMonthsForward: previousBoundariesRef.current.monthsForward,
            previousMonthsBack: previousBoundariesRef.current.monthsBack,
          }
        : undefined
    );
    if (result.outOfFuture === true) setOutOfFuture(true);
    if (result.outOfPast === true) setOutOfPast(true);
    if (pendingDirection) {
      previousBoundariesRef.current = { monthsForward, monthsBack };
      setPendingDirection(undefined);
    }
  }, [
    pendingDirection,
    countsLoading,
    countsError,
    monthCounts,
    mountNow,
    monthsForward,
    monthsBack,
  ]);

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
    const hasAnyCount = (monthCounts?.length ?? 0) > 0;
    const result = new Map<string, CoachingSessionBucketCount>();
    for (const bucket of buckets) {
      const firstMonth = bucket.start.toFormat("yyyy-MM");
      const secondMonth = bucket.end.toFormat("yyyy-MM");
      const first = monthMap.get(firstMonth);
      const second = monthMap.get(secondMonth);
      if (first === undefined && second === undefined && !hasAnyCount) {
        result.set(bucket.key, None);
      } else {
        result.set(bucket.key, Some((first ?? 0) + (second ?? 0)));
      }
    }
    return result;
  }, [monthCounts, buckets]);


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

  const selectedParticipant = useMemo(
    () =>
      selectedSession
        ? getSessionParticipantInfo(selectedSession, viewerId)
        : null,
    [selectedSession, viewerId]
  );

  const selectedReviewActions = useMemo(() => {
    if (!selectedSession) return [];
    return selectReviewActionsForSession(
      allActions,
      selectedSession ? [selectedSession] : [],
      selectedSession.id,
      fetchRangeStart
    );
  }, [allActions, selectedSession, fetchRangeStart]);

  const onShowLater = useCallback(() => {
    if (pendingDirection || outOfFuture) return;
    previousBoundariesRef.current = { monthsForward, monthsBack };
    setPendingDirection("later");
    setMonthsForward((m) => m + SHOW_MORE_INCREMENT_MONTHS);
  }, [pendingDirection, outOfFuture, monthsForward, monthsBack]);
  const onShowEarlier = useCallback(() => {
    if (pendingDirection || outOfPast) return;
    previousBoundariesRef.current = { monthsForward, monthsBack };
    setPendingDirection("earlier");
    setMonthsBack((m) => m + SHOW_MORE_INCREMENT_MONTHS);
  }, [pendingDirection, outOfPast, monthsForward, monthsBack]);

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
          <PinnedWeekSection
            kind={CoachingSessionBucketKind.Future}
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
            showMoreHidden={outOfFuture}
            emptyMessage="No upcoming sessions."
          />
        </TabsContent>

        <TabsContent
          value="previous"
          className="mt-2 flex-1 min-h-0 overflow-y-auto"
        >
          <PinnedWeekSection
            kind={CoachingSessionBucketKind.Past}
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
            showMoreHidden={outOfPast}
            selectedId={selectedId}
            onSelect={setSelectedSession}
            onReschedule={onReschedule}
            onRequestDelete={onRequestDelete}
            showMoreLabel="Show additional past sessions"
            onShowMore={onShowEarlier}
            emptyMessage="No previous sessions."
          />
        </TabsContent>
      </Tabs>

      <div className="hidden md:block w-px bg-border shrink-0" />

      <div className="hidden md:flex flex-col flex-1 min-w-0 min-h-0 p-4 sm:p-6 gap-4 overflow-y-auto">
        <SessionHoverDetail
          session={selectedSession}
          participantName={selectedParticipant?.participantName ?? ""}
          userTimezone={userTimezone}
          reviewActions={selectedReviewActions}
        />
      </div>

      <div className="h-4 md:hidden" />
    </div>
  );
}
