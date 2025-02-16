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

// The main purpose of having this parsing function is to be able to parse the
// returned DateTimeWithTimeZone (Rust type) string into something that ts-luxon
// will agree to work with internally.
export function parseCoachingSession(data: any): CoachingSession {
  if (!isCoachingSession(data)) {
    throw new Error("Invalid CoachingSession data");
  }
  return {
    id: data.id,
    coaching_relationship_id: data.coaching_relationship_id,
    date: data.date,
    created_at: DateTime.fromISO(data.created_at.toString()),
    updated_at: DateTime.fromISO(data.updated_at.toString()),
  };
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

export function sortCoachingSessionArray(
  sessions: CoachingSession[],
  order: SortOrder
): CoachingSession[] {
  if (order == SortOrder.Ascending) {
    sessions.sort(
      (a, b) =>
        new Date(a.date.toString()).getTime() -
        new Date(b.date.toString()).getTime()
    );
  } else if (order == SortOrder.Descending) {
    sessions.sort(
      (a, b) =>
        new Date(b.date.toString()).getTime() -
        new Date(a.date.toString()).getTime()
    );
  }
  return sessions;
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
