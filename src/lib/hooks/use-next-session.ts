import { useCallback } from "react";
import type { DateTime } from "ts-luxon";
import { useNow } from "@/lib/hooks/use-now";
import { useUserTimezone } from "@/lib/hooks/use-user-timezone";
import { useWeekAt } from "@/lib/hooks/use-week-at";
import { useWeekSessions } from "@/lib/hooks/use-week-sessions";
import { sessionStartIn } from "@/lib/session-window";
import { selectNextUpcomingSession } from "@/lib/utils/session";
import { CURRENT_WEEK } from "@/lib/week-grid/week";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { type Option, None, Some } from "@/types/option";

export interface NextSession {
  session: Option<EnrichedCoachingSession>;
  isLoading: boolean;
  isError: boolean;
  refresh: () => void;
  /** Ticks every 30s, in the user's zone. */
  now: DateTime;
}

/** The viewer's next non-past session through Sunday of the current week, plus tomorrow. */
export function useNextSession(): NextSession {
  const timezone = useUserTimezone();
  const now = useNow(30_000);
  const week = useWeekAt(CURRENT_WEEK, now, timezone);
  const nextWeek = useWeekAt(CURRENT_WEEK + 1, now, timezone);
  const current = useWeekSessions(week);
  const following = useWeekSessions(nextWeek);

  const { refresh: refreshCurrent } = current;
  const { refresh: refreshFollowing } = following;
  const refresh = useCallback(() => {
    refreshCurrent();
    refreshFollowing();
  }, [refreshCurrent, refreshFollowing]);

  const tomorrow = now.setZone(timezone).plus({ days: 1 }).startOf("day");
  // Only on Sunday may next week's loading or error hold the card.
  const tomorrowInNextWeek = tomorrow > week.days[6];
  const candidates = [
    ...current.sessions,
    ...following.sessions.filter((s) =>
      sessionStartIn(s.date, timezone).hasSame(tomorrow, "day")
    ),
  ];
  const next = selectNextUpcomingSession(candidates, now);

  return {
    session: next ? Some(next) : None,
    isLoading: current.isLoading || (tomorrowInNextWeek && following.isLoading),
    isError: current.isError || (tomorrowInNextWeek && following.isError),
    refresh,
    now: now.setZone(timezone),
  };
}
