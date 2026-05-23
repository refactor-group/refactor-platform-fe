"use client";

import { useState, useMemo, Fragment } from "react";
import { Button } from "@/components/ui/button";
import { BucketAccordion } from "./bucket-accordion";
import { YearDivider } from "./year-divider";
import { CoachingSessionBuckets } from "@/lib/utils/session";
import {
  CoachingSessionBucketCount,
  CoachingSessionBucketDescriptor,
} from "@/types/coaching-session-bucket";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";

export interface BucketListProps {
  buckets: CoachingSessionBucketDescriptor[];
  countsByKey: Map<string, CoachingSessionBucketCount>;
  defaultExpandedKey: string | undefined;
  userId: Id;
  relationshipId: Id | undefined;
  viewerId: Id;
  userTimezone: string;
  hoveredId: Id | undefined;
  onHover: (session: EnrichedCoachingSession) => void;
  onReschedule: (session: EnrichedCoachingSession) => void;
  onRequestDelete: (session: EnrichedCoachingSession) => void;
  showMoreLabel: string;
  onShowMore: () => void;
  /** Rendered when the visible bucket list is empty. */
  emptyMessage: string;
}

export function BucketList({
  buckets,
  countsByKey,
  defaultExpandedKey,
  userId,
  relationshipId,
  viewerId,
  userTimezone,
  hoveredId,
  onHover,
  onReschedule,
  onRequestDelete,
  showMoreLabel,
  onShowMore,
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
              count={count}
              isExpanded={expandedKeys.has(bucket.key)}
              onToggle={() => toggleKey(bucket.key)}
              userId={userId}
              relationshipId={relationshipId}
              viewerId={viewerId}
              userTimezone={userTimezone}
              hoveredId={hoveredId}
              onHover={onHover}
              onReschedule={onReschedule}
              onRequestDelete={onRequestDelete}
            />
          </Fragment>
        );
      })}
      <div className="px-6 py-3 flex justify-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-muted-foreground"
          onClick={onShowMore}
        >
          {showMoreLabel}
        </Button>
      </div>
    </div>
  );
}
