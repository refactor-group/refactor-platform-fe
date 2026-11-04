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
import { CoachingSessionSeriesApi } from "@/lib/api/coaching-session-series";
import { useOAuthConnections } from "@/lib/api/oauth-connection";
import type { CoachingRelationshipWithUserNames } from "@/types/coaching-relationship";
import { None } from "@/types/option";
import { createMockSession } from "../../../test-utils";
import { ALL, NEAREST, NOW, RELATIONSHIPS } from "../../../lib/scheduling/roster";

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

const minutesBox = () => screen.getByRole("spinbutton", { name: "Duration in minutes" });

/** Sara from 3:00 to 5:00 PM on Tuesday, over both Ehab's 2:30 and Priya's 4:30. */
function toTwoOverlaps() {
  const onClose = renderDialog();
  fireEvent.click(person("Sara"));
  next();
  fireEvent.click(day("Tuesday, August 18"));
  typeTime("15:00");
  fireEvent.change(minutesBox(), { target: { value: "120" } });
  fireEvent.blur(minutesBox());
  next();
  next();
  return onClose;
}

describe("NewSessionDialog: a time over several sessions", () => {
  it("only offers keeping them all, since moving one wouldn't clear the time", () => {
    toTwoOverlaps();
    expect(screen.getByText("Ehab's and Priya's sessions overlap the new one.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^\d{1,2}:\d{2} [AP]M$/ })).not.toBeInTheDocument();
    expect(railRow("Resolve overlap")).toHaveTextContent("Keep all or pick another time");
    expect(screen.getByText("Keep all, or go back and pick another time.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Schedule/ })).not.toBeInTheDocument();
  });

  it("schedules after keeping them all, moving nothing", async () => {
    const onClose = toTwoOverlaps();
    fireEvent.click(screen.getByRole("button", { name: /keep all at 3:00 PM/i }));
    expect(railRow("Resolve overlap")).toHaveTextContent("Keep all at 3:00 PM");
    fireEvent.click(screen.getByRole("button", { name: "Schedule session" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(update).not.toHaveBeenCalled();
  });
});
