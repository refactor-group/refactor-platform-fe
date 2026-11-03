"use client";

import { useState } from "react";
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
import { busySessions, busyWindow, knownSessions, pickerPeople } from "@/lib/schedule-draft";
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
  const entries = schedulablePeople(userId, relationships.relationships ?? []);

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
  const nearest = activity.isLoading || activity.isError ? None : Some(activity.sessions);

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
  const busySource = useEnrichedCoachingSessionsForUser(
    userId,
    window.from,
    window.to,
    [CoachingSessionInclude.Relationship],
    undefined,
    undefined,
    undefined,
    timezone
  ).enrichedSessions;

  const { connections } = useOAuthConnections();
  const { user } = useUser(userId);

  const people: PeopleState = relationships.isError
    ? { kind: "error" }
    : relationships.isLoading
      ? { kind: "loading" }
      : { kind: "loaded", entries, picker: pickerPeople({ people: entries, nearest, history, now, timezone }) };

  return {
    userId,
    timezone,
    now,
    month,
    people,
    known: knownSessions(nearest, history),
    busySource,
    busy: busySessions(busySource, userId, timezone),
    coachStarts: coachStartsFrom(history, now, timezone),
    provider: providerOf(connections),
    defaultMinutes: user?.default_coaching_session_duration_minutes ?? FALLBACK_DURATION_MINUTES,
  };
}

/** The series once it has loaded; the hook's placeholder has another id until then. */
export function useLoadedSeries(seriesId: Id): Option<CoachingSessionSeriesWithSessions> {
  const timezone = useScheduleTimezone();
  const { series, isLoading } = useCoachingSessionSeries(seriesId, timezone);
  return !isLoading && series.id === seriesId ? Some(series) : None;
}
