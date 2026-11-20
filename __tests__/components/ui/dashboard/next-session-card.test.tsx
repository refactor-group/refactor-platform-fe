import type { ReactNode } from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DateTime } from "ts-luxon";
import { createMockEnrichedSession, createMockGoal, createMockSession, mockParticipants } from "../../../test-utils";
import { RelationshipKind } from "@/types/coaching-relationship";
import type { CoachingSession, EnrichedCoachingSession } from "@/types/coaching-session";
import { type CoachingSessionTopic, TopicStatus } from "@/types/coaching-session-topic";
import { ActionsDueKind, type ActionsDueSummary } from "@/lib/actions-due";
import { type Option, Some, None } from "@/types/option";

/**
 * Story: "Show the viewer their next session this week at a glance, with a way
 * into it, or an invitation to schedule one when none remain."
 */

vi.mock("next/link", () => ({
  default: ({ children, href, className }: { children: ReactNode; href: string; className?: string }) => (
    <a href={href} className={className} onClick={(e) => e.preventDefault()}>
      {children}
    </a>
  ),
}));

const mockAuth = vi.fn();
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: (selector: (s: unknown) => unknown) => selector(mockAuth()),
}));

const mockUseNextSession = vi.fn();
vi.mock("@/lib/hooks/use-next-session", () => ({
  useNextSession: () => mockUseNextSession(),
}));

const mockUseActionsDue = vi.fn();
vi.mock("@/lib/hooks/use-actions-due", () => ({
  useActionsDue: () => mockUseActionsDue(),
}));

vi.mock("@/lib/hooks/use-user-timezone", () => ({
  useUserTimezone: () => "America/Chicago",
}));

import { NextSessionCard } from "@/components/ui/dashboard/next-session-card";
import { GLANCE_HEADER_CLASS, GLANCE_ROW_CLASS } from "@/components/ui/dashboard/next-session-glance";

const ZONE = "America/Chicago";
const NOW = DateTime.fromISO("2026-11-19T14:20:00", { zone: ZONE });
const refresh = vi.fn();

/** A session at `localTime` on Nov 19 in Chicago, with Justin Brown as the other person. */
function sessionAt(localTime: string, overrides: Partial<EnrichedCoachingSession> = {}): EnrichedCoachingSession {
  const start = DateTime.fromISO(`2026-11-19T${localTime}:00`, { zone: ZONE });
  return createMockEnrichedSession({
    id: "next-id",
    date: start.toUTC().toFormat("yyyy-MM-dd'T'HH:mm:ss"),
    duration_minutes: 50,
    title: Some("Q3 planning"),
    participants: Some(
      mockParticipants("coach-1", "coachee-1", RelationshipKind.Coaching, {
        coach: { first_name: "Jim", last_name: "Hodapp" },
        coachee: { first_name: "Justin", last_name: "Brown" },
      })
    ),
    ...overrides,
  });
}

function topic(id: string): CoachingSessionTopic {
  return {
    id,
    coaching_session_id: "next-id",
    user_id: "coach-1",
    body: `Topic ${id}`,
    status: TopicStatus.Open,
    moved_from_session_id: None,
    created_at: NOW,
    updated_at: NOW,
  };
}

function setAuth(canScheduleSessions = true) {
  mockAuth.mockReturnValue({ userId: "coach-1", canScheduleSessions });
}

function setNext(state: {
  session?: Option<EnrichedCoachingSession>;
  isLoading?: boolean;
  isError?: boolean;
  now?: DateTime;
}) {
  mockUseNextSession.mockReturnValue({
    session: state.session ?? None,
    isLoading: state.isLoading ?? false,
    isError: state.isError ?? false,
    refresh,
    now: state.now ?? NOW,
  });
}

function setActionsDue(summary: ActionsDueSummary, previous: Option<CoachingSession> = None) {
  mockUseActionsDue.mockReturnValue({ due: [], summary, previous, isLoading: false, isError: false });
}

function renderCard(props: Partial<Parameters<typeof NextSessionCard>[0]> = {}) {
  return render(<NextSessionCard onCreateSession={vi.fn()} {...props} />);
}

function glanceLink(label: string): HTMLElement {
  return screen.getByText(label).closest("a") as HTMLElement;
}

function glanceToggle(): HTMLElement {
  return screen.getByRole("button", { name: "At a glance" });
}

beforeEach(() => {
  vi.clearAllMocks();
  setAuth();
  setNext({});
  setActionsDue({ kind: ActionsDueKind.None });
});

describe("NextSessionCard states", () => {
  it("shows quiet placeholders while loading", () => {
    setNext({ isLoading: true });
    const { container } = renderCard();

    expect(screen.getByText("Next session")).toBeInTheDocument();
    expect(screen.getByText("Loading your next session")).toHaveClass("sr-only");
    const shell = container.firstElementChild;
    expect(shell).toHaveClass("min-h-[420px]", "bg-hero-wash");
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("shapes the loading placeholder like the glance, with nothing interactive", () => {
    setNext({ isLoading: true });
    const { container } = renderCard();

    const rows = screen.getAllByTestId("glance-placeholder-row");
    expect(rows).toHaveLength(4);
    rows.forEach((r) => expect(r).toHaveClass(...GLANCE_ROW_CLASS.split(" ")));
    expect(screen.getByTestId("glance-placeholder-header")).toHaveClass(
      ...GLANCE_HEADER_CLASS.split(" ")
    );
    const card = screen.getByTestId("next-session-card");
    expect(within(card).queryAllByRole("button")).toHaveLength(0);
    expect(card.querySelector("button, a")).toBeNull();
    expect(container.querySelector(".animate-pulse")).toBeNull();
  });

  it("shows an error with Try again in a plain shell", () => {
    setNext({ isError: true });
    const { container } = renderCard();

    expect(screen.getByText("Couldn't load your next session")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(container.firstElementChild).not.toHaveClass("bg-hero-wash");
  });

  it("invites a scheduler to schedule when no session remains", () => {
    const onCreateSession = vi.fn();
    const { container } = renderCard({ onCreateSession });

    expect(screen.getByText("No more sessions this week.")).toBeInTheDocument();
    expect(screen.getByText("Check back on Monday.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Schedule a session" }));
    expect(onCreateSession).toHaveBeenCalledTimes(1);
    expect(container.firstElementChild).toHaveClass("bg-hero-wash");
  });

  it("offers a non-scheduler no Schedule a session button", () => {
    setAuth(false);
    renderCard();
    expect(screen.queryByRole("button", { name: "Schedule a session" })).not.toBeInTheDocument();
  });
});

describe("NextSessionCard populated", () => {
  it("names the day, person and time", () => {
    setNext({ session: Some(sessionAt("15:05")) });
    renderCard();

    expect(screen.getByRole("heading", { name: "Today with Justin at 3:05 PM" })).toBeInTheDocument();
    expect(screen.getByText("JB")).toBeInTheDocument();
  });

  // Hot follows SessionUrgency.Imminent, which starts 30 minutes out.
  it("pulses in brand color once the session is imminent", () => {
    setNext({ session: Some(sessionAt("15:05")), now: NOW.set({ minute: 40 }) });
    renderCard();

    const when = screen.getByText("Starts in 25 mins");
    expect(when).toHaveClass("text-brand");
    expect(when.querySelector(".animate-ping")).not.toBeNull();
  });

  it("stays quiet 45 minutes out", () => {
    setNext({ session: Some(sessionAt("15:05")) });
    renderCard();

    const when = screen.getByText("Starts in 45 mins");
    expect(when).toHaveClass("text-muted-foreground");
    expect(when.querySelector(".animate-ping")).toBeNull();
  });

  it("stays quiet when the session is hours away", () => {
    setNext({ session: Some(sessionAt("18:00")) });
    renderCard();

    const when = screen.getByText("Starts in 3 h 40 mins");
    expect(when).toHaveClass("text-muted-foreground");
    expect(when.querySelector(".animate-ping")).toBeNull();
  });

  it("summarizes topics, overdue actions, last agreements and goals", () => {
    const prev = createMockSession({ id: "prev-id" });
    setNext({
      session: Some(
        sessionAt("15:05", {
          topics: Some([topic("t1"), topic("t2")]),
          goals: [createMockGoal({ id: "g1" }), createMockGoal({ id: "g2" })],
        })
      ),
    });
    setActionsDue({ kind: ActionsDueKind.Overdue, count: 3, overdue: 1 }, Some(prev));
    renderCard();

    expect(within(glanceLink("Topics")).getByText("2")).toBeInTheDocument();
    expect(within(glanceLink("Actions due")).getByText("1 overdue")).toHaveClass("text-warning-text");
    expect(within(glanceLink("Goals")).getByText("2 active")).toBeInTheDocument();
    expect(glanceLink("Agreements from last session")).toHaveAttribute(
      "href",
      "/coaching-sessions/prev-id?panel=agreements"
    );
  });

  it("says None yet and None when there is nothing to show", () => {
    setNext({ session: Some(sessionAt("15:05", { topics: Some([]), goals: [] })) });
    setActionsDue({ kind: ActionsDueKind.None }, None);
    renderCard();

    expect(screen.getAllByText("None yet")).toHaveLength(2);
    expect(screen.getAllByText("None")).toHaveLength(1);
    expect(screen.queryByText("Agreements from last session")).not.toBeInTheDocument();
  });

  it("counts actions due when none are overdue", () => {
    setNext({ session: Some(sessionAt("15:05")) });
    setActionsDue({ kind: ActionsDueKind.Count, count: 3 });
    renderCard();

    expect(within(glanceLink("Actions due")).getByText("3")).toBeInTheDocument();
  });

  it("links each row to its panel and Open session to the session", () => {
    setNext({ session: Some(sessionAt("15:05")) });
    renderCard();

    expect(glanceLink("Topics")).toHaveAttribute("href", "/coaching-sessions/next-id?panel=topics");
    expect(glanceLink("Actions due")).toHaveAttribute(
      "href",
      "/coaching-sessions/next-id?panel=actions&actions=due"
    );
    expect(glanceLink("Goals")).toHaveAttribute("href", "/coaching-sessions/next-id?panel=goals");
    expect(screen.getByRole("link", { name: "Open session" })).toHaveAttribute(
      "href",
      "/coaching-sessions/next-id"
    );
  });

  it("collapses At a glance only from its header", () => {
    setNext({ session: Some(sessionAt("15:05")) });
    renderCard();

    expect(glanceToggle()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Topics")).toBeVisible();

    fireEvent.click(screen.getByText("Topics"));
    expect(glanceToggle()).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(glanceToggle());
    expect(glanceToggle()).toHaveAttribute("aria-expanded", "false");
    const list = screen.getByRole("list", { hidden: true });
    expect(list).toHaveClass("invisible", "opacity-0");
    expect(list).toHaveAttribute("inert");
    expect(list).toHaveAttribute("aria-hidden", "true");

    fireEvent.click(glanceToggle());
    expect(glanceToggle()).toHaveAttribute("aria-expanded", "true");
    expect(list).not.toHaveClass("invisible");
    expect(list).toHaveClass("opacity-100");
    expect(list).not.toHaveAttribute("inert");
    expect(list).not.toHaveAttribute("aria-hidden");
    expect(screen.getByRole("link", { name: /Topics/ })).toBeVisible();
  });

  it("leaves out the title, duration, Reschedule and Join", () => {
    setNext({ session: Some(sessionAt("15:05")) });
    renderCard();

    expect(screen.queryByText(/Q3 planning/)).not.toBeInTheDocument();
    expect(screen.queryByText(/50 min/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reschedule/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Join/)).not.toBeInTheDocument();
  });

  it("hands the parent the next-session refresh", () => {
    const onRefreshNeeded = vi.fn();
    setNext({ session: Some(sessionAt("15:05")) });
    renderCard({ onRefreshNeeded });

    expect(onRefreshNeeded).toHaveBeenCalledWith(refresh);
  });
});
