"use client";

import { useCallback, useMemo, useState } from "react";
import { DateTime } from "ts-luxon";
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

  const { counts: monthCounts } = useEnrichedCoachingSessionsForUserCounts(
    userId,
    fetchRangeStart,
    fetchRangeEnd,
    userTimezone,
    relationshipFilter
  );

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

  const currentBucketKey = useMemo(() => {
    const current = futureBuckets.find(
      (b) => b.start <= mountNow && mountNow <= b.end
    );
    return current?.key;
  }, [futureBuckets, mountNow]);

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

  const onShowLater = useCallback(
    () => setMonthsForward((m) => m + SHOW_MORE_INCREMENT_MONTHS),
    []
  );
  const onShowEarlier = useCallback(
    () => setMonthsBack((m) => m + SHOW_MORE_INCREMENT_MONTHS),
    []
  );

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
            defaultExpandedKey={currentBucketKey}
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
            showMoreLabel="Show more future sessions"
            onShowMore={onShowLater}
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
            defaultExpandedKey={currentBucketKey}
            view={CoachingSessionBucketView.Previous}
            mountNow={mountNow}
            userId={userId}
            relationshipId={relationshipFilter}
            viewerId={viewerId}
            userTimezone={userTimezone}
            selectedId={selectedId}
            onSelect={setSelectedSession}
            onReschedule={onReschedule}
            onRequestDelete={onRequestDelete}
            showMoreLabel="Show more past sessions"
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
          reviewActions={selectedReviewActions}
        />
      </div>

      <div className="h-4 md:hidden" />
    </div>
  );
}
