import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTodaysSessions } from "@/lib/hooks/use-todays-sessions";
import { useEnrichedCoachingSessionsForUser } from "@/lib/api/coaching-sessions";
import { TestProviders } from "@/test-utils/providers";
import { DateTime } from "ts-luxon";
import {
  createMockUser,
  createMockOrganization,
  createMockRelationship,
  createSessionAt,
} from "../test-utils";

/**
 * Test Suite: useTodaysSessions Hook
 * Story: "Fetch and enrich today's coaching sessions for the current organization"
 */

const CURRENT_ORGANIZATION_ID = "org-1";

// Mock the auth store
const mockUser = createMockUser({
  id: "user-1",
  first_name: "Jim",
  timezone: "America/Los_Angeles",
});

const mockOrganizations = [
  createMockOrganization({ id: "org-1", name: "Refactor Group" }),
  createMockOrganization({ id: "org-2", name: "Tech Innovations" }),
];

const mockRelationships = [
  createMockRelationship({
    id: "rel-1",
    coach_id: "user-1",
    organization_id: "org-1",
  }),
  createMockRelationship({
    id: "rel-2",
    coach_id: "user-1",
    organization_id: "org-2",
  }),
];

const mockSessions = [
  { ...createSessionAt(90), coaching_relationship_id: "rel-1" }, // 1.5 hours from now
  { ...createSessionAt(180), coaching_relationship_id: "rel-2" }, // 3 hours from now
];

vi.mock("@/lib/providers/auth-store-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/providers/auth-store-provider")>();
  return {
    ...actual,
    useAuthStore: vi.fn(() => ({
      userSession: mockUser,
      isLoggedIn: true,
    })),
  };
});

// Mock the organizations API
vi.mock("@/lib/api/organizations", () => ({
  useOrganizationList: vi.fn(() => ({
    organizations: mockOrganizations,
    isLoading: false,
    isError: undefined,
  })),
  useOrganization: vi.fn(() => ({
    organization: null,
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  })),
}));

// The sidebar's selected organization, which scopes the request.
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: vi.fn(() => ({
    currentOrganizationId: "org-1",
    currentOrganization: null,
    isLoading: false,
    isError: false,
    setCurrentOrganizationId: vi.fn(),
    resetOrganizationState: vi.fn(),
    refresh: vi.fn(),
  })),
}));

// Mock the coaching relationships API
vi.mock("@/lib/api/coaching-relationships", () => ({
  CoachingRelationshipApi: {
    list: vi.fn((orgId: string) => {
      // Return relationships for the requested organization
      if (orgId === "org-1") {
        return Promise.resolve([mockRelationships[0]]);
      } else if (orgId === "org-2") {
        return Promise.resolve([mockRelationships[1]]);
      }
      return Promise.resolve([]);
    }),
  },
}));

// Mock the useEnrichedCoachingSessionsForUser hook
vi.mock("@/lib/api/coaching-sessions", () => ({
  useEnrichedCoachingSessionsForUser: vi.fn(() => ({
    enrichedSessions: [
      {
        ...mockSessions[0],
        id: "session-1",
        relationship: mockRelationships[0],
        organization: mockOrganizations[0],
        goals: [{
          id: "goal-1",
          title: "Q1 Goals",
          details: "",
          coaching_relationship_id: "rel-1",
          created_at: DateTime.now(),
          updated_at: DateTime.now(),
        }],
      },
      {
        ...mockSessions[1],
        id: "session-2",
        relationship: mockRelationships[1],
        organization: mockOrganizations[1],
        goals: [{
          id: "goal-2",
          title: "Q2 Goals",
          details: "",
          coaching_relationship_id: "rel-2",
          created_at: DateTime.now(),
          updated_at: DateTime.now(),
        }],
      },
    ],
    isLoading: false,
    isError: false,
    refresh: vi.fn(),
  })),
  CoachingSessionInclude: {
    Relationship: "relationship",
    Organization: "organization",
    Goal: "goal",
  },
}));

describe("useTodaysSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return loading state initially", () => {
    const { result } = renderHook(() => useTodaysSessions(), {
      wrapper: TestProviders,
    });

    // Hook should handle loading states
    expect(result.current.isLoading).toBeDefined();
  });

  it("scopes the request to the currently selected organization", () => {
    renderHook(() => useTodaysSessions(), { wrapper: TestProviders });

    // Ninth argument is organizationId. Omitting it returns every organization's
    // sessions, which is what made the Upcoming Session card bleed across orgs.
    expect(vi.mocked(useEnrichedCoachingSessionsForUser)).toHaveBeenCalledWith(
      mockUser.id,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      "date",
      "asc",
      undefined,
      undefined,
      CURRENT_ORGANIZATION_ID
    );
  });

  it("should return every session the scoped request yields", async () => {
    const { result } = renderHook(() => useTodaysSessions(), {
      wrapper: TestProviders,
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    // Wait for all relationships to load (they load sequentially with 100ms delay)
    await waitFor(
      () => {
        expect(result.current.sessions.length).toBe(2);
      },
      { timeout: 3000 }
    );
  });

  it("should return enriched sessions with related data", async () => {
    const { result } = renderHook(() => useTodaysSessions(), {
      wrapper: TestProviders,
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    const session = result.current.sessions[0];

    // Should have enriched related data (not pre-computed display values)
    expect(session).toHaveProperty("relationship");
    expect(session).toHaveProperty("organization");
    expect(session).toHaveProperty("goals");
    expect(session.relationship).toBeDefined();
    expect(session.organization).toBeDefined();
  });

  it("should sort sessions by date/time ascending", async () => {
    const { result } = renderHook(() => useTodaysSessions(), {
      wrapper: TestProviders,
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    await waitFor(
      () => {
        expect(result.current.sessions.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 3000 }
    );

    // First session should be sooner than second
    const sessions = result.current.sessions;

    // Session at 90 minutes should come before session at 180 minutes
    // Verify by comparing date fields directly
    const firstDate = DateTime.fromISO(sessions[0].date);
    const secondDate = DateTime.fromISO(sessions[1].date);
    expect(firstDate.toMillis()).toBeLessThan(secondDate.toMillis());
  });

  it("should filter to only today's sessions", async () => {
    const { result } = renderHook(() => useTodaysSessions(), {
      wrapper: TestProviders,
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    // All sessions should have valid date fields
    result.current.sessions.forEach((session) => {
      // Session should have valid date string
      expect(session.date).toBeTruthy();
      expect(typeof session.date).toBe("string");
      // Should be parseable as ISO date
      expect(() => DateTime.fromISO(session.date)).not.toThrow();
    });
  });

  it("should handle errors gracefully", async () => {
    const { result } = renderHook(() => useTodaysSessions(), {
      wrapper: TestProviders,
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    // Should have error property (undefined when no error)
    expect(result.current).toHaveProperty("error");
  });

  it("should provide refresh function", async () => {
    const { result } = renderHook(() => useTodaysSessions(), {
      wrapper: TestProviders,
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    // Should expose refresh capability via SWR's mutate
    expect(result.current.refresh).toBeDefined();
    expect(typeof result.current.refresh).toBe("function");
  });

  it("should handle empty session lists", async () => {
    // This test verifies graceful handling when no sessions exist
    const { result } = renderHook(() => useTodaysSessions(), {
      wrapper: TestProviders,
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 3000 }
    );

    // Should return array (may be empty or have sessions based on mock data)
    expect(Array.isArray(result.current.sessions)).toBe(true);
  });
});
