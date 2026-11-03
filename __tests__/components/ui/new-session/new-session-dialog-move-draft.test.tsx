import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Settings } from "ts-luxon";
import { useRouter } from "next/navigation";
import { NewSessionDialog } from "@/components/ui/new-session/new-session-dialog";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import {
  CoachingSessionApi,
  useEnrichedCoachingSessionsForUser,
  useNearestEachCoachingSessions,
} from "@/lib/api/coaching-sessions";
import { useOAuthConnections } from "@/lib/api/oauth-connection";
import { toast } from "@/lib/toast";
import { EntityApiError } from "@/types/entity-api-error";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import { MoveScope } from "@/lib/scheduling";
import { None } from "@/types/option";
import { ALL, E_18, NEAREST, NOW, RELATIONSHIPS, session } from "../../../lib/scheduling/roster";

/** A one-off, so confirm sits on the When step. */
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
  useUser: () => ({ user: { id: "me", default_coaching_session_duration_minutes: 50 }, isLoading: false }),
}));
vi.mock("@/lib/api/coaching-sessions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/coaching-sessions")>();
  return {
    ...actual,
    useNearestEachCoachingSessions: vi.fn(),
    useEnrichedCoachingSessionsForUser: vi.fn(),
    CoachingSessionApi: { ...actual.CoachingSessionApi, update: vi.fn() },
  };
});
vi.mock("@/lib/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const update = vi.mocked(CoachingSessionApi.update);
const push = vi.fn();
const originalNow = Settings.now;

function apiError(status: number, data: unknown): EntityApiError {
  const axiosLike = Object.assign(new Error("Request failed"), {
    isAxiosError: true,
    response: { status, statusText: "Error", data },
  });
  return new EntityApiError("PUT", "/coaching_sessions/e-18", axiosLike);
}

beforeEach(() => {
  vi.clearAllMocks();
  Settings.now = () => NOW.toMillis();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  vi.mocked(useRouter).mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>);
  vi.mocked(useCoachingRelationshipList).mockReturnValue({
    relationships: RELATIONSHIPS,
    isLoading: false,
    isError: undefined,
  } as unknown as ReturnType<typeof useCoachingRelationshipList>);
  vi.mocked(useNearestEachCoachingSessions).mockReturnValue({ sessions: NEAREST, isLoading: false, isError: undefined });
  vi.mocked(useEnrichedCoachingSessionsForUser).mockReturnValue({
    enrichedSessions: ALL,
    isLoading: false,
    isError: undefined,
  } as unknown as ReturnType<typeof useEnrichedCoachingSessionsForUser>);
  vi.mocked(useOAuthConnections).mockReturnValue({
    connections: [],
    isLoading: false,
  } as unknown as ReturnType<typeof useOAuthConnections>);
});

afterEach(() => {
  Settings.now = originalNow;
  vi.unstubAllGlobals();
});

function renderMove(moved: EnrichedCoachingSession) {
  const onClose = vi.fn();
  render(<NewSessionDialog request={{ kind: "move", session: moved, scope: MoveScope.This }} onClose={onClose} />);
  return onClose;
}

function rescheduleToThursday() {
  fireEvent.click(screen.getByRole("button", { name: /^Thursday, August 20(,|$)/ }));
  fireEvent.click(screen.getByRole("button", { name: "Reschedule session" }));
}

describe("NewSessionDialog: move draft", () => {
  it("opens on the session's own month and duration, not today's or the default", () => {
    renderMove(
      session({
        id: "e-oct",
        relationshipId: "rel-e",
        person: { id: "ehab", first: "Ehab", last: "Badawi" },
        start: "2026-10-06T09:15",
        minutes: 90,
      })
    );
    expect(screen.getByText("Oct 2026")).toBeInTheDocument();
    expect(screen.getByLabelText("Duration in minutes")).toHaveValue(90);
    expect(screen.getByLabelText("Start time")).toHaveValue("09:15");
  });
});

describe("NewSessionDialog: move errors", () => {
  it("sends a revoked Google connection to Settings", async () => {
    update.mockRejectedValue(apiError(409, { error: "oauth_token_revoked" }));
    const onClose = renderMove(ONE_OFF);
    rescheduleToThursday();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/settings/integrations"));
    expect(toast.error).toHaveBeenCalledWith("Google Meet is disconnected · Reconnect it in Settings");
    expect(onClose).toHaveBeenCalled();
  });

  it("doesn't send another conflict to Settings", async () => {
    update.mockRejectedValue(apiError(409, { error: "other_conflict" }));
    const onClose = renderMove(ONE_OFF);
    rescheduleToThursday();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't update the coaching session · Try again")
    );
    expect(push).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the update copy on a validation error, not the backend's message", async () => {
    update.mockRejectedValue(
      apiError(422, { error: "validation_error", message: "duration_minutes must be between 1 and 480" })
    );
    const onClose = renderMove(ONE_OFF);
    rescheduleToThursday();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Couldn't update the session · Check the details and try again")
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("only logs an error that isn't from the API", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    update.mockRejectedValue(new Error("Unexpected"));
    const onClose = renderMove(ONE_OFF);
    rescheduleToThursday();
    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(toast.error).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
