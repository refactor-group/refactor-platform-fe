import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CoachingSessionsCard } from "@/components/ui/dashboard/coaching-sessions-card";
import { createMockEnrichedSession } from "../../../test-utils";

// ── Mocks ────────────────────────────────────────────────────────────────

const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

const mockSetRelationshipFilter = vi.fn();
const mockFilterStore = vi.fn();
vi.mock(
  "@/lib/providers/coaching-sessions-card-filter-store-provider",
  () => ({
    useCoachingSessionsCardFilterStore: (
      selector: (state: unknown) => unknown
    ) => selector(mockFilterStore()),
  })
);

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));

const mockUseCoachingRelationshipList = vi.fn();
vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => mockUseCoachingRelationshipList(),
}));

const mockDelete = vi.fn();
vi.mock("@/lib/api/coaching-sessions", () => ({
  useCoachingSessionMutation: () => ({ delete: mockDelete }),
}));

// `useSWRConfig().mutate` is what the card calls to revalidate the
// user-scoped fetches after a successful delete. The auto-invalidation
// inside `useEntityMutation` only matches string keys, so this manual
// tuple-aware revalidation is load-bearing — assert it ran.
const mockSWRMutate = vi.fn();
vi.mock("swr", async () => {
  const actual = await vi.importActual<typeof import("swr")>("swr");
  return {
    ...actual,
    useSWRConfig: () => ({ mutate: mockSWRMutate }),
  };
});

const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// Stub BucketsContainer with a tiny harness — a single button that
// forwards a known session to the card's `onRequestDelete` callback,
// letting tests drive the delete flow without the bucket internals.
vi.mock("@/components/ui/dashboard/session-buckets/buckets-container", () => ({
  BucketsContainer: ({
    onRequestDelete,
  }: {
    onRequestDelete: (s: unknown) => void;
  }) => (
    <button
      type="button"
      data-testid="bucket-stub-delete"
      onClick={() => onRequestDelete(STUB_SESSION)}
    >
      trigger delete
    </button>
  ),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────

const COACH_USER = {
  id: "coach-1",
  timezone: "UTC",
};

const STUB_SESSION = createMockEnrichedSession({ id: "session-to-delete" });

function setupAuth(user = COACH_USER) {
  mockAuthStore.mockReturnValue({ userSession: user, isACoach: true });
}

function setupFilterStore(
  overrides: { relationshipFilter?: string } = {}
) {
  mockFilterStore.mockReturnValue({
    relationshipFilter: overrides.relationshipFilter,
    setRelationshipFilter: mockSetRelationshipFilter,
  });
}

function setupRelationships(
  relationships: Array<{ id: string; coach_id: string; coachee_id: string }> = [],
  isLoading = false
) {
  mockUseCoachingRelationshipList.mockReturnValue({
    relationships: relationships.map((r) => ({
      ...r,
      organization_id: "org-1",
      coach_first_name: "Coach",
      coach_last_name: "One",
      coachee_first_name: "Coachee",
      coachee_last_name: "One",
    })),
    isLoading,
    isError: undefined,
    refresh: vi.fn(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setupAuth();
  setupFilterStore();
  setupRelationships();
});

// ── Delete flow ──────────────────────────────────────────────────────────

describe("CoachingSessionsCard — delete flow", () => {
  it("opens the dialog, calls deleteSession + SWR mutate on confirm", async () => {
    mockDelete.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    await user.click(screen.getByTestId("bucket-stub-delete"));

    // The dialog mounts with the alertdialog role.
    expect(
      await screen.findByRole("alertdialog", { name: /delete this coaching/i })
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /^delete session$/i })
    );

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith("session-to-delete");
    });
    expect(mockSWRMutate).toHaveBeenCalled();
    // Dialog closes after a successful delete.
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it("surfaces an error toast and closes the dialog when deleteSession rejects", async () => {
    mockDelete.mockRejectedValueOnce(new Error("network down"));
    const user = userEvent.setup();
    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    await user.click(screen.getByTestId("bucket-stub-delete"));
    await user.click(
      screen.getByRole("button", { name: /^delete session$/i })
    );

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Failed to delete session",
        expect.objectContaining({ description: "network down" })
      );
    });
    expect(mockSWRMutate).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
  });
});

// ── Stale relationship-filter cleanup ────────────────────────────────────

describe("CoachingSessionsCard — stale relationship filter cleanup", () => {
  it("clears the persisted filter once relationships load and it no longer resolves", async () => {
    // Filter points at a relationship the user no longer has access to.
    setupFilterStore({ relationshipFilter: "rel-orphan" });
    setupRelationships([
      { id: "rel-1", coach_id: "coach-1", coachee_id: "coachee-1" },
    ]);

    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    await waitFor(() => {
      expect(mockSetRelationshipFilter).toHaveBeenCalledWith(undefined);
    });
  });

  it("does NOT clear the filter while relationships are still loading", () => {
    // SWR initially returns `[]` even though the network is in flight — the
    // card must wait for `isLoading=false` before deciding the filter is
    // stale, otherwise it would erase the user's persisted choice on every
    // mount.
    setupFilterStore({ relationshipFilter: "rel-1" });
    setupRelationships([], /* isLoading */ true);

    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    expect(mockSetRelationshipFilter).not.toHaveBeenCalled();
  });

  it("keeps the filter intact when it still resolves to an existing relationship", () => {
    setupFilterStore({ relationshipFilter: "rel-1" });
    setupRelationships([
      { id: "rel-1", coach_id: "coach-1", coachee_id: "coachee-1" },
    ]);

    render(<CoachingSessionsCard onReschedule={vi.fn()} />);

    expect(mockSetRelationshipFilter).not.toHaveBeenCalled();
  });
});
