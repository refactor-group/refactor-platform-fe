"use client";

import { useCallback, useId, useMemo } from "react";
import { DateTime } from "ts-luxon";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionActionDialogs } from "@/components/ui/dashboard/session-action-dialogs";
import { useSessionActions } from "@/components/ui/dashboard/use-session-actions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useNow } from "@/lib/hooks/use-now";
import { useScheduleTimezone } from "@/lib/hooks/use-schedule-data";
import { revalidateEndpointCaches } from "@/lib/hooks/use-sse-cache-invalidation";
import { useWeekSessions } from "@/lib/hooks/use-week-sessions";
import type { MoveScope } from "@/lib/scheduling";
import { cardView, type CardView } from "@/lib/week-grid/card";
import {
  groupByDay,
  weekOf,
  weekRange,
  weekSubline,
  weekTitle,
  type DayGroup,
  type Week,
} from "@/lib/week-grid/week";
import { siteConfig } from "@/site.config";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { None, Some } from "@/types/option";
import { WeekGrid, WEEK_GRID_CLASS } from "./week-grid";
import { WeekPanelHeader } from "./week-panel-header";

export interface WeekPanelProps {
  onReschedule: (session: EnrichedCoachingSession, scope?: MoveScope) => void;
  onSeriesMutated: () => void;
}

const CURRENT_WEEK = 0;

// Keyed on the local date so the fetch key holds steady across clock ticks.
function useCurrentWeek(now: DateTime, timezone: string): Week {
  const today = now.setZone(timezone).startOf("day").toMillis();
  return useMemo(
    () => weekOf(CURRENT_WEEK, DateTime.fromMillis(today, { zone: timezone }), timezone),
    [today, timezone]
  );
}

export function WeekPanel({ onReschedule, onSeriesMutated }: WeekPanelProps) {
  const timezone = useScheduleTimezone();
  const now = useNow(30_000);
  const week = useCurrentWeek(now, timezone);
  const { sessions, isLoading, isError, refresh } = useWeekSessions(week);
  const viewerId = useAuthStore((s) => s.userId);

  const { mutate } = useSWRConfig();
  const onSessionsChanged = useCallback(() => {
    void revalidateEndpointCaches(mutate, siteConfig.env.backendServiceURL, "/coaching_sessions");
  }, [mutate]);
  const actions = useSessionActions({
    userTimezone: timezone,
    onReschedule,
    onSessionsChanged,
    onSeriesMutated,
  });

  const days = useMemo(() => {
    const views = sessions.map((s) => cardView(s, { viewerId, now, timezone }));
    return groupByDay(views, (v) => v.start, week, now);
  }, [sessions, viewerId, now, timezone, week]);

  const titleId = useId();
  const title = weekTitle(CURRENT_WEEK, week);
  const range = weekRange(week);

  return (
    <section
      aria-labelledby={titleId}
      aria-busy={isLoading}
      className="rounded-card border bg-card p-7"
    >
      {isLoading ? (
        <>
          <WeekPanelHeader titleId={titleId} title={title} range={range} subline={None} />
          <WeekGridSkeleton />
        </>
      ) : isError ? (
        <>
          <WeekPanelHeader titleId={titleId} title={title} range={range} subline={None} />
          <WeekPanelError onRetry={refresh} />
        </>
      ) : (
        <>
          <WeekPanelHeader
            titleId={titleId}
            title={title}
            range={range}
            subline={Some(sublineFor(days))}
          />
          <WeekGrid days={days} onAction={actions.run} />
        </>
      )}
      <SessionActionDialogs {...actions.dialogs} />
    </section>
  );
}

function sublineFor(days: DayGroup<CardView>[]): string {
  const count = days.reduce((sum, d) => sum + d.items.length, 0);
  const today = days.find((d) => d.isToday)?.items.length ?? 0;
  return weekSubline(count, Some(today));
}

function WeekGridSkeleton() {
  return (
    <div className={WEEK_GRID_CLASS}>
      {Array.from({ length: 7 }, (_, i) => (
        <Skeleton key={i} className="h-32 rounded-xl" />
      ))}
    </div>
  );
}

function WeekPanelError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-6 flex flex-col items-start gap-3">
      <p className="text-sm text-muted-foreground">Couldn&apos;t load this week&apos;s sessions.</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
