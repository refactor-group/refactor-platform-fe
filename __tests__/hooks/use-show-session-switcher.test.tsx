import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useShowSessionSwitcher } from "@/lib/hooks/use-show-session-switcher";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { defaultInitState, type AuthStore } from "@/lib/stores/auth-store";
import { useUserCoachingRoles } from "@/lib/api/user-coaching-relationships";

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
      participantRelationshipCount: 0,
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

  it("shows the switcher for a coach with more than one coachee", () => {
    mockRoles({
      isCoach: true,
      coachRelationshipCount: 3,
      participantRelationshipCount: 3,
    });

    const { result } = renderHook(() => useShowSessionSwitcher());

    expect(result.current).toBe(true);
  });

  it("hides the switcher for a coach with a single coachee", () => {
    mockRoles({
      isCoach: true,
      coachRelationshipCount: 1,
      participantRelationshipCount: 1,
    });

    const { result } = renderHook(() => useShowSessionSwitcher());

    expect(result.current).toBe(false);
  });

  it("hides the switcher for a coachee with a single coach", () => {
    mockRoles({
      isCoachee: true,
      coacheeRelationshipCount: 1,
      participantRelationshipCount: 1,
    });

    const { result } = renderHook(() => useShowSessionSwitcher());

    expect(result.current).toBe(false);
  });

  it("shows the switcher for a single-coachee coach who is also coached", () => {
    mockRoles({
      isCoach: true,
      isCoachee: true,
      coachRelationshipCount: 1,
      coacheeRelationshipCount: 1,
      participantRelationshipCount: 2,
    });

    const { result } = renderHook(() => useShowSessionSwitcher());

    expect(result.current).toBe(true);
  });

  it("hides the switcher while relationships are loading", () => {
    mockRoles({
      isCoach: true,
      coachRelationshipCount: 3,
      participantRelationshipCount: 3,
      isLoading: true,
    });

    const { result } = renderHook(() => useShowSessionSwitcher());

    expect(result.current).toBe(false);
  });

  it("hides the switcher when the relationship fetch fails", () => {
    mockRoles({
      isCoach: true,
      coachRelationshipCount: 3,
      participantRelationshipCount: 3,
      isError: true,
    });

    const { result } = renderHook(() => useShowSessionSwitcher());

    expect(result.current).toBe(false);
  });
});
