import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useRouter } from "next/navigation";
import { CoachingSessionDialog } from "@/components/ui/dashboard/coaching-session-dialog";
import { EntityApiError } from "@/types/general";
import { createMockUser, createMockSession } from "../test-utils";

const mockToastSuccess = vi.fn();
const mockToastError = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  }),
}));

const mockAuthStore = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector(mockAuthStore()),
}));

const mockCoachingRelationshipState = vi.fn();
vi.mock("@/lib/providers/coaching-relationship-state-store-provider", () => ({
  useCoachingRelationshipStateStore: (selector: (state: unknown) => unknown) =>
    selector(mockCoachingRelationshipState()),
}));

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));

const mockUserFetch = vi.fn();
vi.mock("@/lib/api/users", () => ({
  useUser: (id: string) => mockUserFetch(id),
  useUserMutation: () => ({
    update: vi.fn(),
    isLoading: false,
  }),
}));

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockCreateRecurring = vi.fn();
vi.mock("@/lib/api/coaching-sessions", () => ({
  useCoachingSessionList: () => ({ refresh: vi.fn() }),
  useCoachingSessionMutation: () => ({
    create: mockCreate,
    update: mockUpdate,
  }),
  CoachingSessionApi: {
    createRecurring: (...args: unknown[]) => mockCreateRecurring(...args),
  },
}));

vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => ({
    relationships: [
      {
        id: "rel-1",
        coach_id: "user-1",
        coachee_id: "user-2",
        organization_id: "org-1",
        coach_first_name: "Jim",
        coach_last_name: "Hodapp",
        coachee_first_name: "Alex",
        coachee_last_name: "Chen",
      },
    ],
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/api/oauth-connection", () => ({
  useOAuthConnections: () => ({ connections: [] }),
}));

function makeApiError(status: number, data: unknown): EntityApiError {
  const axiosLikeError = Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: { status, statusText: "Error", data },
  });
  return new EntityApiError("POST", "/coaching_sessions", axiosLikeError);
}

describe("Coaching session duration integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthStore.mockReturnValue({
      userSession: {
        id: "user-1",
        timezone: "America/Los_Angeles",
      },
      userId: "user-1",
      isACoach: true,
    });
    mockCoachingRelationshipState.mockReturnValue({
      currentCoachingRelationshipId: "rel-1",
    });
    mockUserFetch.mockReturnValue({
      user: createMockUser({
        id: "user-1",
        default_coaching_session_duration_minutes: 50,
      }),
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    });
    vi.mocked(useRouter).mockReturnValue({
      push: vi.fn(),
      replace: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
      prefetch: vi.fn(),
    });
  });

  describe("create mode: pre-populates from coach default and sends duration_minutes", () => {
    it("opens with coach's stored default (50) in the duration input", async () => {
      render(<CoachingSessionDialog open onOpenChange={vi.fn()} />);
      const durationInput = await screen.findByRole("spinbutton", {
        name: /duration in minutes/i,
      });
      expect(durationInput).toHaveValue(50);
    });

    it("includes duration_minutes in the POST /coaching_sessions payload", async () => {
      mockCreate.mockResolvedValue(undefined);
      const user = userEvent.setup();
      render(<CoachingSessionDialog open onOpenChange={vi.fn()} />);

      const today = new Date();
      const dayLabel = String(today.getDate());
      const dayButtons = screen.getAllByRole("gridcell", { name: dayLabel });
      await user.click(dayButtons[0]);

      const timeInput = document.getElementById(
        "session-time"
      ) as HTMLInputElement;
      fireEvent.change(timeInput, { target: { value: "10:00" } });

      const durationInput = screen.getByRole("spinbutton", {
        name: /duration in minutes/i,
      });
      fireEvent.change(durationInput, { target: { value: "30" } });

      const submitButton = screen.getByRole("button", { name: /create session/i });
      await act(async () => {
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalled();
      });
      const payload = mockCreate.mock.calls[0][0];
      expect(payload.duration_minutes).toBe(30);
    });
  });

  describe("update mode: pre-populates from existing session", () => {
    it("renders the input with existingSession.duration_minutes (not the coach default)", async () => {
      const existing = createMockSession({
        id: "sess-1",
        duration_minutes: 90,
      });
      render(
        <CoachingSessionDialog
          open
          onOpenChange={vi.fn()}
          coachingSessionToEdit={existing}
        />
      );
      const durationInput = await screen.findByRole("spinbutton", {
        name: /duration in minutes/i,
      });
      // 90 != coach default 50 — proves the existing session's value wins.
      expect(durationInput).toHaveValue(90);
    });

    it("sends the new duration_minutes in PUT /coaching_sessions/{id} payload", async () => {
      mockUpdate.mockResolvedValue(undefined);
      const existing = createMockSession({
        id: "sess-1",
        duration_minutes: 75,
      });
      const user = userEvent.setup();
      render(
        <CoachingSessionDialog
          open
          onOpenChange={vi.fn()}
          coachingSessionToEdit={existing}
        />
      );

      const durationInput = screen.getByRole("spinbutton", {
        name: /duration in minutes/i,
      });
      fireEvent.change(durationInput, { target: { value: "100" } });

      const submitButton = screen.getByRole("button", { name: /update session/i });
      await act(async () => {
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalled();
      });
      const [calledId, payload] = mockUpdate.mock.calls[0];
      expect(calledId).toBe("sess-1");
      expect(payload.duration_minutes).toBe(100);
    });
  });

  describe("422 validation_error surfaces BE message verbatim", () => {
    it("toasts error.data.message instead of the generic 422 fallback", async () => {
      mockUpdate.mockRejectedValue(
        makeApiError(422, {
          status_code: 422,
          error: "validation_error",
          message: "duration_minutes must be between 1 and 480 (got 999)",
        })
      );
      const existing = createMockSession({
        id: "sess-1",
        duration_minutes: 60,
      });
      const user = userEvent.setup();
      render(
        <CoachingSessionDialog
          open
          onOpenChange={vi.fn()}
          coachingSessionToEdit={existing}
        />
      );

      const submitButton = screen.getByRole("button", { name: /update session/i });
      await act(async () => {
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith(
          "duration_minutes must be between 1 and 480 (got 999)"
        );
      });
    });
  });
});
