import { DateTime } from "ts-luxon";
import { Id, SortOrder } from "@/types/general";

// This must always reflect the Rust struct on the backend
// entity::coaching_sessions::Model
export interface CoachingSession {
  id: Id;
  coaching_relationship_id: Id;
  date: string;
  created_at: DateTime;
  updated_at: DateTime;
}

export function isCoachingSession(value: unknown): value is CoachingSession {
  if (!value || typeof value !== "object") {
    return false;
  }
  const object = value as Record<string, unknown>;

  return (
    typeof object.id === "string" &&
    typeof object.coaching_relationship_id === "string" &&
    typeof object.date === "string" &&
    typeof object.created_at === "string" &&
    typeof object.updated_at === "string"
  );
}

export function isCoachingSessionArray(
  value: unknown
): value is CoachingSession[] {
  return Array.isArray(value) && value.every(isCoachingSession);
}

export function filterAndSortCoachingSessions(
  sessions: CoachingSession[],
  order: SortOrder,
  returnUpcoming: boolean
): CoachingSession[] {
  const now = new Date();

  // Filter sessions based on the `showUpcoming` parameter
  const filteredSessions = sessions.filter((session) => {
    const sessionDate = new Date(session.date.toString());
    if (returnUpcoming) {
      // Include sessions today that haven't started yet or are in the future
      return sessionDate >= now;
    } else {
      // Include past sessions only
      return sessionDate < now;
    }
  });

  // Sort the filtered sessions based on the order parameter
  if (order === SortOrder.Ascending) {
    filteredSessions.sort(
      (a, b) =>
        new Date(a.date.toString()).getTime() -
        new Date(b.date.toString()).getTime()
    );
  } else if (order === SortOrder.Descending) {
    filteredSessions.sort(
      (a, b) =>
        new Date(b.date.toString()).getTime() -
        new Date(a.date.toString()).getTime()
    );
  }

  return filteredSessions;
}

export function getCoachingSessionById(
  id: string,
  sessions: CoachingSession[]
): CoachingSession {
  const session = sessions.find((session) => session.id === id);
  return session ? session : defaultCoachingSession();
}

export function defaultCoachingSession(): CoachingSession {
  var now = DateTime.now();
  return {
    id: "",
    coaching_relationship_id: "",
    date: "",
    created_at: now,
    updated_at: now,
  };
}

export function defaultCoachingSessions(): CoachingSession[] {
  return [defaultCoachingSession()];
}

export function coachingSessionToString(
  coaching_session: CoachingSession | undefined
): string {
  return JSON.stringify(coaching_session);
}

export function coachingSessionsToString(
  coaching_sessions: CoachingSession[] | undefined
): string {
  return JSON.stringify(coaching_sessions);
}

export function isPastSession(session: CoachingSession): boolean {
  const sessionDate = DateTime.fromISO(session.date);
  const now = DateTime.now();
  return sessionDate < now;
}

export function isSessionToday(session: CoachingSession): boolean {
  const sessionDate = DateTime.fromISO(session.date);
  const today = DateTime.now();
  return sessionDate.hasSame(today, 'day');
}

export function isFutureSession(session: CoachingSession): boolean {
  const sessionDate = DateTime.fromISO(session.date);
  const now = DateTime.now();
  return sessionDate > now;
}
