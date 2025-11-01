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
  return {
    id: "user-1",
    email: "jim@example.com",
    first_name: "Jim",
    last_name: "Hodapp",
    display_name: "Jim Hodapp",
    timezone: "America/Los_Angeles",
    role: "coach",
    roles: [],
    created_at: DateTime.now().toISO(),
    updated_at: DateTime.now().toISO(),
    ...overrides,
  };
}

export function createMockOrganization(
  overrides?: Partial<Organization>
): Organization {
  return {
    id: "org-1",
    name: "Refactor Group",
    slug: "refactor-group",
    created_at: DateTime.now().toISO(),
    updated_at: DateTime.now().toISO(),
    ...overrides,
  };
}

export function createMockRelationship(
  overrides?: Partial<CoachingRelationshipWithUserNames>
): CoachingRelationshipWithUserNames {
  return {
    id: "rel-1",
    coach_id: "user-1",
    coachee_id: "user-2",
    organization_id: "org-1",
    coach_first_name: "Jim",
    coach_last_name: "Hodapp",
    coachee_first_name: "Caleb",
    coachee_last_name: "Bourg",
    created_at: DateTime.now().toISO(),
    updated_at: DateTime.now().toISO(),
    ...overrides,
  };
}

export function createMockSession(
  overrides?: Partial<CoachingSession>
): CoachingSession {
  return {
    id: "session-1",
    coaching_relationship_id: "rel-1",
    date: DateTime.now().plus({ hours: 2 }).toISO(), // 2 hours from now by default
    created_at: DateTime.now().toISO(),
    updated_at: DateTime.now().toISO(),
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
