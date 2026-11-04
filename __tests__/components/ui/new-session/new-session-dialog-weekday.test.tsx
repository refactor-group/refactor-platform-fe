import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Settings } from "ts-luxon";
import { NewSessionDialog } from "@/components/ui/new-session/new-session-dialog";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { useEnrichedCoachingSessionsForUser, useNearestEachCoachingSessions } from "@/lib/api/coaching-sessions";
import { useOAuthConnections } from "@/lib/api/oauth-connection";
import { None } from "@/types/option";
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
  useUser: () => ({ user: { id: "me", default_coaching_session_duration_minutes: 50 }, isLoading: false }),
}));
vi.mock("@/lib/api/coaching-sessions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/coaching-sessions")>()),
  useNearestEachCoachingSessions: vi.fn(),
  useEnrichedCoachingSessionsForUser: vi.fn(),
}));

const originalNow = Settings.now;

beforeEach(() => {
  Settings.now = () => NOW.toMillis();
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
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

const button = (name: string) => screen.getByRole("button", { name });

describe("NewSessionDialog: weekly days follow the start date", () => {
  it("swaps the old start weekday for the new one and keeps the other days", () => {
    render(<NewSessionDialog request={{ kind: "schedule", date: None }} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Sara Lin/ }));
    fireEvent.click(button("Next step"));
    fireEvent.click(button("Next step"));
    fireEvent.click(button("Weekly"));
    fireEvent.click(button("Monday"));
    expect(button("Thursday")).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(button("Previous step"));
    fireEvent.click(screen.getByRole("button", { name: /^Friday, August 21(,|$)/ }));
    fireEvent.click(button("Next step"));

    expect(button("Monday")).toHaveAttribute("aria-pressed", "true");
    expect(button("Thursday")).toHaveAttribute("aria-pressed", "false");
    expect(button("Friday")).toHaveAttribute("aria-pressed", "true");
    expect(button("Schedule 8 sessions")).toBeEnabled();
  });
});
