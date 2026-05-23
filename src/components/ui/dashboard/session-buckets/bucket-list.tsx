"use client";

import { useState, useMemo, Fragment } from "react";
import type { DateTime } from "ts-luxon";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BucketAccordion } from "./bucket-accordion";
import { YearDivider } from "./year-divider";
import { CoachingSessionBuckets } from "@/lib/utils/session";
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
  /** When true, the show-more button is omitted entirely — used once
   *  the parent has determined no further sessions exist in this
   *  direction. */
  showMoreHidden: boolean;
  /** Rendered when the visible bucket list is empty. */
  emptyMessage: string;
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
  showMoreHidden,
  emptyMessage,
}: BucketListProps) {
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(
    defaultExpandedKey ? new Set([defaultExpandedKey]) : new Set()
  );

  const visibleBuckets = useMemo(() => {
    const nonEmpty = buckets.filter((b) => {
      const count = countsByKey.get(b.key);
      if (!count) return true;
      return !(count.some && count.val === 0);
    });
    return CoachingSessionBuckets.detectYearDividers(nonEmpty);
  }, [buckets, countsByKey]);

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

  if (visibleBuckets.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-sm text-muted-foreground/60">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="divide-y">
      {visibleBuckets.map((bucket) => {
        const count = countsByKey.get(bucket.key) ?? { some: false, none: true };
        return (
          <Fragment key={bucket.key}>
            {bucket.crossesYearFromPrevious && (
              <YearDivider year={bucket.start.year} />
            )}
            <BucketAccordion
              descriptor={bucket}
              label={CoachingSessionBuckets.displayLabel(
                bucket,
                view === CoachingSessionBucketView.Previous,
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
      {!showMoreHidden && (
        // Border-top here (rather than relying on the parent's
        // `divide-y`) so the rule above the button is present even
        // when there are no buckets above it — keeps the visual
        // separator consistent across Upcoming and Previous tabs.
        <div className="px-6 py-3 flex justify-center border-t">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground gap-1.5"
            onClick={onShowMore}
            disabled={showMoreLoading}
            aria-busy={showMoreLoading}
          >
            {showMoreLoading && (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            )}
            {showMoreLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
