import { DateTime } from "ts-luxon";
import { CoachingSession } from "@/types/coaching-session";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship";
import { Organization } from "@/types/organization";
import { User } from "@/types/user";

/**
 * Test data factories for consistent, readable test setup
 * Story: "Create realistic test data that reads like a story"
 */

export function createMockUser(overrides?: Partial<User>): User {
  const now = DateTime.now();
  return {
    id: "user-1",
    email: "jim@example.com",
    first_name: "Jim",
    last_name: "Hodapp",
    display_name: "Jim Hodapp",
    timezone: "America/Los_Angeles",
    role: "coach",
    roles: [],
    created_at: now.toISO() ?? '', // User expects string, handle null case
    updated_at: now.toISO() ?? '',
    ...overrides,
  };
}

export function createMockOrganization(
  overrides?: Partial<Organization>
): Organization {
  const now = DateTime.now();
  return {
    id: "org-1",
    name: "Refactor Group",
    slug: "refactor-group",
    created_at: now, // Organization expects DateTime object
    updated_at: now,
    ...overrides,
  };
}

export function createMockRelationship(
  overrides?: Partial<CoachingRelationshipWithUserNames>
): CoachingRelationshipWithUserNames {
  const now = DateTime.now();
  return {
    id: "rel-1",
    coach_id: "user-1",
    coachee_id: "user-2",
    organization_id: "org-1",
    coach_first_name: "Jim",
    coach_last_name: "Hodapp",
    coachee_first_name: "Caleb",
    coachee_last_name: "Bourg",
    created_at: now, // CoachingRelationship expects DateTime object
    updated_at: now,
    ...overrides,
  };
}

export function createMockSession(
  overrides?: Partial<CoachingSession>
): CoachingSession {
  const now = DateTime.now();
  return {
    id: "session-1",
    coaching_relationship_id: "rel-1",
    date: now.plus({ hours: 2 }).toISO() ?? '', // Date is ISO string
    created_at: now, // CoachingSession expects DateTime object
    updated_at: now,
    ...overrides,
  };
}

/**
 * Create a session at a specific time relative to "now"
 * Story: "Make it easy to test different time scenarios"
 */
export function createSessionAt(minutesFromNow: number): CoachingSession {
  return createMockSession({
    date: DateTime.now().plus({ minutes: minutesFromNow }).toISO(),
  });
}
