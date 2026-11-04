import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import type { ReactNode } from "react";
import CoachingSessionForm from "@/components/ui/dashboard/coaching-session-form";
import { TestProviders } from "@/test-utils/providers";
import { EntityApiError } from "@/types/general";
import { toast } from "@/lib/toast";
import { useRouter } from "next/navigation";
import { DateTime } from "ts-luxon";
import { createMockRelationship, createMockSession } from "../../../test-utils";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("@/lib/toast", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockUpdate = vi.fn();
vi.mock("@/lib/api/coaching-sessions", () => ({
  useCoachingSessionList: vi.fn(() => ({ refresh: vi.fn() })),
  useCoachingSessionMutation: vi.fn(() => ({
    update: mockUpdate,
    delete: vi.fn(),
  })),
}));

vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: vi.fn(() => ({
    relationships: [],
    isLoading: false,
    isError: false,
  })),
}));

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: vi.fn(() => ({ currentOrganizationId: "org-1" })),
}));

const mockRelationshipStore = vi.fn();
vi.mock("@/lib/providers/coaching-relationship-state-store-provider", () => ({
  CoachingRelationshipStateStoreProvider: ({ children }: { children: React.ReactNode }) => children,
  useCoachingRelationshipStateStore: (
    selector: (state: unknown) => unknown
  ) => selector(mockRelationshipStore()),
}));

const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  AuthStoreProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntityApiError(status?: number, data?: unknown): EntityApiError {
  const axiosLikeError = Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response:
      status !== undefined ? { status, statusText: "Error", data } : undefined,
  });
  return new EntityApiError("POST", "/api/coaching_sessions", axiosLikeError);
}

function Wrapper({ children }: { children: ReactNode }) {
  return <TestProviders>{children}</TestProviders>;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const existingSession = createMockSession();

// ── Test setup ────────────────────────────────────────────────────────────────

let mockPush: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();

  mockPush = vi.fn();
  vi.mocked(useRouter).mockReturnValue({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  });

  mockRelationshipStore.mockReturnValue({
    currentCoachingRelationshipId: "rel-1",
  });
  mockAuthStore.mockReturnValue({
    userSession: { id: "user-1", timezone: "UTC" },
  });

  mockUpdate.mockResolvedValue(existingSession);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CoachingSessionForm – handleSubmit error handling", () => {
  /**
   * The existingSession pre-fills both sessionDate and sessionTime, so the
   * submit button is enabled without needing to interact with the Calendar.
   */
  function renderUpdateForm() {
    render(
      <Wrapper>
        <CoachingSessionForm
          existingSession={existingSession}
          onOpenChange={vi.fn()}
        />
      </Wrapper>
    );
  }

  it("shows token-revoked toast and redirects to integrations on 409 oauth_token_revoked", async () => {
    mockUpdate.mockRejectedValue(
      makeEntityApiError(409, { error: "oauth_token_revoked", provider: "google" })
    );

    const user = userEvent.setup();
    renderUpdateForm();

    await user.click(screen.getByRole("button", { name: /update session/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Google Meet is disconnected · Reconnect it in Settings"
      );
      expect(mockPush).toHaveBeenCalledWith("/settings/integrations");
    });
  });

  it("shows a network error toast when the frontend cannot reach the server", async () => {
    mockUpdate.mockRejectedValue(makeEntityApiError(undefined));

    const user = userEvent.setup();
    renderUpdateForm();

    await user.click(screen.getByRole("button", { name: /update session/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't update the session · Check your connection and try again"
      );
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it("shows a Google Meet-specific toast when the backend returns 502", async () => {
    mockUpdate.mockRejectedValue(makeEntityApiError(502));

    const user = userEvent.setup();
    renderUpdateForm();

    await user.click(screen.getByRole("button", { name: /update session/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't create the Google Meet link · Try again"
      );
    });
  });

  it("shows the permission-denied toast on a 403", async () => {
    mockUpdate.mockRejectedValue(makeEntityApiError(403));

    const user = userEvent.setup();
    renderUpdateForm();

    await user.click(screen.getByRole("button", { name: /update session/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "You don't have permission to do that"
      );
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  it("shows a generic toast for other API errors", async () => {
    mockUpdate.mockRejectedValue(makeEntityApiError(500));

    const user = userEvent.setup();
    renderUpdateForm();

    await user.click(screen.getByRole("button", { name: /update session/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't update the coaching session · Try again"
      );
    });
  });

  it("does not show a toast and only logs for non-EntityApiError", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockUpdate.mockRejectedValue(new Error("Unexpected error"));

    const user = userEvent.setup();
    renderUpdateForm();

    await user.click(screen.getByRole("button", { name: /update session/i }));

    await waitFor(() => {
      expect(toast.error).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalled();
    });

    consoleError.mockRestore();
  });

  it("does not redirect on 409 when the error body is not oauth_token_revoked", async () => {
    mockUpdate.mockRejectedValue(
      makeEntityApiError(409, { error: "other_conflict" })
    );

    const user = userEvent.setup();
    renderUpdateForm();

    await user.click(screen.getByRole("button", { name: /update session/i }));

    await waitFor(() => {
      expect(mockPush).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't update the coaching session · Try again"
      );
    });
  });
});

describe("CoachingSessionForm – success toasts", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
    // Chicago, so a late-evening session shows its local date, not UTC's.
    mockAuthStore.mockReturnValue({
      userSession: { id: "user-1", timezone: "America/Chicago" },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function withJamesRelationship() {
    vi.mocked(useCoachingRelationshipList).mockReturnValue({
      relationships: [
        createMockRelationship({
          id: "rel-1",
          coach_id: "user-1",
          coachee_first_name: "James",
          coachee_last_name: "Hodapp",
        }),
      ],
      isLoading: false,
      isError: false,
    } as unknown as ReturnType<typeof useCoachingRelationshipList>);
  }

  it("confirms an update with the session's local date, coachee and time", async () => {
    withJamesRelationship();
    render(
      <Wrapper>
        <CoachingSessionForm
          // 03:00 UTC on Nov 5 is the evening of Nov 4 in Chicago.
          existingSession={createMockSession({
            date: "2026-11-05T03:00:00",
            coaching_relationship_id: "rel-1",
          })}
          onOpenChange={vi.fn()}
        />
      </Wrapper>
    );

    fireEvent.click(screen.getByRole("button", { name: /update session/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Updated the Nov 4 @ 9 PM session with James Hodapp");
    });
  });
});

describe("CoachingSessionForm – calendar initial month", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-08T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens on the month of the existing session, not the current month", () => {
    const scheduled = DateTime.fromISO("2026-11-05T12:00:00Z", { zone: "utc" });
    render(
      <Wrapper>
        <CoachingSessionForm
          existingSession={createMockSession({ date: scheduled.toISO()! })}
          onOpenChange={vi.fn()}
        />
      </Wrapper>
    );

    expect(screen.getByText(scheduled.toFormat("MMMM yyyy"))).toBeInTheDocument();
  });
});
