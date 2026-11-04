"use client";

import { useMemo, useState } from "react";
import { DateTime } from "ts-luxon";
import type { PickerPerson } from "@/components/ui/new-session/person-picker";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import {
  CoachingSessionInclude,
  useEnrichedCoachingSessionsForUser,
  useNearestEachCoachingSessions,
} from "@/lib/api/coaching-sessions";
import { useCoachingSessionSeries } from "@/lib/api/coaching-session-series";
import { useOAuthConnections } from "@/lib/api/oauth-connection";
import { useUser } from "@/lib/api/users";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { type PersonEntry, schedulablePeople } from "@/lib/people";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { type Availability, busySessions, busyWindow, knownSessions, pickerPeople } from "@/lib/schedule-draft";
import type { BusySession } from "@/lib/scheduling";
import { sessionEndIn, sessionStartIn, utcInstant } from "@/lib/session-window";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { CoachingSessionSeriesWithSessions } from "@/types/coaching-session-series";
import { FALLBACK_DURATION_MINUTES } from "@/types/coaching-session-duration";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import type { Provider } from "@/types/provider";

const HISTORY_WEEKS = 12;
const COACH_STARTS_WEEKS = 8;

export type PeopleState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; entries: PersonEntry[]; picker: PickerPerson[] };

export interface ScheduleData {
  userId: Id;
  timezone: string;
  now: DateTime;
  /** The month shown: the chosen one, else the selected day's, else this one. */
  month: DateTime;
  people: PeopleState;
  /** Nearest and history reads together, for usual slots. */
  known: EnrichedCoachingSession[];
  /** Sessions in the busy range, kept whole so an overlapped one can be moved. */
  busySource: EnrichedCoachingSession[];
  busy: BusySession[];
  /** Whether `busy` has been read; empty while loading or failed isn't free. */
  availability: Availability;
  coachStarts: DateTime[];
  provider: Option<Provider>;
  defaultMinutes: number;
}

/** What the busy read must cover. */
export interface BusyRange {
  month: Option<DateTime>;
  selected: Option<DateTime>;
}

function coachStartsFrom(history: EnrichedCoachingSession[], now: DateTime, timezone: string): DateTime[] {
  const since = now.minus({ weeks: COACH_STARTS_WEEKS });
  return history
    .filter((s) => sessionEndIn(s, timezone) <= now)
    .map((s) => sessionStartIn(s.date, timezone))
    .filter((start) => start >= since);
}

function providerOf(connections: { provider: Provider }[] | null): Option<Provider> {
  const first = connections?.[0];
  return first ? Some(first.provider) : None;
}

export function useScheduleTimezone(): string {
  const timezone = useAuthStore((state) => state.userSession?.timezone);
  return timezone || getBrowserTimezone();
}

export function useScheduleData(range: BusyRange): ScheduleData {
  const userId = useAuthStore((state) => state.userId);
  const timezone = useScheduleTimezone();
  const now = DateTime.now().setZone(timezone);
  const [openedAt] = useState(() => DateTime.now().setZone(timezone));

  const { currentOrganizationId } = useCurrentOrganization();
  const relationships = useCoachingRelationshipList(currentOrganizationId);
  const relationshipList = relationships.relationships;
  const entries = useMemo(() => schedulablePeople(userId, relationshipList), [userId, relationshipList]);

  const activity = useNearestEachCoachingSessions(
    entries.length > 0
      ? Some({
          userId,
          relationshipIds: entries.flatMap((e) => e.relationshipIds),
          around: utcInstant(openedAt),
          fetchedFor: String(openedAt.toMillis()),
        })
      : None
  );
  const nearestReady = !activity.isLoading && !activity.isError;
  const nearest = useMemo(
    () => (nearestReady ? Some(activity.sessions) : None),
    [nearestReady, activity.sessions]
  );

  const history = useEnrichedCoachingSessionsForUser(
    userId,
    openedAt.minus({ weeks: HISTORY_WEEKS }),
    openedAt,
    [CoachingSessionInclude.Relationship],
    undefined,
    undefined,
    undefined,
    timezone
  ).enrichedSessions;

  const month = (range.month.some ? range.month.val : range.selected.some ? range.selected.val : now).startOf(
    "month"
  );
  const window = busyWindow(month, range.selected);
  const busyRead = useEnrichedCoachingSessionsForUser(
    userId,
    window.from,
    window.to,
    [CoachingSessionInclude.Relationship],
    undefined,
    undefined,
    undefined,
    timezone
  );
  const busySource = busyRead.enrichedSessions;
  const availability: Availability = busyRead.isError
    ? { kind: "error" }
    : busyRead.isLoading
      ? { kind: "loading" }
      : { kind: "loaded" };

  const { connections } = useOAuthConnections();
  const { user } = useUser(userId);

  // The dialog's open time is "now" for the Who list; it needn't tick while open.
  const picker = useMemo(
    () => pickerPeople({ people: entries, nearest, history, now: openedAt, timezone }),
    [entries, nearest, history, openedAt, timezone]
  );
  const known = useMemo(() => knownSessions(nearest, history), [nearest, history]);
  const busy = useMemo(() => busySessions(busySource, userId, timezone), [busySource, userId, timezone]);
  const coachStarts = useMemo(() => coachStartsFrom(history, openedAt, timezone), [history, openedAt, timezone]);

  const people: PeopleState = relationships.isError
    ? { kind: "error" }
    : relationships.isLoading
      ? { kind: "loading" }
      : { kind: "loaded", entries, picker };

  return {
    userId,
    timezone,
    now,
    month,
    people,
    known,
    busySource,
    busy,
    availability,
    coachStarts,
    provider: providerOf(connections),
    defaultMinutes: user?.default_coaching_session_duration_minutes ?? FALLBACK_DURATION_MINUTES,
  };
}

/** A moved session's series: none for a one-off, then loading until it loads or fails. */
export type SeriesLoad =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "loaded"; series: CoachingSessionSeriesWithSessions }
  | { kind: "error" };

export const NO_SERIES: SeriesLoad = { kind: "none" };

export function useLoadedSeries(seriesId: Id): SeriesLoad {
  const timezone = useScheduleTimezone();
  const { series, isLoading, isError } = useCoachingSessionSeries(seriesId, timezone);
  if (isError) return { kind: "error" };
  // The hook's placeholder has another id until the series arrives.
  return !isLoading && series.id === seriesId ? { kind: "loaded", series } : { kind: "loading" };
}
