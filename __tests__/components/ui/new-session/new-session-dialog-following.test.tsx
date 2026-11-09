import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Settings } from "ts-luxon";
import { useRouter } from "next/navigation";
import { NewSessionDialog } from "@/components/ui/new-session/new-session-dialog";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import {
  CoachingSessionApi,
  useEnrichedCoachingSessionsForUser,
  useNearestEachCoachingSessions,
} from "@/lib/api/coaching-sessions";
import { CoachingSessionSeriesApi, useCoachingSessionSeries } from "@/lib/api/coaching-session-series";
import { useOAuthConnections } from "@/lib/api/oauth-connection";
import { toast } from "@/lib/toast";
import { EntityApiError } from "@/types/entity-api-error";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import { createMockSession } from "../../../test-utils";
import { MoveScope } from "@/lib/scheduling";
import { None, Some } from "@/types/option";
import { ALL, E_04, E_11, E_18, NEAREST, NOW, RELATIONSHIPS, ZONE, session } from "../../../lib/scheduling/roster";
import { Frequency, Weekday } from "@/types/recurrence";



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
  return {
    ...actual,
    useCoachingSessionSeries: vi.fn(),
    CoachingSessionSeriesApi: { ...actual.CoachingSessionSeriesApi, create: vi.fn(), reschedule: vi.fn() },
  };
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

const EHAB = { id: "ehab", first: "Ehab", last: "Badawi" };
const E_25 = session({ id: "e-25", relationshipId: "rel-e", person: EHAB, start: "2026-08-25T14:30", series: "series-e" });
const E_01 = session({ id: "e-01", relationshipId: "rel-e", person: EHAB, start: "2026-09-01T14:30", series: "series-e" });

const SERIES = {
  id: "series-e",
  coaching_relationship_id: "rel-e",
  rule: {
    start_at: E_04.date,
    duration_minutes: 50,
    recurrence: { frequency: Frequency.Weekly, interval: 1, by_weekdays: [Weekday.Tue], count: Some(5), until: None },
  },
  created_by_user_id: "me",
  created_at: NOW,
  updated_at: NOW,
  coaching_sessions: [E_04, E_11, E_18, E_25, E_01],
};

const reschedule = vi.mocked(CoachingSessionSeriesApi.reschedule);

beforeEach(() => {
  vi.mocked(useCoachingSessionSeries).mockReturnValue({
    series: SERIES,
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useCoachingSessionSeries>);
  reschedule.mockResolvedValue(SERIES as unknown as Awaited<ReturnType<typeof CoachingSessionSeriesApi.reschedule>>);
});

function renderMove(scope = MoveScope.This) {
  const onClose = vi.fn();
  render(<NewSessionDialog request={{ kind: "move", session: E_18, scope, target: None }} onClose={onClose} />);
  return onClose;
}

const rail = () => within(screen.getByRole("list", { name: "Steps" }));
const railRow = (label: string) => rail().getAllByRole("listitem").find((row) => row.textContent?.startsWith(label));
const day = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}(,|$)`) });
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next step" }));
const prev = () => fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
const typeTime = (value: string) => fireEvent.change(screen.getByLabelText("Start time"), { target: { value } });

describe("NewSessionDialog: a series session", () => {
  it("adds Applies to, with this session only by default", () => {
    renderMove();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(railRow("Applies to")).toHaveTextContent("This session only");
    next();
    expect(screen.getByRole("heading", { name: "Applies to" })).toBeInTheDocument();
    expect(screen.getByText("Ehab's series repeats weekly on Tuesdays.")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /This session only/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /This and following sessions/ })).not.toBeChecked();
  });

  it("moves just this session with a single update", async () => {
    const onClose = renderMove();
    fireEvent.click(day("Thursday, August 20"));
    next();
    fireEvent.click(screen.getByRole("button", { name: "Reschedule session" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(move).toHaveBeenCalledWith("e-18", expect.objectContaining({ date: "2026-08-20T19:30:00" }));
    expect(reschedule).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Rescheduled · Ehab to Thursday, August 20, 2:30 PM");
  });

  it("moves this and following, with the rule prefilled and the weekday following the date", async () => {
    const onClose = renderMove();
    fireEvent.click(day("Thursday, August 20"));
    next();
    fireEvent.click(screen.getByRole("radio", { name: /This and following sessions/ }));
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(railRow("Applies to")).toHaveTextContent("This and following sessions");
    expect(railRow("Repeats")).toHaveTextContent("Weekly, for 3 sessions");
    next();
    expect(screen.getByRole("heading", { name: "Repeat" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Doesn't repeat" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weekly" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Thursday" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Tuesday" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("spinbutton", { name: "Number of sessions" })).toHaveValue(3);
    fireEvent.click(screen.getByRole("button", { name: "Reschedule this and following" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(reschedule).toHaveBeenCalledWith(
      "series-e",
      {
        coaching_session_id: "e-18",
        start_at: "2026-08-20T19:30:00",
        duration_minutes: 50,
        recurrence: { frequency: "weekly", by_weekdays: ["Thu"], count: 3 },
      },
      ZONE
    );
    expect(move).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Rescheduled · Ehab to Thursday, August 20, 2:30 PM · and following");
  });

  it("goes back to one session when this session only is picked again", () => {
    renderMove();
    next();
    fireEvent.click(screen.getByRole("radio", { name: /This and following sessions/ }));
    fireEvent.click(screen.getByRole("radio", { name: /This session only/ }));
    expect(screen.getByText("2 of 2")).toBeInTheDocument();
    expect(railRow("Repeats")).toBeUndefined();
    prev();
    expect(screen.getByRole("heading", { name: "When" })).toBeInTheDocument();
  });

  it("opens Edit series on this and following, and can change only the rule", async () => {
    const onClose = renderMove(MoveScope.Following);
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(railRow("Applies to")).toHaveTextContent("This and following sessions");
    next();
    next();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Number of sessions" }), { target: { value: "4" } });
    fireEvent.click(screen.getByRole("button", { name: "Reschedule this and following" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(reschedule).toHaveBeenCalledWith(
      "series-e",
      {
        coaching_session_id: "e-18",
        start_at: "2026-08-18T19:30:00",
        duration_minutes: 50,
        recurrence: { frequency: "weekly", by_weekdays: ["Tue"], count: 4 },
      },
      ZONE
    );
  });

  it("summarizes where this and following moves", () => {
    renderMove(MoveScope.Following);
    typeTime("13:30");
    expect(screen.getByText("Rescheduling will")).toBeInTheDocument();
    expect(screen.getByText("Move this and following sessions to Tuesdays, 1:30 PM")).toBeInTheDocument();
  });

  it("has no summary while the edit moves nothing", () => {
    renderMove(MoveScope.Following);
    expect(screen.queryByText("Rescheduling will")).not.toBeInTheDocument();
  });

  it("titles the dialog by what it changes", () => {
    renderMove(MoveScope.Following);
    expect(screen.getByRole("dialog", { name: "Reschedule series" })).toBeInTheDocument();
    next();
    fireEvent.click(screen.getByRole("radio", { name: /This session only/ }));
    expect(screen.getByRole("dialog", { name: "Reschedule session" })).toBeInTheDocument();
  });

  it("has no summary when moving this session only", () => {
    renderMove();
    expect(screen.queryByText("Rescheduling will")).not.toBeInTheDocument();
  });

  it("explains a refusal to drop later sessions that have content", async () => {
    reschedule.mockRejectedValue(
      apiError(409, {
        error: "conflict",
        details: { reason: "sessions_have_content", coaching_session_ids: ["e-01"] },
      })
    );
    const onClose = renderMove(MoveScope.Following);
    next();
    next();
    fireEvent.change(screen.getByRole("spinbutton", { name: "Number of sessions" }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Reschedule this and following" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Some later sessions have notes or actions · Keep enough sessions to cover them"
      )
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stays open when this and following fails", async () => {
    reschedule.mockRejectedValue(apiError());
    const onClose = renderMove(MoveScope.Following);
    next();
    next();
    fireEvent.click(screen.getByRole("button", { name: "Reschedule this and following" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't update the session · Check your connection and try again")
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
