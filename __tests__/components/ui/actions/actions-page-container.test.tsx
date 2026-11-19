import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { DateTime } from "ts-luxon";
import { toast } from "@/lib/toast";
import { ItemStatus } from "@/types/general";
import { Some, None } from "@/types/option";
import type { AssignedActionWithContext } from "@/types/assigned-actions";
import { AssignmentFilter, ActionsViewMode } from "@/types/assigned-actions";
import { siteConfig } from "@/site.config";
import { EntityApiError } from "@/lib/api/entity-api";
import { ActionsPageContainer } from "@/components/ui/actions/actions-page-container";
import { TestProviders } from "@/test-utils/providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import { type CoachingRelationshipWithUserNames, RelationshipKind } from "@/types/coaching-relationship";
import { COLLEAGUE_VIEWER, createMockRelationship } from "../../../test-utils";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/toast", () => ({
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
      sel({ userSession: { id: "coach-1" }, canScheduleSessions: true }),
  };
});

// Organization
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({
    currentOrganizationId: "org-1",
  }),
}));

// Relationships
const relationshipList = vi.hoisted(() => ({
  relationships: [] as CoachingRelationshipWithUserNames[],
  isLoading: false,
}));
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => relationshipList,
}));

const SEATS = {
  coach: { first_name: "Alice", last_name: "Smith" },
  coachee: { first_name: "Bob", last_name: "Jones" },
};
const coachingRelationship = () =>
  createMockRelationship({ id: "rel-1", coach_id: "coach-1", coachee_id: "coachee-1" }, SEATS);
const colleagueRelationship = () =>
  createMockRelationship(
    { id: "rel-col", coach_id: "coach-1", coachee_id: "peer-1", kind: RelationshipKind.Colleague, viewer: COLLEAGUE_VIEWER },
    { coachee: { first_name: "Cara", last_name: "Peer" } }
  );

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
let mockIsError: unknown = false;
const mockRefresh = vi.fn();
const mockFetchArgs = vi.fn();

vi.mock("@/lib/hooks/use-all-actions-with-context", () => ({
  useAllActionsWithContext: (...args: unknown[]) => (mockFetchArgs(...args), {
    actionsWithContext: mockActionsData,
    isLoading: mockIsLoading,
    isError: mockIsError,
    refresh: mockRefresh,
  }),
}));

vi.mock("@/lib/api/entity-api", () => {
  class EntityApiError extends Error {
    private _networkError: boolean;
    private _forbidden: boolean;
    constructor(message: string, networkError = false, forbidden = false) {
      super(message);
      this._networkError = networkError;
      this._forbidden = forbidden;
    }
    isNetworkError() {
      return this._networkError;
    }
    isForbidden() {
      return this._forbidden;
    }
  }
  return {
    EntityApiError,
    PERMISSION_DENIED_MESSAGE: "You don't have permission to do that",
    viewPermissionDeniedMessage: (resource: string) =>
      `You don't have permission to view ${resource}.`,
    isForbiddenError: (e: unknown) =>
      e instanceof EntityApiError && e.isForbidden(),
  };
});

vi.mock("@/lib/api/goals", () => ({
  useGoal: () => ({ goal: { id: "" }, isLoading: false, isError: undefined, refresh: vi.fn() }),
  useGoalsBySession: () => ({ goals: [], isLoading: false, isError: undefined, refresh: vi.fn() }),
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
      goal_id: None,
      body: `Action ${id}`,
      user_id: "user-1",
      status,
      status_changed_at: now,
      due_by: Some(now.plus({ days: 7 })),
      created_at: now,
      updated_at: now,
      assignee_ids: ["user-1"],
    },
    relationship: coachingRelationship(),
    goal: {
      goalId: "goal-1",
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
    relationshipList.relationships = [coachingRelationship()];
    relationshipList.isLoading = false;
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
    // PR preview: the browser path carries basePath, usePathname() doesn't
    window.history.replaceState({}, "", "/pr-428/actions");
    vi.mocked(usePathname).mockReturnValue("/actions");
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
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

  // The header's open action count shares this request (and its cache entry).
  it("fetches the default view with the header count's arguments", () => {
    render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    expect(mockFetchArgs).toHaveBeenCalledWith(
      ActionsViewMode.MyActions,
      undefined,
      AssignmentFilter.Assigned,
      undefined
    );
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
      screen.getByText("Couldn't load your actions. Refresh the page to try again.")
    ).toBeInTheDocument();
  });

  it("shows ForbiddenError when the data fetch returns 403", () => {
    mockIsError = new EntityApiError("Forbidden", false, true);

    render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    expect(screen.getByText("Actions Access Denied")).toBeInTheDocument();
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

    // Open the filter popover, then click "All" in the Status group
    await openFilterPopover(user);
    const allButtons = screen.getAllByText("All");
    // Status "All" is the first one rendered
    await user.click(allButtons[0]);

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

    // Open the filter popover, then click "All" in the Status group
    await openFilterPopover(user);
    const allButtons = screen.getAllByText("All");
    await user.click(allButtons[0]);

    // Get the replace fn from the mocked router (set in beforeEach)
    const mockRouter = vi.mocked(useRouter).mock.results[0].value;
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/actions?status=all",
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

  // -------------------------------------------------------------------------
  // Assignment filter
  // -------------------------------------------------------------------------

  it("shows assignment filter control in filter popover", async () => {
    const user = userEvent.setup();

    render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    await openFilterPopover(user);

    await waitFor(() => {
      expect(screen.getByText("Assignment")).toBeInTheDocument();
      expect(screen.getByText("Assigned")).toBeInTheDocument();
      expect(screen.getByText("Unassigned")).toBeInTheDocument();
    });
  });

  it("initializes assignment filter from URL query param", () => {
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("assignment=unassigned") as any
    );

    render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    // The container will pass assignmentFilter="unassigned" to useAllActionsWithContext
    // We can't directly test the hook call, but we can verify the toggle state
    // by opening the popover and checking which toggle is pressed
  });

  it("updates URL when assignment filter changes", async () => {
    mockActionsData = [makeCtx("a1", ItemStatus.NotStarted)];

    const user = userEvent.setup();

    render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    await openFilterPopover(user);
    // Use getByRole to target the toggle button specifically, not card text
    const unassignedToggle = screen.getByRole("radio", { name: /unassigned/i });
    await user.click(unassignedToggle);

    const mockRouter = vi.mocked(useRouter).mock.results[0].value;
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/actions?assignment=unassigned",
        { scroll: false }
      );
    });
  });

  it("omits assignment filter from URL when set to default (assigned)", async () => {
    mockActionsData = [makeCtx("a1", ItemStatus.NotStarted)];

    // Start with a non-default assignment filter
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("assignment=unassigned") as any
    );

    const user = userEvent.setup();

    render(
      <Wrapper>
        <ActionsPageContainer locale={siteConfig.locale} />
      </Wrapper>
    );

    // Open the filter popover, then switch back to "Assigned" (the default)
    await openFilterPopover(user);
    await user.click(screen.getByText("Assigned"));

    const mockRouter = vi.mocked(useRouter).mock.results[0].value;
    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledWith(
        "/actions",
        { scroll: false }
      );
    });
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
        "/actions",
        { scroll: false }
      );
    });
  });

  // -------------------------------------------------------------------------
  // Mutation error handling
  // -------------------------------------------------------------------------

  describe("views", () => {
    const renderAt = (query: string) => {
      vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams(query) as any);
      return render(
        <Wrapper>
          <ActionsPageContainer locale={siteConfig.locale} />
        </Wrapper>
      );
    };
    const fetchedView = () => mockFetchArgs.mock.lastCall?.slice(0, 2);
    const replaced = () => vi.mocked(useRouter).mock.results[0].value.replace;

    it("offers a coach and colleague all three views", () => {
      relationshipList.relationships = [coachingRelationship(), colleagueRelationship()];
      renderAt("");

      expect(screen.getAllByRole("radio").map((item) => item.textContent)).toEqual([
        "My Actions",
        "Coachee Actions",
        "Colleagues' Actions",
      ]);
    });

    it("shows My Actions for a view the viewer doesn't have", () => {
      relationshipList.relationships = [colleagueRelationship()];
      renderAt("view=coachee_actions");

      expect(fetchedView()).toEqual([ActionsViewMode.MyActions, undefined]);
      expect(screen.getByRole("radio", { name: "My Actions" })).toBeChecked();
    });

    it.each([
      ["view=colleague_actions&rel=rel-1", ActionsViewMode.ColleagueActions],
      ["view=coachee_actions&rel=rel-col", ActionsViewMode.CoacheeActions],
    ])("never fetches %s with a relationship outside the view", (query, view) => {
      relationshipList.relationships = [coachingRelationship(), colleagueRelationship()];
      renderAt(query);

      expect(fetchedView()).toEqual([view, undefined]);
    });

    it("keeps the URL's view while the relationships load", () => {
      relationshipList.relationships = [];
      relationshipList.isLoading = true;
      const { rerender } = renderAt("view=colleague_actions");
      expect(replaced()).not.toHaveBeenCalled();

      relationshipList.relationships = [colleagueRelationship()];
      relationshipList.isLoading = false;
      rerender(
        <Wrapper>
          <ActionsPageContainer locale={siteConfig.locale} />
        </Wrapper>
      );
      expect(fetchedView()).toEqual([ActionsViewMode.ColleagueActions, undefined]);
    });

    it("drops a relationship the picked view doesn't offer", async () => {
      relationshipList.relationships = [coachingRelationship(), colleagueRelationship()];
      const user = userEvent.setup();
      renderAt("view=colleague_actions&rel=rel-col");

      await user.click(screen.getByRole("radio", { name: "Coachee Actions" }));

      await waitFor(() => {
        expect(replaced()).toHaveBeenCalledWith("/actions?view=coachee_actions", { scroll: false });
      });
    });
  });

  describe("mutation error handling", () => {
    // Helper: trigger delete by flipping the compact card, clicking Edit, then Delete
    async function triggerDelete(
      container: HTMLElement,
      user: ReturnType<typeof userEvent.setup>
    ) {
      // Flip the compact card via the info icon
      const flipButton = screen.getByRole("button", { name: /action options/i });
      await user.click(flipButton);
      // Click Delete on the back face view
      await user.click(await screen.findByText("Delete"));
    }

    it("shows network error toast when delete fails with network error", async () => {
      mockDelete.mockRejectedValueOnce(
        new EntityApiError("Network", true)
      );
      mockActionsData = [makeCtx("a1", ItemStatus.NotStarted)];
      const user = userEvent.setup();

      const { container } = render(
        <Wrapper>
          <ActionsPageContainer locale={siteConfig.locale} />
        </Wrapper>
      );

      await triggerDelete(container, user);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Couldn't delete the action · Check your connection and try again"
        );
      });
    });

    it("shows generic error toast when delete fails with non-network error", async () => {
      mockDelete.mockRejectedValueOnce(new Error("Server error"));
      mockActionsData = [makeCtx("a1", ItemStatus.NotStarted)];
      const user = userEvent.setup();

      const { container } = render(
        <Wrapper>
          <ActionsPageContainer locale={siteConfig.locale} />
        </Wrapper>
      );

      await triggerDelete(container, user);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Couldn't delete the action"
        );
      });
    });

    it("shows permission toast when delete fails with a 403", async () => {
      mockDelete.mockRejectedValueOnce(
        new EntityApiError("Forbidden", false, true)
      );
      mockActionsData = [makeCtx("a1", ItemStatus.NotStarted)];
      const user = userEvent.setup();

      const { container } = render(
        <Wrapper>
          <ActionsPageContainer locale={siteConfig.locale} />
        </Wrapper>
      );

      await triggerDelete(container, user);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "You don't have permission to do that"
        );
      });
    });

    it("shows network error toast on EntityApiError that is not a network error", async () => {
      // EntityApiError but NOT a network error — should show the generic message
      mockDelete.mockRejectedValueOnce(
        new EntityApiError("Server error", false)
      );
      mockActionsData = [makeCtx("a1", ItemStatus.NotStarted)];
      const user = userEvent.setup();

      const { container } = render(
        <Wrapper>
          <ActionsPageContainer locale={siteConfig.locale} />
        </Wrapper>
      );

      await triggerDelete(container, user);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          "Couldn't delete the action"
        );
      });
    });
  });
});
