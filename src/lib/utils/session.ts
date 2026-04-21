import { DateTime } from "ts-luxon";
import { CoachingSession, DEFAULT_SESSION_DURATION_MINUTES, EnrichedCoachingSession } from "@/types/coaching-session";
import { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import { User } from "@/types/user";
import { Id, ItemStatus } from "@/types/general";
import {
  SessionUrgency,
  EnrichedSessionDisplay,
} from "@/types/session-display";
import {
  getOtherParticipantName,
  getUserRoleInRelationship,
} from "@/lib/utils/relationship";
import { getBrowserTimezone } from "@/lib/timezone-utils";
import { goalTitle } from "@/types/goal";
import { RelationshipRole } from "@/types/relationship-role";
import type { AssignedActionWithContext } from "@/types/assigned-actions";

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

/** Hour when afternoon begins (12:00 PM) */
export const AFTERNOON_START_HOUR = 12;

/** Hour when evening begins (5:00 PM) */
export const EVENING_START_HOUR = 17;

/**
 * Calculate urgency level based on session timing
 * Story: "Categorize sessions by how soon they start"
 */
export function calculateSessionUrgency(
  session: CoachingSession
): SessionUrgency {
  const now = DateTime.now();
  // Parse session date as UTC (backend stores in UTC)
  const sessionTime = DateTime.fromISO(session.date, { zone: 'utc' });
  const sessionEndTime = sessionTime.plus({ minutes: DEFAULT_SESSION_DURATION_MINUTES });
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
 * Generate human-friendly urgency message
 * Story: "Tell users when their session is happening in natural language"
 */
export function getUrgencyMessage(
  session: CoachingSession,
  urgency: SessionUrgency,
  userTimezone?: string
): string {
  const now = DateTime.now();
  // Parse session date as UTC (backend stores in UTC)
  const sessionTimeUTC = DateTime.fromISO(session.date, { zone: 'utc' });
  // Convert to user's timezone for display
  const timezone = userTimezone || getBrowserTimezone();
  const sessionTime = sessionTimeUTC.setZone(timezone);

  switch (urgency) {
    case SessionUrgency.Past: {
      const sessionEndTimeUTC = sessionTimeUTC.plus({ minutes: DEFAULT_SESSION_DURATION_MINUTES });
      const minutesSinceEnd = Math.abs(
        sessionEndTimeUTC.diff(now, "minutes").minutes
      );
      const hoursSinceEnd = Math.floor(minutesSinceEnd / 60);

      if (hoursSinceEnd >= 1) {
        return `Ended ${hoursSinceEnd} ${hoursSinceEnd === 1 ? "hour" : "hours"} ago`;
      }
      return `Ended ${Math.floor(minutesSinceEnd)} minutes ago`;
    }

    case SessionUrgency.Underway:
      return "Under way";

    case SessionUrgency.Imminent: {
      const minutesUntil = Math.round(
        sessionTimeUTC.diff(now, "minutes").minutes
      );

      if (minutesUntil <= 0) {
        return "Starting now!";
      }

      return `Starting in ${minutesUntil} ${minutesUntil === 1 ? "minute" : "minutes"}`;
    }

    case SessionUrgency.Soon: {
      const minutesUntil = sessionTimeUTC.diff(now, "minutes").minutes;
      const hoursUntil = minutesUntil / 60;

      if (hoursUntil < 2) {
        const hours = Math.floor(hoursUntil);
        const minutes = Math.floor(minutesUntil % 60);

        if (minutes === 0) {
          return `Next session in ${hours} ${hours === 1 ? "hour" : "hours"}`;
        }

        return `Next session in ${hours} ${hours === 1 ? "hour" : "hours"} ${minutes} minutes`;
      }

      return "Next session in 2 hours";
    }

    case SessionUrgency.Later: {
      // The absolute time is shown separately in the UI (card header, popover
      // row); keep this message relative so it doesn't duplicate that info.
      const period = getPeriodOfDay(sessionTime);
      return `Scheduled for ${period}`;
    }
  }
}

/**
 * Get period of day for natural language
 * Story: "Describe time of day in friendly terms"
 *
 * Accounts for whether the session is today, tomorrow, or yesterday
 * to generate appropriate relative time phrases.
 */
function getPeriodOfDay(time: DateTime): string {
  const now = DateTime.now().setZone(time.zone);
  const hour = time.hour;

  // Determine the time period (morning, afternoon, evening)
  let period: string;
  if (hour < AFTERNOON_START_HOUR) {
    period = "morning";
  } else if (hour < EVENING_START_HOUR) {
    period = "afternoon";
  } else {
    period = "evening";
  }

  // Check if it's today, tomorrow, or yesterday
  const daysDiff = Math.round(time.startOf('day').diff(now.startOf('day'), 'days').days);

  if (daysDiff === 0) {
    return `this ${period}`;
  } else if (daysDiff === 1) {
    return `tomorrow ${period}`;
  } else if (daysDiff === -1) {
    return `yesterday ${period}`;
  } else {
    // For dates beyond tomorrow/yesterday, include the day name
    const dayName = time.toFormat('EEEE'); // e.g., "Monday"
    return `${dayName} ${period}`;
  }
}

/**
 * Format session date/time for display
 * Story: "Show when the session is in a clear, readable format"
 */
export function formatSessionDateTime(
  sessionDateString: string,
  userTimezone: string
): string {
  // Parse the date as UTC first (backend stores dates in UTC), then convert to user's timezone
  const sessionTime = DateTime.fromISO(sessionDateString, { zone: 'utc' }).setZone(
    userTimezone
  );
  const now = DateTime.now().setZone(userTimezone);
  const isToday = sessionTime.hasSame(now, "day");

  const timeStr = sessionTime.toFormat("h:mm a");
  const timezoneStr = sessionTime.toFormat("ZZZZ");

  if (isToday) {
    return `Today at ${timeStr} ${timezoneStr}`;
  }

  const dayStr = sessionTime.toFormat("EEEE"); // e.g., "Monday"
  return `${dayStr} at ${timeStr} ${timezoneStr}`;
}

/**
 * Enrich session with all display properties
 * Story: "Transform raw data into everything the UI needs"
 */
export function enrichSessionForDisplay(
  session: CoachingSession,
  relationship: CoachingRelationshipWithUserNames,
  user: User,
  goal: { id: string; title: string } | null,
  organization: { id: string; name: string }
): EnrichedSessionDisplay {
  const urgency = calculateSessionUrgency(session);
  const isPast = urgency === SessionUrgency.Past;

  // Use browser timezone as fallback, matching what other coaching session components do
  const timezone = user.timezone || getBrowserTimezone();

  return {
    id: session.id,
    goalTitle: goal ? goalTitle(goal, "Coaching Session") : "Coaching Session",
    participantName: getOtherParticipantName(relationship, user),
    userRole: getUserRoleInRelationship(relationship, user),
    dateTime: formatSessionDateTime(session.date, timezone),
    organizationName: organization.name,
    isPast,
    urgency: {
      type: urgency,
      message: getUrgencyMessage(session, urgency),
    },
  };
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
 * Format a session's time for compact display (e.g. "2:30 PM CST")
 *
 * Converts a UTC date string to the user's timezone and formats it.
 */
export function formatSessionTime(
  dateString: string,
  timezone: string
): string {
  const sessionTime = DateTime.fromISO(dateString, { zone: "utc" }).setZone(
    timezone
  );
  return sessionTime.toFormat("h:mm a ZZZZ");
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
  /** The viewer's role in the session (Coach or Coachee) */
  readonly userRole: RelationshipRole;
  /** Whether the viewer is the coach in this session */
  readonly isCoach: boolean;
  /** True when the counterpart user object was not loaded; participantName
   *  in that case is a "(data not loaded)" placeholder, not a real name. */
  readonly isMissing: boolean;
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

  const isCoach = relationship.coach_id === userId;
  const userRole = isCoach ? RelationshipRole.Coach : RelationshipRole.Coachee;
  const participant = isCoach ? session.coachee : session.coach;

  if (!participant) {
    return {
      participantName: isCoach ? "Coachee (data not loaded)" : "Coach (data not loaded)",
      firstName: "",
      lastName: "",
      userRole,
      isCoach,
      isMissing: true,
    };
  }

  const participantName =
    `${participant.first_name} ${participant.last_name}`.trim() ||
    participant.display_name;

  return {
    participantName,
    firstName: participant.first_name,
    lastName: participant.last_name,
    userRole,
    isCoach,
    isMissing: false,
  };
}

/**
 * Get the name of the other participant in an enriched session.
 *
 * Thin wrapper over getSessionParticipantInfo that collapses the null/missing
 * cases to single-word strings (for terse list-style UI). When the participant
 * *is* loaded but has blank first/last names, the underlying display_name
 * fallback from getSessionParticipantInfo is returned as-is.
 */
export function getSessionParticipantName(
  session: EnrichedCoachingSession,
  userId: string
): string {
  const info = getSessionParticipantInfo(session, userId);
  if (!info) return "Unknown";
  if (info.isMissing) return info.isCoach ? "Coachee" : "Coach";
  return info.participantName;
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

/**
 * Count **incomplete** actions in the assignee's list that are due on or
 * before a given session's start time, scoped to that session's coaching
 * relationship.
 *
 * Excludes Completed actions so the "N actions due" count reflects work
 * still outstanding, not work ever assigned. Matches the incomplete filter
 * convention used elsewhere (`filterActionsByStatus` in
 * `lib/utils/assigned-actions.ts`), which treats only `Completed` as closed.
 *
 * Used by UpcomingSessionCard to surface "N actions due" next to a session,
 * and by action-test-utils to preserve equivalent counting semantics in tests.
 */
export function countActionsDueBySession(
  assignedActions: AssignedActionWithContext[],
  sessionRelationshipId: Id,
  sessionDate: DateTime,
): number {
  return assignedActions.filter((a) => {
    if (a.relationship.id !== sessionRelationshipId) return false;
    if (a.action.status === ItemStatus.Completed) return false;
    return a.action.due_by <= sessionDate;
  }).length;
}
