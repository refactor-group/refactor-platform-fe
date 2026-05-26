import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CoachingPreferencesSection } from "@/components/ui/settings/coaching-preferences-section";
import { EntityApiError } from "@/types/general";
import { createMockUser } from "../../test-utils";

const AUTOSAVE_DEBOUNCE_MS = 400;

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

const mockUpdate = vi.fn();
const mockRefresh = vi.fn();
let mockUserState = {
  user: createMockUser(),
  isLoading: false,
  isError: undefined,
  refresh: mockRefresh,
};

vi.mock("@/lib/api/users", () => ({
  useUser: () => mockUserState,
  useUserMutation: () => ({
    update: mockUpdate,
    isLoading: false,
  }),
}));

function makeApiError(status: number, data: unknown): EntityApiError {
  const axiosLikeError = Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: { status, statusText: "Error", data },
  });
  return new EntityApiError("PUT", "/users/user-1", axiosLikeError);
}

describe("CoachingPreferencesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockUserState = {
      user: createMockUser({
        id: "user-1",
        default_coaching_session_duration_minutes: 75,
      }),
      isLoading: false,
      isError: undefined,
      refresh: mockRefresh,
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("auth gating", () => {
    it("does not render the section for non-coaches", () => {
      mockAuthStore.mockReturnValue({ isACoach: false, userId: "user-1" });
      const { container } = render(<CoachingPreferencesSection />);
      expect(container.innerHTML).toBe("");
    });
  });

  describe("auto-save behavior", () => {
    beforeEach(() => {
      mockAuthStore.mockReturnValue({ isACoach: true, userId: "user-1" });
    });

    it("calls useUserMutation().update with the new value after the debounce window", async () => {
      mockUpdate.mockResolvedValue(undefined);
      render(<CoachingPreferencesSection />);

      const numericInput = screen.getByRole("combobox", { name: /duration in minutes/i });
      fireEvent.change(numericInput, { target: { value: "45" } });

      // Before the debounce elapses, no save has fired.
      expect(mockUpdate).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
      });

      expect(mockUpdate).toHaveBeenCalledTimes(1);
      const [calledId, calledPayload] = mockUpdate.mock.calls[0];
      expect(calledId).toBe("user-1");
      expect(calledPayload.default_coaching_session_duration_minutes).toBe(45);
    });

    it("coalesces rapid changes into a single PUT (debounce)", async () => {
      mockUpdate.mockResolvedValue(undefined);
      render(<CoachingPreferencesSection />);

      const numericInput = screen.getByRole("combobox", { name: /duration in minutes/i });
      fireEvent.change(numericInput, { target: { value: "30" } });
      fireEvent.change(numericInput, { target: { value: "45" } });
      fireEvent.change(numericInput, { target: { value: "60" } });

      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
      });

      // Only the last value should be saved — the earlier timers are
      // canceled by the useEffect cleanup.
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(
        mockUpdate.mock.calls[0][1].default_coaching_session_duration_minutes
      ).toBe(60);
    });

    it("does not save when the value is invalid (validation gate)", async () => {
      mockUpdate.mockResolvedValue(undefined);
      render(<CoachingPreferencesSection />);

      const numericInput = screen.getByRole("combobox", { name: /duration in minutes/i });
      fireEvent.change(numericInput, { target: { value: "999" } });

      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
      });

      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("surfaces the BE's validation_error message verbatim on 422", async () => {
      mockUpdate.mockRejectedValue(
        makeApiError(422, {
          status_code: 422,
          error: "validation_error",
          message:
            "default_coaching_session_duration_minutes must be between 1 and 480 (got 999)",
        })
      );
      render(<CoachingPreferencesSection />);

      const numericInput = screen.getByRole("combobox", { name: /duration in minutes/i });
      fireEvent.change(numericInput, { target: { value: "45" } });

      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      expect(mockToastError).toHaveBeenCalledWith(
        "default_coaching_session_duration_minutes must be between 1 and 480 (got 999)"
      );
    });

    it("shows a generic fallback toast on non-422 errors", async () => {
      mockUpdate.mockRejectedValue(
        makeApiError(503, { status_code: 503, error: "service_unavailable" })
      );
      render(<CoachingPreferencesSection />);

      const numericInput = screen.getByRole("combobox", { name: /duration in minutes/i });
      fireEvent.change(numericInput, { target: { value: "45" } });

      await act(async () => {
        vi.advanceTimersByTime(AUTOSAVE_DEBOUNCE_MS);
        await Promise.resolve();
      });

      expect(mockToastError).toHaveBeenCalledWith(
        "Couldn't save preferences. Please try again."
      );
    });
  });
});
