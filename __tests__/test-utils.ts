import { DateTime } from "ts-luxon";
import { Action } from "@/types/action";
import { Agreement } from "@/types/agreement";
import { CoachingSession, EnrichedCoachingSession } from "@/types/coaching-session";
import { CoachingRelationshipWithUserNames } from "@/types/coaching_relationship";
import { Goal } from "@/types/goal";
import { ItemStatus } from "@/types/general";
import { None } from "@/types/option";
import { Organization } from "@/types/organization";
import { User } from "@/types/user";
import { OAuthConnection } from "@/types/oauth-connection";

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

/**
 * Create an EnrichedCoachingSession fixture with sensible defaults for
 * relationship, coach, coachee, organization, and one goal. Override fields
 * via the partial argument.
 */
export function createMockEnrichedSession(
  overrides?: Partial<EnrichedCoachingSession>
): EnrichedCoachingSession {
  const now = DateTime.now();
  return {
    id: "session-1",
    coaching_relationship_id: "rel-1",
    date: now.plus({ hours: 2 }).toISO() ?? "",
    created_at: now,
    updated_at: now,
    relationship: {
      id: "rel-1",
      coach_id: "coach-1",
      coachee_id: "coachee-1",
      organization_id: "org-1",
      created_at: now,
      updated_at: now,
    },
    coach: {
      id: "coach-1",
      email: "coach@example.com",
      first_name: "Jim",
      last_name: "Hodapp",
      display_name: "Jim Hodapp",
      timezone: "America/Los_Angeles",
      role: "coach",
      roles: [],
      created_at: now.toISO() ?? "",
      updated_at: now.toISO() ?? "",
    },
    coachee: {
      id: "coachee-1",
      email: "coachee@example.com",
      first_name: "Alex",
      last_name: "Chen",
      display_name: "Alex Chen",
      timezone: "America/Los_Angeles",
      role: "user",
      roles: [],
      created_at: now.toISO() ?? "",
      updated_at: now.toISO() ?? "",
    },
    organization: {
      id: "org-1",
      name: "Refactor Group",
      slug: "refactor-group",
      created_at: now,
      updated_at: now,
    },
    goals: [],
    ...overrides,
  };
}

/** Create an EnrichedCoachingSession offset by minutesFromNow. */
export function createEnrichedSessionAt(
  minutesFromNow: number,
  overrides?: Partial<EnrichedCoachingSession>
): EnrichedCoachingSession {
  return createMockEnrichedSession({
    date: DateTime.now().plus({ minutes: minutesFromNow }).toISO() ?? "",
    ...overrides,
  });
}

export function createMockGoal(overrides?: Partial<Goal>): Goal {
  const now = DateTime.now();
  return {
    id: "goal-1",
    coaching_relationship_id: "rel-1",
    created_in_session_id: "session-1",
    user_id: "user-1",
    title: "Improve communication",
    body: "Work on active listening",
    status: ItemStatus.NotStarted,
    status_changed_at: now,
    completed_at: now,
    target_date: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function createMockAction(overrides?: Partial<Action>): Action {
  const now = DateTime.now();
  return {
    id: "action-1",
    coaching_session_id: "session-1",
    goal_id: None,
    body: "Follow up on resume review",
    user_id: "user-1",
    status: ItemStatus.NotStarted,
    status_changed_at: now,
    due_by: now.plus({ days: 7 }),
    created_at: now,
    updated_at: now,
    assignee_ids: ["user-1"],
    ...overrides,
  };
}

export function createMockAgreement(
  overrides?: Partial<Agreement>
): Agreement {
  const now = DateTime.now();
  return {
    id: "agreement-1",
    coaching_session_id: "session-1",
    body: "Weekly check-in every Tuesday",
    user_id: "user-1",
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

export function createMockGoogleOAuthConnectionState(
  overrides?: Partial<OAuthConnection>
): OAuthConnection {
  return {
    provider: "google",
    email: "coach@gmail.com",
    connected_at: "2026-01-15T10:00:00Z",
    ...overrides,
  };
}

export function createMockZoomOAuthConnectionState(
  overrides?: Partial<OAuthConnection>
): OAuthConnection {
  return {
    provider: "zoom",
    email: "coach@zoom.us",
    connected_at: "2026-02-15T10:00:00Z",
    ...overrides,
  };
}
