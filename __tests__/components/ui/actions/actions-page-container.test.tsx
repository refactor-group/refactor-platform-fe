import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import { siteConfig } from "@/site.config";
import { ActionsPageContainer } from "@/components/ui/actions/actions-page-container";
import { TestProviders } from "@/test-utils/providers";
import { TooltipProvider } from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: { children: string }) => children,
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: {},
}));

// Auth store — must include AuthStoreProvider since TestProviders uses it
vi.mock("@/lib/providers/auth-store-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/providers/auth-store-provider")>();
  return {
    ...actual,
    useAuthStore: (sel: (s: Record<string, unknown>) => unknown) =>
      sel({ isACoach: true }),
  };
});

// Organization
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({
    currentOrganizationId: "org-1",
  }),
}));

// Relationships
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => ({
    relationships: [
      {
        id: "rel-1",
        coach_id: "coach-1",
        coachee_id: "coachee-1",
        organization_id: "org-1",
        coach_first_name: "Alice",
        coach_last_name: "Smith",
        coachee_first_name: "Bob",
        coachee_last_name: "Jones",
        created_at: DateTime.now(),
        updated_at: DateTime.now(),
      },
    ],
    isLoading: false,
  }),
}));

// Action mutations
const mockUpdate = vi.fn().mockResolvedValue({});
const mockDelete = vi.fn().mockResolvedValue({});

vi.mock("@/lib/api/actions", () => ({
  useActionMutation: () => ({
    create: vi.fn(),
    update: mockUpdate,
    delete: mockDelete,
    isLoading: false,
    error: null,
  }),
}));

// All actions hook
const now = DateTime.now();
let mockActionsData: AssignedActionWithContext[] = [];
let mockIsLoading = false;
let mockIsError = false;
const mockRefresh = vi.fn();

vi.mock("@/lib/hooks/use-all-actions-with-context", () => ({
  useAllActionsWithContext: () => ({
    actionsWithContext: mockActionsData,
    isLoading: mockIsLoading,
    isError: mockIsError,
    refresh: mockRefresh,
  }),
}));

vi.mock("@/lib/api/entity-api", () => ({
  EntityApiError: class EntityApiError extends Error {
    isNetworkError() {
      return false;
    }
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <TestProviders>
      <TooltipProvider>{children}</TooltipProvider>
    </TestProviders>
  );
}

function makeCtx(
  id: string,
  status: ItemStatus
): AssignedActionWithContext {
  return {
    action: {
      id,
      coaching_session_id: "session-1",
      body: `Action ${id}`,
      user_id: "user-1",
      status,
      status_changed_at: now,
      due_by: now.plus({ days: 7 }),
      created_at: now,
      updated_at: now,
      assignee_ids: ["user-1"],
    },
    relationship: {
      coachingRelationshipId: "rel-1",
      coachId: "coach-1",
      coacheeId: "coachee-1",
      coachName: "Alice Smith",
      coacheeName: "Bob Jones",
    },
    goal: {
      overarchingGoalId: "goal-1",
      title: "Test Goal",
    },
    sourceSession: {
      coachingSessionId: "session-1",
      sessionDate: now,
    },
    nextSession: null,
    isOverdue: false,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ActionsPageContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockActionsData = [];
    mockIsLoading = false;
    mockIsError = false;
    // Reset navigation mocks to defaults (clearAllMocks doesn't reset mockReturnValue)
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams() as any
    );
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    } as any);
  });

  // Helper: column headers are rendered as <h3> elements
  function getColumnHeaders() {
    return screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
  }

  // Helper: open the filter popover (filters are inside a popover now)
  async function openFilterPopover(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: /filters/i }));
  }

  it("renders header and board when data is loaded", () => {
    mockActionsData = [
      makeCtx("a1", ItemStatus.NotStarted),
      makeCtx("a2", ItemStatus.InProgress),
    ];

    render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    expect(screen.getByText("Actions")).toBeInTheDocument();
    const headers = getColumnHeaders();
    expect(headers).toContain("Not Started");
    expect(headers).toContain("In Progress");
  });

  it("shows loading skeletons while data is fetching", () => {
    mockIsLoading = true;

    const { container } = render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    // Skeleton uses animate-pulse class
    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
    // Should NOT render any kanban column headers
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
  });

  it("shows error state when data fetch fails", () => {
    mockIsError = true;

    render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    expect(
      screen.getByText("Failed to load actions. Please try again later.")
    ).toBeInTheDocument();
  });

  it("toggles status visibility to show all 4 columns", async () => {
    mockActionsData = [makeCtx("a1", ItemStatus.NotStarted)];

    const user = userEvent.setup();

    render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    // Initially only Open columns (Not Started + In Progress)
    expect(getColumnHeaders()).not.toContain("Completed");

    // Open the filter popover, then click "All" toggle
    await openFilterPopover(user);
    await user.click(screen.getByText("All"));

    await waitFor(() => {
      const headers = getColumnHeaders();
      expect(headers).toContain("Completed");
      expect(headers).toContain("Won't Do");
    });
  });

  // -------------------------------------------------------------------------
  // Filter popover
  // -------------------------------------------------------------------------

  it("opens filter popover and shows filter controls", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    // Filter controls should not be visible before opening popover
    expect(screen.queryByLabelText("Time range")).not.toBeInTheDocument();

    // Click the filter button to open the popover
    await openFilterPopover(user);

    // All three filter controls should now be visible
    await waitFor(() => {
      expect(screen.getByText("Status")).toBeInTheDocument();
      expect(screen.getByLabelText("Time range")).toBeInTheDocument();
      expect(screen.getByLabelText("Relationship filter")).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // URL query param persistence
  // -------------------------------------------------------------------------

  it("initializes filters from URL query params", () => {
    mockActionsData = [makeCtx("a1", ItemStatus.NotStarted)];
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("status=all&range=all_time") as any
    );

    render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    // "All" visibility renders all 4 columns
    const headers = getColumnHeaders();
    expect(headers).toContain("Not Started");
    expect(headers).toContain("In Progress");
    expect(headers).toContain("Completed");
    expect(headers).toContain("Won't Do");
  });

  it("updates URL when a filter changes", async () => {
    mockActionsData = [makeCtx("a1", ItemStatus.NotStarted)];

    const user = userEvent.setup();

    render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    // Open the filter popover, then click "All" status toggle
    await openFilterPopover(user);
    await user.click(screen.getByText("All"));

    // Get the replace fn from the mocked router (set in beforeEach)
    const mockRouter = vi.mocked(useRouter).mock.results[0].value;
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(
        expect.stringContaining("status=all"),
        { scroll: false }
      );
    });
  });

  it("falls back to defaults for invalid query param values", () => {
    mockActionsData = [makeCtx("a1", ItemStatus.NotStarted)];
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("status=garbage&range=invalid") as any
    );

    render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    // Invalid params should fall back to Open (2 columns: Not Started + In Progress)
    const headers = getColumnHeaders();
    expect(headers).toContain("Not Started");
    expect(headers).toContain("In Progress");
    expect(headers).not.toContain("Completed");
  });

  it("omits default values from URL", async () => {
    mockActionsData = [makeCtx("a1", ItemStatus.NotStarted)];

    // Start with a non-default status
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("status=all") as any
    );

    const user = userEvent.setup();

    render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    // Open the filter popover, then click "Open" to go back to the default
    await openFilterPopover(user);
    await user.click(screen.getByText("Open"));

    // Get the replace fn from the mocked router (set in beforeEach)
    const mockRouter = vi.mocked(useRouter).mock.results[0].value;
    await waitFor(() => {
      // URL should have no query string since all filters are at defaults
      expect(mockRouter.replace).toHaveBeenCalledWith(
        expect.not.stringContaining("status="),
        { scroll: false }
      );
    });
  });
});
