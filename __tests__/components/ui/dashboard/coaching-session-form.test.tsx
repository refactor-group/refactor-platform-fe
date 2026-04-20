import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import type { ReactNode } from "react";
import CoachingSessionForm from "@/components/ui/dashboard/coaching-session-form";
import { TestProviders } from "@/test-utils/providers";
import { EntityApiError } from "@/types/general";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createMockRelationship, createMockSession } from "../../../test-utils";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockUpdate = vi.fn();
vi.mock("@/lib/api/coaching-sessions", () => ({
  useCoachingSessionList: vi.fn(() => ({ refresh: vi.fn() })),
  useCoachingSessionMutation: vi.fn(() => ({
    create: vi.fn(),
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

describe("CoachingSessionForm – coachee dropdown ordering", () => {
  function renderCreateForm() {
    render(
      <Wrapper>
        <CoachingSessionForm mode="create" onOpenChange={vi.fn()} />
      </Wrapper>
    );
  }

  it("lists coachees alphabetically by full name when the user is the coach", () => {
    vi.mocked(useCoachingRelationshipList).mockReturnValue({
      relationships: [
        createMockRelationship({
          id: "r-zoe",
          coach_id: "user-1",
          coachee_first_name: "Zoe",
          coachee_last_name: "Zimmerman",
        }),
        createMockRelationship({
          id: "r-alice",
          coach_id: "user-1",
          coachee_first_name: "Alice",
          coachee_last_name: "Anderson",
        }),
        createMockRelationship({
          id: "r-mike",
          coach_id: "user-1",
          coachee_first_name: "Mike",
          coachee_last_name: "Miller",
        }),
      ],
      isLoading: false,
      isError: false,
      refresh: vi.fn(),
    });

    renderCreateForm();

    fireEvent.click(screen.getByRole("combobox"));

    const optionNames = screen
      .getAllByRole("option")
      .map((o) => o.textContent?.trim());
    expect(optionNames).toEqual([
      "Alice Anderson",
      "Mike Miller",
      "Zoe Zimmerman",
    ]);
  });
});

describe("CoachingSessionForm – handleSubmit error handling", () => {
  /**
   * Renders the form in update mode. The existingSession pre-fills both
   * sessionDate and sessionTime, so the submit button is enabled without
   * needing to interact with the Calendar.
   */
  function renderUpdateForm() {
    render(
      <Wrapper>
        <CoachingSessionForm
          mode="update"
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
        "Your Google Meet integration has been disconnected. Please reconnect in Settings."
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
        "Could not connect to server. Please check your internet connection."
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
        "Could not create Google Meet link due to a connection error. Please try again."
      );
    });
  });

  it("shows a generic toast for other API errors", async () => {
    mockUpdate.mockRejectedValue(makeEntityApiError(500));

    const user = userEvent.setup();
    renderUpdateForm();

    await user.click(screen.getByRole("button", { name: /update session/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to update coaching session. Please try again."
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
        "Failed to update coaching session. Please try again."
      );
    });
  });
});
