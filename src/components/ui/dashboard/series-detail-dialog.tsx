"use client";

import { DateTime } from "ts-luxon";
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
  const { series: detail, isLoading, isError } = useCoachingSessionSeries(
    series?.id ?? ""
  );
  const open = series !== null;
  const sessions = detail.coaching_sessions;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Recurring session series</DialogTitle>
          <DialogDescription>
            {series ? formatSeriesRule(series.rule) : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner /> Loading sessions…
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            Couldn&apos;t load the series&apos; sessions. Please try again.
          </p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This series has no sessions.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {sessions.map((session) => {
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
        )}
      </DialogContent>
    </Dialog>
  );
}
