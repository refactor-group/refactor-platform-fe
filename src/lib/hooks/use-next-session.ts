import type { DateTime } from "ts-luxon";
import { useNow } from "@/lib/hooks/use-now";
import { useUserTimezone } from "@/lib/hooks/use-user-timezone";
import { useWeekAt } from "@/lib/hooks/use-week-at";
import { useWeekSessions } from "@/lib/hooks/use-week-sessions";
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

/** The viewer's next non-past session through Sunday of the current week. */
export function useNextSession(): NextSession {
  const timezone = useUserTimezone();
  const now = useNow(30_000);
  const week = useWeekAt(CURRENT_WEEK, now, timezone);
  const { sessions, isLoading, isError, refresh } = useWeekSessions(week);
  const next = selectNextUpcomingSession(sessions);
  return {
    session: next ? Some(next) : None,
    isLoading,
    isError,
    refresh,
    now: now.setZone(timezone),
  };
}
