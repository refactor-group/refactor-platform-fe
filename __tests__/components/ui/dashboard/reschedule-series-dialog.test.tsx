import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { toast } from "sonner";
import { RescheduleSeriesDialog } from "@/components/ui/dashboard/reschedule-series-dialog";
import { CoachingSessionSeries } from "@/types/coaching-session-series";
import { Frequency } from "@/types/recurrence";
import { Some, None } from "@/types/option";
import { EntityApiError } from "@/types/entity-api-error";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const mockUpdate = vi.fn();
vi.mock("@/lib/api/coaching-session-series", () => ({
  useCoachingSessionSeriesMutation: vi.fn(() => ({ update: mockUpdate })),
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
  return new EntityApiError(
    "PUT",
    "/api/coaching_session_series",
    axiosLikeError
  );
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

// A naive-UTC start of 13:30Z. In America/New_York (EDT, UTC-4 in July) this is
// a local wall-clock of 09:30, which is what the form pre-fills the time input
// with. Submitting unchanged should round-trip back to the same naive-UTC string.
const TIMEZONE = "America/New_York";
const START_AT_UTC = "2026-07-15T13:30:00";

function makeSeries(): CoachingSessionSeries {
  return {
    id: "series-1",
    coaching_relationship_id: "rel-1",
    created_by_user_id: "user-1",
    rule: {
      start_at: START_AT_UTC,
      duration_minutes: 60,
      recurrence: {
        // Monthly + count avoids the weekday constraints, so the form is
        // submittable on first render without touching RecurrenceFields.
        frequency: Frequency.Monthly,
        interval: 1,
        count: Some(4),
        until: None,
      },
    },
    created_at: DateTime.fromISO("2026-06-01T00:00:00", { zone: "utc" }),
    updated_at: DateTime.fromISO("2026-06-01T00:00:00", { zone: "utc" }),
  };
}

function renderDialog() {
  const onClose = vi.fn();
  const onRescheduled = vi.fn();
  render(
    <RescheduleSeriesDialog
      series={makeSeries()}
      onClose={onClose}
      onRescheduled={onRescheduled}
    />
  );
  return { onClose, onRescheduled };
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: /reschedule sessions/i }));
}

// ── Test setup ────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthStore.mockReturnValue({
    userSession: { id: "user-1", timezone: TIMEZONE },
  });
  mockUpdate.mockResolvedValue(undefined);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("RescheduleSeriesDialog - submit path", () => {
  it("assembles sessionDate + sessionTime into a UTC start_at using the user's timezone", async () => {
    const { onClose, onRescheduled } = renderDialog();

    submit();

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith(
        "series-1",
        expect.objectContaining({
          coaching_relationship_id: "rel-1",
          // 09:30 America/New_York (EDT) → 13:30 UTC, formatted naive-UTC.
          start_at: START_AT_UTC,
          duration_minutes: 60,
          recurrence: { frequency: "monthly", count: 4 },
        })
      );
    });

    expect(toast.success).toHaveBeenCalledWith(
      "Series rescheduled. Future sessions were updated."
    );
    expect(onRescheduled).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows a review-the-form toast on a 422 from the backend", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockUpdate.mockRejectedValue(makeEntityApiError(422));

    const { onClose, onRescheduled } = renderDialog();

    submit();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't reschedule the series. Please review the form and try again."
      );
    });
    expect(onRescheduled).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("shows a generic failure toast for non-422 errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockUpdate.mockRejectedValue(makeEntityApiError(500));

    renderDialog();

    submit();

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to reschedule the series. Please try again."
      );
    });

    consoleError.mockRestore();
  });
});
