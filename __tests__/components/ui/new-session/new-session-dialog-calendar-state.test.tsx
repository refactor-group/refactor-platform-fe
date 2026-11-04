import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

const next = () => fireEvent.click(screen.getByRole("button", { name: "Next step" }));
// Cards are named by their avatar initials, then the name and sub-line.
const person = (name: string) => screen.getByRole("button", { name: new RegExp(name) });
const day = (label: string) => screen.getByRole("button", { name: new RegExp(`^${label}(,|$)`) });
const typeTime = (value: string) => fireEvent.change(screen.getByLabelText("Start time"), { target: { value } });

function serveSessions(state: { isLoading?: boolean; isError?: unknown }) {
  vi.mocked(useEnrichedCoachingSessionsForUser).mockReturnValue({
    enrichedSessions: [],
    isLoading: state.isLoading ?? false,
    isError: state.isError,
    refresh: vi.fn(),
  } as unknown as ReturnType<typeof useEnrichedCoachingSessionsForUser>);
}

function toLastStep() {
  renderDialog();
  fireEvent.click(person("Priya Raman"));
  next();
  fireEvent.click(day("Thursday, August 20"));
  typeTime("10:00");
  next();
}

describe("NewSessionDialog: the calendar hasn't been read", () => {
  it("waits for your sessions to load before it can confirm", () => {
    serveSessions({ isLoading: true });
    toLastStep();
    expect(screen.getByText("Checking your calendar…")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Schedule/ })).not.toBeInTheDocument();
  });

  it("says so when your sessions couldn't load, and doesn't confirm", () => {
    serveSessions({ isError: new Error("boom") });
    toLastStep();
    expect(screen.getByText("Couldn't check your calendar. Close and try again.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Schedule/ })).not.toBeInTheDocument();
  });
});
