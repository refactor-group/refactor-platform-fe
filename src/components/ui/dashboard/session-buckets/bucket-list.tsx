"use client";

import { useState, useMemo, Fragment } from "react";
import type { DateTime } from "ts-luxon";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BucketAccordion } from "./bucket-accordion";
import { YearDivider } from "./year-divider";
import { CoachingSessionBuckets } from "@/lib/utils/session";
import { None } from "@/types/option";
import {
  CoachingSessionBucketCount,
  CoachingSessionBucketDescriptor,
  CoachingSessionBucketView,
} from "@/types/coaching-session-bucket";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";

export interface BucketListProps {
  buckets: CoachingSessionBucketDescriptor[];
  countsByKey: Map<string, CoachingSessionBucketCount>;
  defaultExpandedKey: string | undefined;
  view: CoachingSessionBucketView;
  mountNow: DateTime;
  userId: Id;
  relationshipId: Id | undefined;
  viewerId: Id;
  userTimezone: string;
  selectedId: Id | undefined;
  onSelect: (session: EnrichedCoachingSession) => void;
  onReschedule: (session: EnrichedCoachingSession) => void;
  onRequestDelete: (session: EnrichedCoachingSession) => void;
  /** Bucket keys that just appeared in the list — animated in on render. */
  recentlyAddedKeys: Set<string>;
  showMoreLabel: string;
  onShowMore: () => void;
  /** When true, replace the show-more label with a spinner and disable
   *  the button while the new range loads. */
  showMoreLoading: boolean;
  /** When true, the button stays visible but is disabled — the lookahead
   *  probe found no sessions in the next window. */
  showMoreDisabled: boolean;
  /** Count of sessions in the current calendar week that match this
   *  list's view. Subtracted from the overlap bucket's BE-aggregate
   *  count so the badge doesn't double-count sessions surfaced above
   *  in TODAY / THIS WEEK. */
  thisWeekCountInView: number;
}

export function BucketList({
  buckets,
  countsByKey,
  defaultExpandedKey,
  view,
  mountNow,
  userId,
  relationshipId,
  viewerId,
  userTimezone,
  selectedId,
  onSelect,
  onReschedule,
  onRequestDelete,
  recentlyAddedKeys,
  showMoreLabel,
  onShowMore,
  showMoreLoading,
  showMoreDisabled,
  thisWeekCountInView,
}: BucketListProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    defaultExpandedKey ? new Set([defaultExpandedKey]) : new Set()
  );

  const isPastView = view === CoachingSessionBucketView.Previous;

  const adjustedCount = (
    bucket: CoachingSessionBucketDescriptor
  ): CoachingSessionBucketCount =>
    CoachingSessionBuckets.adjustOverlapBucketCount(
      bucket,
      countsByKey.get(bucket.key) ?? None,
      thisWeekCountInView,
      isPastView,
      mountNow
    );

  const visibleBuckets = useMemo(() => {
    const week = CoachingSessionBuckets.currentWeekRange(mountNow);
    const withinDisplay = buckets.filter((b) => {
      // Drop buckets whose entire effective range falls inside this
      // calendar week — those sessions live in TODAY / THIS WEEK.
      const effective = CoachingSessionBuckets.effectiveBucketRange(
        b,
        isPastView,
        mountNow
      );
      if (effective.end < effective.start) return false;
      if (
        effective.start >= week.start &&
        effective.end <= week.end
      ) {
        return false;
      }
      const count = CoachingSessionBuckets.adjustOverlapBucketCount(
        b,
        countsByKey.get(b.key) ?? None,
        thisWeekCountInView,
        isPastView,
        mountNow
      );
      if (!count.some) return true;
      return count.val > 0;
    });
    return CoachingSessionBuckets.detectYearDividers(withinDisplay);
  }, [buckets, countsByKey, isPastView, mountNow, thisWeekCountInView]);

  const toggleKey = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Skip the wrapper when there are no buckets AND nothing to fetch —
  // pinned-week already says "nothing here." When the lookahead has
  // data the button still needs to render so the user can extend.
  if (visibleBuckets.length === 0 && showMoreDisabled) return null;

  return (
    <div className="divide-y">
      {visibleBuckets.map((bucket) => {
        const count = adjustedCount(bucket);
        const effective = CoachingSessionBuckets.effectiveBucketRange(
          bucket,
          isPastView,
          mountNow
        );
        return (
          <Fragment key={bucket.key}>
            {bucket.crossesYearFromPrevious && (
              <YearDivider year={bucket.start.year} />
            )}
            <BucketAccordion
              fetchStart={effective.start}
              fetchEnd={effective.end}
              label={CoachingSessionBuckets.displayLabel(
                bucket,
                isPastView,
                mountNow
              )}
              count={count}
              view={view}
              isExpanded={expandedKeys.has(bucket.key)}
              onToggle={() => toggleKey(bucket.key)}
              userId={userId}
              relationshipId={relationshipId}
              viewerId={viewerId}
              userTimezone={userTimezone}
              selectedId={selectedId}
              onSelect={onSelect}
              onReschedule={onReschedule}
              onRequestDelete={onRequestDelete}
              animateIn={recentlyAddedKeys.has(bucket.key)}
            />
          </Fragment>
        );
      })}
      <div className="px-6 py-3 flex justify-center border-t">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground gap-1.5"
          onClick={onShowMore}
          disabled={showMoreLoading || showMoreDisabled}
          aria-busy={showMoreLoading}
        >
          {showMoreLoading && (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          )}
          {showMoreLabel}
        </Button>
      </div>
    </div>
  );
}
