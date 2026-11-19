import { otherParticipantInSession, participantName as participantNameOf } from "@/lib/participants";
import { DateTime } from "ts-luxon";
import { CoachingSession, EnrichedCoachingSession } from "@/types/coaching-session";
import { Id } from "@/types/general";
import { schedulingBlockedBy, viewerOf } from "@/types/coaching-relationship";
import { SessionUrgency } from "@/types/session-display";
import { RelationshipRole } from "@/types/relationship-role";

/**
 * Session Utility Functions
 * Story: "Transform raw session data into display-ready information"
 */

/** Threshold in minutes for considering a session as past (allows for execution timing) */
export const PAST_SESSION_THRESHOLD_MINUTES = -1;

/** Threshold in minutes for imminent sessions (starting very soon) */
export const IMMINENT_SESSION_THRESHOLD_MINUTES = 30;

/** Minutes after session start before showing "Under way" instead of "Starting now!" */
export const UNDERWAY_THRESHOLD_MINUTES = 5;

/** Threshold in minutes for sessions starting soon */
export const SOON_SESSION_THRESHOLD_MINUTES = 120;

/**
 * Calculate urgency level based on session timing
 * Story: "Categorize sessions by how soon they start"
 */
export function calculateSessionUrgency(
  session: CoachingSession,
  now: DateTime = DateTime.now()
): SessionUrgency {
  // Parse session date as UTC (backend stores in UTC)
  const sessionTime = DateTime.fromISO(session.date, { zone: 'utc' });
  const sessionEndTime = sessionTime.plus({ minutes: session.duration_minutes });
  const minutesUntilSession = sessionTime.diff(now, "minutes").minutes;
  const minutesUntilEnd = sessionEndTime.diff(now, "minutes").minutes;

  // Session is only past once its full duration has elapsed
  if (minutesUntilEnd < PAST_SESSION_THRESHOLD_MINUTES) {
    return SessionUrgency.Past;
  }

  // Session is under way once 5+ minutes have passed since start (but not yet ended)
  if (minutesUntilSession <= -UNDERWAY_THRESHOLD_MINUTES) {
    return SessionUrgency.Underway;
  }

  if (minutesUntilSession <= IMMINENT_SESSION_THRESHOLD_MINUTES) {
    return SessionUrgency.Imminent;
  }

  if (minutesUntilSession <= SOON_SESSION_THRESHOLD_MINUTES) {
    return SessionUrgency.Soon;
  }

  return SessionUrgency.Later;
}

/**
 * Session with minimal required properties for next session lookup
 */
interface SessionWithRelationshipAndDate {
  coaching_relationship_id: Id;
  date: string;
}

/**
 * Find the next upcoming session for each coaching relationship
 * Story: "Determine when the next session is for each coaching relationship"
 *
 * @param sessions - Array of sessions with relationship ID and date
 * @returns Map of relationship ID to the next upcoming session
 */
export function findNextSessionsByRelationship<
  T extends SessionWithRelationshipAndDate,
>(sessions: T[]): Map<Id, T> {
  const map = new Map<Id, T>();
  const now = DateTime.now();

  sessions.forEach((session) => {
    const sessionDate = DateTime.fromISO(session.date);
    if (sessionDate > now) {
      const existing = map.get(session.coaching_relationship_id);
      if (!existing || DateTime.fromISO(existing.date) > sessionDate) {
        map.set(session.coaching_relationship_id, session);
      }
    }
  });

  return map;
}

/**
 * Find the most recent past session for each coaching relationship
 * Story: "Determine when the last session was for each coaching relationship"
 *
 * @param sessions - Array of sessions with relationship ID and date
 * @returns Map of relationship ID to the most recent past session
 */
export function findLastSessionsByRelationship<
  T extends SessionWithRelationshipAndDate,
>(sessions: T[]): Map<Id, T> {
  const map = new Map<Id, T>();
  const now = DateTime.now();

  sessions.forEach((session) => {
    const sessionDate = DateTime.fromISO(session.date);
    if (sessionDate <= now) {
      const existing = map.get(session.coaching_relationship_id);
      // Keep the most recent past session (largest date that's still <= now)
      if (!existing || DateTime.fromISO(existing.date) < sessionDate) {
        map.set(session.coaching_relationship_id, session);
      }
    }
  });

  return map;
}

/**
 * Information about the other participant in a coaching session, from the
 * perspective of the viewing user. `null` when relationship data is missing.
 */
export type SessionParticipantInfo = {
  /** The display name of the participant (coach or coachee) */
  readonly participantName: string;
  /** The participant's first name (for avatar initials) */
  readonly firstName: string;
  /** The participant's last name (for avatar initials) */
  readonly lastName: string;
  /** The viewer's role in the session, from the backend */
  readonly userRole: RelationshipRole;
  /** The viewer may schedule, reschedule and cancel in this relationship, from the backend */
  readonly canSchedule: boolean;
  /** True when the counterpart user object was not loaded; participantName
   *  in that case is a "(data not loaded)" placeholder, not a real name. */
  readonly isMissing: boolean;
  /** Nobody has left the organization in a way that blocks scheduling, from the backend. */
  readonly schedulingOpen: boolean;
} | null;

/**
 * Get participant details for an enriched session from the viewer's perspective.
 *
 * Determines whether the viewer is the coach or coachee, then returns the
 * *other* participant's display info. Returns null when the session lacks a
 * relationship, and a "(data not loaded)" fallback when the counterpart user
 * object is missing.
 */
export function getSessionParticipantInfo(
  session: EnrichedCoachingSession,
  userId: string
): SessionParticipantInfo {
  const relationship = session.relationship;
  if (!relationship) return null;
  const viewer = viewerOf(relationship);
  if (viewer.none) return null;

  const userRole = viewer.val.role;
  const canSchedule = viewer.val.can_schedule_sessions;
  const schedulingOpen = schedulingBlockedBy(relationship).none;
  // Identity, not permission: the other person is whoever isn't the viewer.
  const other = otherParticipantInSession(session, userId);

  if (other.none) {
    return {
      participantName: "(data not loaded)",
      firstName: "",
      lastName: "",
      userRole,
      canSchedule,
      isMissing: true,
      schedulingOpen,
    };
  }

  const participant = other.val;
  const participantName = participantNameOf(participant);

  return {
    participantName,
    firstName: participant.first_name,
    lastName: participant.last_name,
    userRole,
    canSchedule,
    isMissing: false,
    schedulingOpen,
  };
}

/**
 * Select the next session a user should act on: the first session in the list
 * whose urgency is not Past. Assumes the list is sorted ascending by date.
 */
export function selectNextUpcomingSession(
  sessions: EnrichedCoachingSession[]
): EnrichedCoachingSession | undefined {
  return sessions.find(
    (session) => calculateSessionUrgency(session) !== SessionUrgency.Past
  );
}
