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
import { None, Some } from "@/types/option";
import { createMockSession } from "../../../test-utils";
import { ALL, NEAREST, NOW, RELATIONSHIPS, ZONE, at } from "../../../lib/scheduling/roster";

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
    CoachingSessionApi: { ...actual.CoachingSessionApi, create: vi.fn(), update: vi.fn() },
  };
});
vi.mock("@/lib/api/coaching-session-series", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/coaching-session-series")>();
  return { ...actual, CoachingSessionSeriesApi: { ...actual.CoachingSessionSeriesApi, create: vi.fn() } };
});
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const create = vi.mocked(CoachingSessionApi.create);
const update = vi.mocked(CoachingSessionApi.update);
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
  update.mockResolvedValue(createMockSession({ id: "e-18" }));
  createSeries.mockResolvedValue({ coaching_sessions: Array(8).fill(createMockSession()) } as unknown as Awaited<
    ReturnType<typeof CoachingSessionSeriesApi.create>
  >);
});

afterEach(() => {
  Settings.now = originalNow;
  vi.unstubAllGlobals();
});

function renderDialog(date = None as Parameters<typeof NewSessionDialog>[0]["request"]["date"]) {
  const onClose = vi.fn();
  render(<NewSessionDialog request={{ kind: "schedule", date }} onClose={onClose} />);
  return onClose;
}

const rail = () => within(screen.getByRole("list", { name: "Steps" }));
const railRow = (label: string) => rail().getAllByRole("listitem").find((row) => row.textContent?.startsWith(label));
const next = () => fireEvent.click(screen.getByRole("button", { name: "Next step" }));
// Cards are named by their avatar initials, then the name and sub-line.
const person = (name: string) => screen.getByRole("button", { name: new RegExp(name) });
const day = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}(,|$)`) });
const typeTime = (value: string) => fireEvent.change(screen.getByLabelText("Start time"), { target: { value } });

/** Priya at Tuesday 2:30 PM, which overlaps Ehab's series session. */
function toOverlap() {
  fireEvent.click(person("Priya Raman"));
  next();
  fireEvent.click(day("Tuesday, August 18"));
  typeTime("14:30");
}

describe("NewSessionDialog: Who", () => {
  it("opens on Who with the active people I coach, by activity", () => {
    renderDialog();
    expect(screen.getByRole("dialog", { name: "New session" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Who this session is with" })).toBeInTheDocument();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    const cards = screen.getAllByRole("button", { name: /(Ehab Badawi|Priya Raman|Sara Lin|Dana Fox|Boss Person)/ });
    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Ehab BadawiUsually Tuesdays, 2:30 PM");
    expect(cards[1]).toHaveTextContent("Priya RamanLast session Aug 10");
    expect(cards[2]).toHaveTextContent("Sara LinUsually Thursdays, 9:00 AM");
    expect(screen.getByRole("button", { name: "Show everyone (+1 inactive)" })).toBeInTheDocument();
    expect(railRow("Who")).toHaveTextContent("Choose a person");
  });

  it("shows inactive people on request", () => {
    renderDialog();
    fireEvent.click(screen.getByRole("button", { name: "Show everyone (+1 inactive)" }));
    expect(person("Dana Fox")).toHaveTextContent("Last session Jun 1");
  });

  it("marks the pick in the rail and summarizes what will be created", () => {
    renderDialog();
    fireEvent.click(person("Sara Lin"));
    expect(person("Sara Lin")).toHaveAttribute("aria-pressed", "true");
    expect(railRow("Who")).toHaveTextContent("Sara Lin");
    expect(screen.getByText("Scheduling will create")).toBeInTheDocument();
    expect(screen.getByText("1 session with Sara")).toBeInTheDocument();
    expect(screen.getByText("Google Meet link included")).toBeInTheDocument();
  });

  it("leaves out the meeting line without a connected provider", () => {
    vi.mocked(useOAuthConnections).mockReturnValue({
      connections: [],
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useOAuthConnections>);
    renderDialog();
    fireEvent.click(person("Sara Lin"));
    expect(screen.getByText("1 session with Sara")).toBeInTheDocument();
    expect(screen.queryByText(/link included/)).not.toBeInTheDocument();
  });

  it("says so when there's no one to schedule with", () => {
    serveRelationships(RELATIONSHIPS.filter((r) => r.coach_id !== "me"));
    renderDialog();
    expect(screen.getByText("You don't coach anyone in this organization yet.")).toBeInTheDocument();
  });
});

describe("NewSessionDialog: When", () => {
  it("prefills the person's usual day and time, the default duration and free suggestions", () => {
    renderDialog();
    fireEvent.click(person("Sara Lin"));
    next();
    expect(screen.getByRole("heading", { name: "When" })).toBeInTheDocument();
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(day("Thursday, August 20")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Start time")).toHaveValue("09:00");
    expect(screen.getByRole("button", { name: "9:00 AM" })).toHaveAttribute("aria-pressed", "true");
    for (const time of ["10:00 AM", "11:00 AM", "12:00 PM", "2:30 PM"]) {
      expect(screen.getByRole("button", { name: time })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "50 min" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Nothing else on Thursday, August 20.")).toBeInTheDocument();
    expect(railRow("When")).toHaveTextContent("Thursday, August 20, 9:00 AM");
  });

  it("starts on a requested date", () => {
    renderDialog(Some(at("2026-08-19T00:00")));
    fireEvent.click(person("Ehab Badawi"));
    next();
    expect(day("Wednesday, August 19")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Start time")).toHaveValue("14:30");
  });

  it("marks busy days and lists a picked day's sessions", () => {
    renderDialog();
    fireEvent.click(person("Priya Raman"));
    next();
    expect(screen.getByLabelText("Start time")).toHaveValue("");
    expect(railRow("When")).toHaveTextContent("Set a date and time");
    expect(day("Tuesday, August 18")).toHaveAccessibleName("Tuesday, August 18, 2 sessions");
    fireEvent.click(day("Tuesday, August 18"));
    expect(screen.getByText("Already on Tuesday, August 18")).toBeInTheDocument();
  });

  it("flags an overlap, adds Resolve overlap, and offers the next free time", () => {
    renderDialog();
    toOverlap();
    expect(screen.getByText(/Overlaps with Ehab, 2:30–3:20 PM/)).toBeInTheDocument();
    expect(screen.getByText("2 of 4")).toBeInTheDocument();
    expect(railRow("Resolve overlap")).toHaveTextContent("Choose a new time for Ehab");
    fireEvent.click(screen.getByRole("button", { name: "Use 3:30 PM instead" }));
    expect(screen.getByLabelText("Start time")).toHaveValue("15:30");
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
    expect(railRow("Resolve overlap")).toBeUndefined();
  });
});

describe("NewSessionDialog: Repeat", () => {
  function toRepeat() {
    renderDialog();
    fireEvent.click(person("Sara Lin"));
    next();
    next();
  }

  it("doesn't repeat by default, and confirms one session on the last step", () => {
    toRepeat();
    expect(screen.getByRole("heading", { name: "Repeat" })).toBeInTheDocument();
    expect(screen.getByText("3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Doesn't repeat" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Next step" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Schedule session" })).toBeEnabled();
  });

  it("repeats weekly on the start weekday, for 8 sessions", () => {
    toRepeat();
    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
    expect(screen.getByRole("button", { name: "Thursday" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("spinbutton", { name: "Number of sessions" })).toHaveValue(8);
    expect(railRow("Repeats")).toHaveTextContent("Weekly, for 8 sessions");
    expect(screen.getByText("8 sessions with Sara")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Schedule 8 sessions" })).toBeEnabled();
  });

  it("blocks an invalid end with one inline message", () => {
    toRepeat();
    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: "Number of sessions" }), { target: { value: "0" } });
    expect(screen.getByText("Number of occurrences must be at least 1.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Schedule/ })).toBeDisabled();
  });
});

describe("NewSessionDialog: Resolve overlap", () => {
  function toResolve() {
    const onClose = renderDialog();
    toOverlap();
    next();
    next();
    return onClose;
  }

  it("asks how to resolve before it can confirm", () => {
    toResolve();
    expect(screen.getByRole("heading", { name: "Resolve overlap" })).toBeInTheDocument();
    expect(
      screen.getByText("Ehab's session on Tue 18 at 2:30 PM overlaps the new one. Move it to:")
    ).toBeInTheDocument();
    expect(screen.getByText("4 of 4")).toBeInTheDocument();
    expect(screen.getByText("Pick a new time for Ehab, or keep both.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Schedule session" })).not.toBeInTheDocument();
    expect(day("Tuesday, August 18")).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "2:30 PM" })).not.toBeInTheDocument();
  });

  it("creates the session, then moves the other one", async () => {
    const onClose = toResolve();
    fireEvent.click(screen.getByRole("button", { name: "3:30 PM" }));
    expect(railRow("Resolve overlap")).toHaveTextContent("Move Ehab to Tue 18, 3:30 PM");
    fireEvent.click(screen.getByRole("button", { name: "Schedule session" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        coaching_relationship_id: "rel-p",
        date: "2026-08-18T19:30:00",
        duration_minutes: 50,
        provider: "google",
      })
    );
    expect(update).toHaveBeenCalledWith("e-18", expect.objectContaining({ id: "e-18", date: "2026-08-18T20:30:00" }));
    expect(create.mock.invocationCallOrder[0]).toBeLessThan(update.mock.invocationCallOrder[0]);
    expect(toast.success).toHaveBeenCalledWith(
      "Scheduled · Priya Raman · Tuesday, August 18 · 2:30 PM · 50 min · Ehab moves to Tue 18, 3:30 PM"
    );
  });

  it("asks again when the new time changes but still overlaps the same session", () => {
    toResolve();
    fireEvent.click(screen.getByRole("button", { name: "3:30 PM" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    typeTime("14:45");
    expect(railRow("Resolve overlap")).toHaveTextContent("Choose a new time for Ehab");
    next();
    next();
    expect(screen.getByText("Pick a new time for Ehab, or keep both.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Schedule session" })).not.toBeInTheDocument();
  });

  it("asks again when the duration changes", () => {
    toResolve();
    fireEvent.click(screen.getByRole("button", { name: "3:30 PM" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.click(screen.getByRole("button", { name: "60 min" }));
    expect(railRow("Resolve overlap")).toHaveTextContent("Choose a new time for Ehab");
  });

  it("keeps both without moving anything", async () => {
    const onClose = toResolve();
    fireEvent.click(screen.getByRole("button", { name: /keep both at 2:30 PM/i }));
    expect(railRow("Resolve overlap")).toHaveTextContent("Keep both at 2:30 PM");
    fireEvent.click(screen.getByRole("button", { name: "Schedule session" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(update).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Scheduled · Priya Raman · Tuesday, August 18 · 2:30 PM · 50 min");
  });

  it("keeps the new session when the move fails", async () => {
    update.mockRejectedValue(apiError(500));
    const onClose = toResolve();
    fireEvent.click(screen.getByRole("button", { name: "3:30 PM" }));
    fireEvent.click(screen.getByRole("button", { name: "Schedule session" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith("Scheduled · Priya Raman · Tuesday, August 18 · 2:30 PM · 50 min");
    expect(toast.error).toHaveBeenCalledWith("Couldn't move Ehab's session · Reschedule it from the dashboard");
  });

  it("only keeps both when the other session isn't mine to move", () => {
    vi.mocked(useEnrichedCoachingSessionsForUser).mockReturnValue({
      enrichedSessions: ALL.map((s) =>
        s.id === "e-18" ? { ...s, relationship: { ...s.relationship!, coach_id: "someone-else" } } : s
      ),
      isLoading: false,
      isError: undefined,
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof useEnrichedCoachingSessionsForUser>);
    toResolve();
    expect(screen.queryByRole("button", { name: "3:30 PM" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /keep both at 2:30 PM/i })).toBeInTheDocument();
  });
});

describe("NewSessionDialog: submit", () => {
  function readyToSchedule() {
    const onClose = renderDialog();
    fireEvent.click(person("Sara Lin"));
    next();
    next();
    return onClose;
  }

  it("schedules one session and confirms it", async () => {
    const onClose = readyToSchedule();
    fireEvent.click(screen.getByRole("button", { name: "Schedule session" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        coaching_relationship_id: "rel-s",
        date: "2026-08-20T14:00:00",
        duration_minutes: 50,
        provider: "google",
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Scheduled · Sara Lin · Thursday, August 20 · 9:00 AM · 50 min");
  });

  it("schedules a weekly series", async () => {
    const onClose = readyToSchedule();
    fireEvent.click(screen.getByRole("button", { name: "Weekly" }));
    fireEvent.click(screen.getByRole("button", { name: "Schedule 8 sessions" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(create).not.toHaveBeenCalled();
    expect(createSeries).toHaveBeenCalledWith(
      {
        coaching_relationship_id: "rel-s",
        start_at: "2026-08-20T14:00:00",
        duration_minutes: 50,
        recurrence: { frequency: "weekly", by_weekdays: ["Thu"], count: 8 },
      },
      ZONE
    );
    expect(toast.success).toHaveBeenCalledWith(
      "Scheduled · Sara Lin · Thursday, August 20 · 9:00 AM · 50 min · Weekly, for 8 sessions"
    );
  });

  it("creates once on a double click", async () => {
    const onClose = readyToSchedule();
    const confirm = screen.getByRole("button", { name: "Schedule session" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("stays open with its choices on a retryable error", async () => {
    create.mockRejectedValue(apiError());
    const onClose = readyToSchedule();
    fireEvent.click(screen.getByRole("button", { name: "Schedule session" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't create the session · Check your connection and try again")
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Repeat" })).toBeInTheDocument();
    expect(railRow("Who")).toHaveTextContent("Sara Lin");
    await waitFor(() => expect(screen.getByRole("button", { name: "Schedule session" })).toBeEnabled());
  });

  it("sends a revoked Google connection to Settings", async () => {
    create.mockRejectedValue(apiError(409, { error: "oauth_token_revoked" }));
    const onClose = readyToSchedule();
    fireEvent.click(screen.getByRole("button", { name: "Schedule session" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings/integrations"));
    expect(toast.error).toHaveBeenCalledWith("Google Meet is disconnected · Reconnect it in Settings");
    expect(onClose).toHaveBeenCalled();
  });
});

describe("NewSessionDialog below 900px", () => {
  it("steps with the Next pill and keeps the summary in the body", () => {
    viewport(false);
    renderDialog();
    fireEvent.click(person("Sara Lin"));
    expect(screen.getByText("1 session with Sara")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "When" })).toBeInTheDocument();
    expect(day("Thursday, August 20")).toHaveAttribute("aria-pressed", "true");
  });
});

describe("NewSessionDialogHost", () => {
  function Opener() {
    const openSchedule = useNewSessionDialogStore((state) => state.openSchedule);
    return (
      <button type="button" onClick={() => openSchedule(None)}>
        Open
      </button>
    );
  }

  it("opens from the store and starts fresh every time", () => {
    render(
      <NewSessionDialogStoreProvider>
        <Opener />
        <NewSessionDialogHost />
      </NewSessionDialogStoreProvider>
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    fireEvent.click(person("Sara Lin"));
    next();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("heading", { name: "Who this session is with" })).toBeInTheDocument();
    expect(person("Sara Lin")).toHaveAttribute("aria-pressed", "false");
  });
});
