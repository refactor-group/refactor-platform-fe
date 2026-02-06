import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";
import { SortOrder } from "@/types/sorting";
import { CoachingRelationship } from "@/types/coaching-relationship";
import { User } from "@/types/user";
import { Organization } from "@/types/organization";
import { OverarchingGoal } from "@/types/overarching-goal";
import { Agreement } from "@/types/agreement";
/**
 * Default session duration in minutes (used until backend provides per-session duration).
 * TODO: replace this constant once full session duration has been implemented in the entire system.
 */
export const DEFAULT_SESSION_DURATION_MINUTES = 60;

// This must always reflect the Rust struct on the backend
// entity::coaching_sessions::Model
export interface CoachingSession {
  id: Id;
  coaching_relationship_id: Id;
  date: string;
  created_at: DateTime;
  updated_at: DateTime;
}

/**
 * Include options for fetching related coaching session data
 * Maps to the backend IncludeParam enum
 */
export enum CoachingSessionInclude {
  Relationship = "relationship",
  Organization = "organization",
  Goal = "goal",
  Agreements = "agreements",
}

/**
 * Enriched coaching session with optional related data
 * Matches the backend EnrichedSession response
 *
 * This must always reflect the Rust struct on the backend
 * entity_api::coaching_session::EnrichedSession
 *
 * This type extends CoachingSession with optional fields that are populated
 * based on the include parameter sent to the API.
 *
 * NOTE: The backend returns coach and coachee as TOP-LEVEL fields, not nested
 * inside the relationship object. The relationship field only contains IDs.
 */
export interface EnrichedCoachingSession extends CoachingSession {
  /** Relationship data with IDs only (included when include=relationship) */
  relationship?: CoachingRelationship;

  /** Coach user object (included when include=relationship) */
  coach?: User;

  /** Coachee user object (included when include=relationship) */
  coachee?: User;

  /** Organization data (included when include=organization, requires relationship) */
  organization?: Organization;

  /** Overarching goal (included when include=goal) */
  overarching_goal?: OverarchingGoal;

  /** Agreement (included when include=agreements) */
  agreement?: Agreement;
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
  if (order === SortOrder.Asc) {
    filteredSessions.sort(
      (a, b) =>
        new Date(a.date.toString()).getTime() -
        new Date(b.date.toString()).getTime()
    );
  } else if (order === SortOrder.Desc) {
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
  const sessionEnd = sessionDate.plus({ minutes: DEFAULT_SESSION_DURATION_MINUTES });
  const now = DateTime.now();
  return sessionEnd < now;
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

/**
 * Type guard to check if value is an EnrichedCoachingSession
 */
export function isEnrichedCoachingSession(
  value: unknown
): value is EnrichedCoachingSession {
  // EnrichedCoachingSession extends CoachingSession, so just check base fields
  return isCoachingSession(value);
}

/**
 * Type guard array check for EnrichedCoachingSession
 */
export function isEnrichedCoachingSessionArray(
  value: unknown
): value is EnrichedCoachingSession[] {
  return Array.isArray(value) && value.every(isEnrichedCoachingSession);
}
