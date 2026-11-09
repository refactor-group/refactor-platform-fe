import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Settings } from "ts-luxon";
import { useRouter } from "next/navigation";
import { NewSessionDialog } from "@/components/ui/new-session/new-session-dialog";
import { NewSessionDialogHost } from "@/components/ui/new-session/new-session-dialog-host";
import {
  NewSessionDialogStoreProvider,
  useNewSessionDialogStore,
} from "@/lib/providers/new-session-dialog-store-provider";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import {
  CoachingSessionApi,
  useEnrichedCoachingSessionsForUser,
  useNearestEachCoachingSessions,
} from "@/lib/api/coaching-sessions";
import { CoachingSessionSeriesApi } from "@/lib/api/coaching-session-series";
import { useOAuthConnections } from "@/lib/api/oauth-connection";
import { toast } from "@/lib/toast";
import { EntityApiError } from "@/types/entity-api-error";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import { createMockSession } from "../../../test-utils";
import { MoveScope } from "@/lib/scheduling";
import { None } from "@/types/option";
import { ALL, E_18, NEAREST, NOW, RELATIONSHIPS } from "../../../lib/scheduling/roster";

/** Ehab's Tuesday session as a one-off, so move mode has no Applies to step. */
const ONE_OFF = { ...E_18, coaching_session_series_id: None };

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ userId: "me", isACoach: true, userSession: { id: "me", timezone: "America/Chicago" } }),
}));
vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));
vi.mock("@/lib/api/coaching-relationships", () => ({ useCoachingRelationshipList: vi.fn() }));
vi.mock("@/lib/api/oauth-connection", () => ({ useOAuthConnections: vi.fn() }));
vi.mock("@/lib/api/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/users")>()),
  useUser: () => ({
    user: { id: "me", default_coaching_session_duration_minutes: 50 },
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  }),
}));
vi.mock("@/lib/api/coaching-sessions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/coaching-sessions")>();
  return {
    ...actual,
    useNearestEachCoachingSessions: vi.fn(),
    useEnrichedCoachingSessionsForUser: vi.fn(),
    CoachingSessionApi: { ...actual.CoachingSessionApi, create: vi.fn(), update: vi.fn(), move: vi.fn() },
  };
});
vi.mock("@/lib/api/coaching-session-series", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/coaching-session-series")>();
  return { ...actual, CoachingSessionSeriesApi: { ...actual.CoachingSessionSeriesApi, create: vi.fn() } };
});
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const create = vi.mocked(CoachingSessionApi.create);
const move = vi.mocked(CoachingSessionApi.move);
const createSeries = vi.mocked(CoachingSessionSeriesApi.create);
const push = vi.fn();

function viewport(desktop: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: desktop, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
}

function serveRelationships(relationships: CoachingRelationshipWithUserNames[]) {
  vi.mocked(useCoachingRelationshipList).mockReturnValue({
    relationships,
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useCoachingRelationshipList>);
}

function apiError(status?: number, data?: unknown): EntityApiError {
  const axiosLike = Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: status !== undefined ? { status, statusText: "Error", data } : undefined,
  });
  return new EntityApiError("POST", "/coaching_sessions", axiosLike);
}

const originalNow = Settings.now;

beforeEach(() => {
  vi.clearAllMocks();
  Settings.now = () => NOW.toMillis();
  viewport(true);
  vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  serveRelationships(RELATIONSHIPS);
  vi.mocked(useNearestEachCoachingSessions).mockReturnValue({ sessions: NEAREST, isLoading: false, isError: undefined });
  vi.mocked(useEnrichedCoachingSessionsForUser).mockReturnValue({
    enrichedSessions: ALL,
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useEnrichedCoachingSessionsForUser>);
  vi.mocked(useOAuthConnections).mockReturnValue({
    connections: [{ provider: "google" }],
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useOAuthConnections>);
  create.mockResolvedValue(createMockSession({ id: "new" }));
  move.mockResolvedValue(createMockSession({ id: "e-18" }));
  createSeries.mockResolvedValue({ coaching_sessions: Array(8).fill(createMockSession()) } as unknown as Awaited<
    ReturnType<typeof CoachingSessionSeriesApi.create>
  >);
});

afterEach(() => {
  Settings.now = originalNow;
  vi.unstubAllGlobals();
});

function renderMove() {
  const onClose = vi.fn();
  render(<NewSessionDialog request={{ kind: "move", session: ONE_OFF, scope: MoveScope.This }} onClose={onClose} />);
  return onClose;
}

const rail = () => within(screen.getByRole("list", { name: "Steps" }));
const railRow = (label: string) => rail().getAllByRole("listitem").find((row) => row.textContent?.startsWith(label));
const day = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}(,|$)`) });
const typeTime = (value: string) => fireEvent.change(screen.getByLabelText("Start time"), { target: { value } });

describe("NewSessionDialog: move", () => {
  it("opens on When with the session's person, current time and duration", () => {
    renderMove();
    expect(screen.getByRole("dialog", { name: "Reschedule session" })).toBeInTheDocument();
    expect(screen.getByText("Currently Tue, Aug 18, 2:30 PM")).toBeInTheDocument();
    expect(screen.getAllByText("Ehab Badawi").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "When" })).toBeInTheDocument();
    expect(screen.getByText("1 of 1")).toBeInTheDocument();
    expect(railRow("Who")).toBeUndefined();
    expect(railRow("When")).toHaveTextContent("Tuesday, August 18, 2:30 PM");
    expect(day("Tuesday, August 18")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Start time")).toHaveValue("14:30");
    expect(screen.getByRole("button", { name: "50 min" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Previous step" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
  });

  it("leaves the moved session out of busy days and overlaps", () => {
    renderMove();
    expect(day("Tuesday, August 18")).toHaveAccessibleName("Tuesday, August 18, 1 session");
    expect(screen.queryByText(/Overlaps with/)).not.toBeInTheDocument();
  });

  it("asks for a change before it can confirm", () => {
    renderMove();
    expect(screen.getByText("Pick a new date or time.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reschedule session" })).not.toBeInTheDocument();
  });

  it("moves the session to a new day and confirms it", async () => {
    const onClose = renderMove();
    fireEvent.click(day("Thursday, August 20"));
    expect(screen.getByLabelText("Start time")).toHaveValue("14:30");
    fireEvent.click(screen.getByRole("button", { name: "Reschedule session" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(create).not.toHaveBeenCalled();
    expect(move).toHaveBeenCalledTimes(1);
    expect(move).toHaveBeenCalledWith(
      "e-18",
      { date: "2026-08-20T19:30:00", duration_minutes: 50 }
    );
    expect(toast.success).toHaveBeenCalledWith("Rescheduled · Ehab to Thursday, August 20, 2:30 PM");
  });

  it("saves a new duration on its own", async () => {
    const onClose = renderMove();
    fireEvent.click(screen.getByRole("button", { name: "Increase duration" }));
    fireEvent.click(screen.getByRole("button", { name: "Reschedule session" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(move).toHaveBeenCalledWith(
      "e-18",
      expect.objectContaining({ date: "2026-08-18T19:30:00", duration_minutes: 55 })
    );
  });

  it("resolves an overlap by moving the other session after this one", async () => {
    const onClose = renderMove();
    typeTime("16:30");
    expect(screen.getByText(/Overlaps with Priya, 4:30–5:20 PM/)).toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("heading", { name: "Resolve overlap" })).toBeInTheDocument();
    expect(
      screen.getByText("Priya's session on Tue 18 at 4:30 PM overlaps the new one. Move it to:")
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "9:00 AM" }));
    expect(railRow("Resolve overlap")).toHaveTextContent("Move Priya to Tue 18, 9:00 AM");
    fireEvent.click(screen.getByRole("button", { name: "Reschedule session" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(move).toHaveBeenNthCalledWith(1, "e-18", expect.objectContaining({ date: "2026-08-18T21:30:00" }));
    expect(move).toHaveBeenNthCalledWith(2, "p-18", expect.objectContaining({ date: "2026-08-18T14:00:00" }));
    expect(Object.keys(move.mock.calls[1][1]).sort()).toEqual(["date", "duration_minutes"]);
    expect(toast.success).toHaveBeenCalledWith(
      "Rescheduled · Ehab to Tuesday, August 18, 4:30 PM · Priya moves to Tue 18, 9:00 AM"
    );
  });

  it("stays open on a retryable error", async () => {
    move.mockRejectedValue(apiError());
    const onClose = renderMove();
    fireEvent.click(day("Thursday, August 20"));
    fireEvent.click(screen.getByRole("button", { name: "Reschedule session" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't update the session · Check your connection and try again")
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "When" })).toBeInTheDocument();
  });
});

describe("NewSessionDialogHost: move", () => {
  function Mover() {
    const openMoveSession = useNewSessionDialogStore((state) => state.openMoveSession);
    return (
      <button type="button" onClick={() => openMoveSession(ONE_OFF)}>
        Move
      </button>
    );
  }

  it("opens move mode from the store", () => {
    render(
      <NewSessionDialogStoreProvider>
        <Mover />
        <NewSessionDialogHost />
      </NewSessionDialogStoreProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(screen.getByRole("dialog", { name: "Reschedule session" })).toBeInTheDocument();
  });
});
