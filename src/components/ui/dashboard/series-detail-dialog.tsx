"use client";

import { useState } from "react";
import { DateTime } from "ts-luxon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useCoachingSessionSeries } from "@/lib/api/coaching-session-series";
import { formatDateWithTime } from "@/lib/utils/date";
import {
  CoachingSessionSeries,
  formatSeriesRule,
} from "@/types/coaching-session-series";
import { isPastSession } from "@/types/coaching-session";

export interface SeriesDetailDialogProps {
  series: CoachingSessionSeries | null;
  userTimezone: string;
  onClose: () => void;
}

export function SeriesDetailDialog({
  series,
  userTimezone,
  onClose,
}: SeriesDetailDialogProps) {
  return (
    <Dialog open={series !== null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recurring session series</DialogTitle>
          <DialogDescription>
            {series ? formatSeriesRule(series.rule) : ""}
          </DialogDescription>
        </DialogHeader>
        {series && (
          <SeriesDetailSessions
            key={series.id}
            seriesId={series.id}
            userTimezone={userTimezone}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface SeriesDetailSessionsProps {
  seriesId: string;
  userTimezone: string;
}

const PAGE_SIZE = 10;

/**
 * Loads and renders the materialized sessions for a series. Rendered only when
 * the dialog is open (guarded by the parent), so the fetch hook always receives
 * a real id rather than an empty-string sentinel.
 */
function SeriesDetailSessions({
  seriesId,
  userTimezone,
}: SeriesDetailSessionsProps) {
  const { series: detail, isLoading, isError } = useCoachingSessionSeries(
    seriesId,
    userTimezone
  );
  const sessions = detail.coaching_sessions;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Loading sessions…
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">
        Couldn&apos;t load the series&apos; sessions. Please try again.
      </p>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This series has no sessions.
      </p>
    );
  }

  const visibleSessions = sessions.slice(0, visibleCount);
  const remaining = sessions.length - visibleSessions.length;

  return (
    <>
      <ul className="divide-y divide-border">
        {visibleSessions.map((session) => {
          const dt = DateTime.fromISO(session.date, { zone: "utc" }).setZone(
            userTimezone
          );
          const past = isPastSession(session);
          return (
            <li
              key={session.id}
              className="flex items-center justify-between gap-2 py-2.5"
            >
              <span className="text-sm tabular-nums">
                {formatDateWithTime(dt, "·")}
              </span>
              <span className="text-xs text-muted-foreground">
                {past ? "Past" : "Upcoming"}
              </span>
            </li>
          );
        })}
      </ul>
      {remaining > 0 && (
        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground gap-1.5"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            View {Math.min(remaining, PAGE_SIZE)} more
          </Button>
        </div>
      )}
    </>
  );
}
