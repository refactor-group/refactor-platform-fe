import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { http, HttpResponse } from "msw";
import { Toaster } from "@/components/ui/sonner";
import { server } from "@/test-utils/msw-server";
import { CoachingSessionsCard } from "@/components/ui/dashboard/coaching-sessions-card";
import { Some } from "@/types/option";
import { createMockEnrichedSession } from "../../../test-utils";

vi.mock("@/site.config", () => ({
  siteConfig: {
    env: {
      backendServiceURL: "http://localhost:4000",
      backendApiVersion: "1.0.0-test",
    },
  },
}));

vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (state: unknown) => unknown) =>
    selector({ userSession: { id: "coach-1", timezone: "UTC" }, isACoach: true }),
}));

vi.mock("@/lib/providers/coaching-sessions-card-filter-store-provider", () => ({
  useCoachingSessionsCardFilterStore: (selector: (state: unknown) => unknown) =>
    selector({ relationshipFilter: undefined, setRelationshipFilter: vi.fn() }),
}));

vi.mock("@/lib/hooks/use-current-organization", () => ({
  useCurrentOrganization: () => ({ currentOrganizationId: "org-1" }),
}));

vi.mock("@/lib/api/coaching-relationships", () => ({
  useCoachingRelationshipList: () => ({
    relationships: [],
    isLoading: false,
    isError: undefined,
    refresh: vi.fn(),
  }),
}));

// One button that hands a fixed series session to the card's resend callback.
vi.mock("@/components/ui/dashboard/session-buckets/buckets-container", () => ({
  BucketsContainer: ({
    onRequestResendInvite,
  }: {
    onRequestResendInvite: (s: unknown) => void;
  }) => (
    <button type="button" onClick={() => onRequestResendInvite(SESSION)}>
      trigger resend
    </button>
  ),
}));

const BASE = "http://localhost:4000";
const SESSION = createMockEnrichedSession({
  id: "session-7",
  coaching_session_series_id: Some("series-9"),
});

// Confirms the resend dialog with the series route answering `seriesResponse`;
// returns every resend path POSTed.
async function confirmResend(seriesResponse: Response) {
  const posts: string[] = [];
  const record = (response: Response) => ({ request }: { request: Request }) => {
    posts.push(new URL(request.url).pathname);
    return response;
  };
  server.use(
    http.post(`${BASE}/coaching_session_series/:id/resend_invite`, record(seriesResponse)),
    http.post(`${BASE}/coaching_sessions/:id/resend_invite`, record(new HttpResponse(null, { status: 204 })))
  );
  const user = userEvent.setup();
  render(
    <>
      <CoachingSessionsCard onReschedule={vi.fn()} />
      <Toaster theme="light" />
    </>
  );
  await user.click(screen.getByRole("button", { name: "trigger resend" }));
  await screen.findByRole("alertdialog", { name: "Resend series invite?" });
  await user.click(screen.getByRole("button", { name: "Resend invite" }));
  return { user, posts };
}

describe("CoachingSessionsCard — resend invite", () => {
  it("POSTs once to the series route and announces success", async () => {
    const { posts } = await confirmResend(new HttpResponse(null, { status: 204 }));
    expect(await screen.findByText("Invite sent to you and Alex Chen")).toBeInTheDocument();
    expect(posts).toEqual(["/coaching_session_series/series-9/resend_invite"]);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("shows a retry message on a 502", async () => {
    await confirmResend(HttpResponse.json({}, { status: 502 }));
    expect(await screen.findByText("Couldn't resend the invite")).toBeInTheDocument();
  });

  it("offers to resend just this session for a legacy series", async () => {
    const { user, posts } = await confirmResend(
      HttpResponse.json({ details: { reason: "legacy_series" } }, { status: 409 })
    );
    await user.click(await screen.findByRole("button", { name: "Resend this session" }));
    await waitFor(() =>
      expect(posts).toEqual([
        "/coaching_session_series/series-9/resend_invite",
        "/coaching_sessions/session-7/resend_invite",
      ])
    );
  });
});
