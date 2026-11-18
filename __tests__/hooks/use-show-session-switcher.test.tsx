import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useShowSessionSwitcher } from "@/lib/hooks/use-show-session-switcher";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { defaultInitState, type AuthStore } from "@/lib/stores/auth-store";
import { useUserCoachingRoles } from "@/lib/api/user-coaching-relationships";
import type { RelationshipViewer } from "@/types/coaching-relationship";
import { COACHEE_VIEWER, COACH_VIEWER, COLLEAGUE_VIEWER, createMockRelationship } from "../test-utils";

vi.mock("@/lib/providers/auth-store-provider");
vi.mock("@/lib/api/user-coaching-relationships");

describe("useShowSessionSwitcher", () => {
  const mockUseAuthStore = vi.mocked(useAuthStore);
  const mockUseUserCoachingRoles = vi.mocked(useUserCoachingRoles);

  const authStore = (overrides: Partial<AuthStore> = {}): AuthStore => ({
    ...defaultInitState,
    syncUserSession: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    setTimezone: vi.fn(),
    setIsCurrentCoach: vi.fn(),
    getIsCurrentCoach: vi.fn(() => false),
    setIsACoach: vi.fn(),
    getIsACoach: vi.fn(() => false),
    ...overrides,
  });

  const mockRoles = (overrides: Partial<ReturnType<typeof useUserCoachingRoles>>) => {
    mockUseUserCoachingRoles.mockReturnValue({
      isCoach: false,
      isCoachee: false,
      coachRelationshipCount: 0,
      coacheeRelationshipCount: 0,
      relationships: [],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
      ...overrides,
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuthStore.mockImplementation((selector) =>
      selector(authStore({ userId: "user-1" }))
    );
  });

  const as = (viewer: RelationshipViewer | null) => createMockRelationship({ viewer });
  const coach = () => as(COACH_VIEWER);
  const coachee = () => as(COACHEE_VIEWER);
  const colleague = () => as(COLLEAGUE_VIEWER);

  it.each([
    ["a coach of one person", true, [coach()]],
    ["a coach of several people", true, [coach(), coach(), coach()]],
    ["a colleague of one person", true, [colleague()]],
    ["a coach who is also coached", true, [coach(), coachee()]],
    ["a colleague who is also coached", true, [colleague(), coachee()]],
    ["a coachee with one coach", false, [coachee()]],
    ["a coachee with two coaches", false, [coachee(), coachee()]],
    ["an admin in no relationship", false, [as(null)]],
    ["someone with no relationships", false, []],
  ])("for %s, shown: %s", (_who, shown, relationships) => {
    mockRoles({ relationships });
    const { result } = renderHook(() => useShowSessionSwitcher());
    expect(result.current).toBe(shown);
  });

  it("hides the switcher while relationships are loading", () => {
    mockRoles({ relationships: [coach()], isLoading: true });
    const { result } = renderHook(() => useShowSessionSwitcher());
    expect(result.current).toBe(false);
  });

  it("hides the switcher when the relationship fetch fails", () => {
    mockRoles({ relationships: [coach()], isError: true });
    const { result } = renderHook(() => useShowSessionSwitcher());
    expect(result.current).toBe(false);
  });
});
