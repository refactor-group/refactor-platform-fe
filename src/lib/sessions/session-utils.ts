import { DateTime } from "ts-luxon";
import { CoachingSession } from "@/types/coaching-session";
import { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import { User } from "@/types/user";
import { Id } from "@/types/general";
import {
  SessionUrgency,
  EnrichedSessionDisplay,
} from "@/types/session-display";
import {
  getOtherParticipantName,
  getUserRoleInRelationship,
} from "@/lib/relationships/relationship-utils";
import { getBrowserTimezone } from "@/lib/timezone-utils";

/**
 * Session Utility Functions
 * Story: "Transform raw session data into display-ready information"
 */

/** Threshold in minutes for considering a session as past (allows for execution timing) */
export const PAST_SESSION_THRESHOLD_MINUTES = -1;

/** Threshold in minutes for imminent sessions (starting very soon) */
export const IMMINENT_SESSION_THRESHOLD_MINUTES = 30;

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
  const minutesUntilSession = sessionTime.diff(now, "minutes").minutes;

  // Treat anything less than threshold as truly past (allows for execution timing)
  if (minutesUntilSession < PAST_SESSION_THRESHOLD_MINUTES) {
    return SessionUrgency.Past;
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
      const minutesSinceEnd = Math.abs(
        sessionTimeUTC.diff(now, "minutes").minutes
      );
      const hoursSinceEnd = Math.floor(minutesSinceEnd / 60);

      if (hoursSinceEnd >= 1) {
        return `Ended ${hoursSinceEnd} ${hoursSinceEnd === 1 ? "hour" : "hours"} ago`;
      }
      return `Ended ${Math.floor(minutesSinceEnd)} minutes ago`;
    }

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
      const timeOfDay = sessionTime.toFormat("h:mm a");
      const period = getPeriodOfDay(sessionTime);
      return `Scheduled for ${period} at ${timeOfDay}`;
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
    goalTitle: goal?.title || "Coaching Session",
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
