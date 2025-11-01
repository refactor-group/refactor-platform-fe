import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TodaySessionCard } from "@/components/ui/dashboard/today-session-card";
import { EnrichedCoachingSession } from "@/types/coaching-session";
import { DateTime } from "ts-luxon";

/**
 * Test Suite: TodaySessionCard Component
 * Story: "Display a single coaching session card with all relevant information"
 */

// Mock the share session link functionality
vi.mock("@/components/ui/share-session-link", () => ({
  copyCoachingSessionLinkWithToast: vi.fn().mockResolvedValue(undefined),
}));

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock the auth store
vi.mock("@/lib/providers/auth-store-provider", () => ({
  useAuthStore: vi.fn(() => ({
    userSession: {
      id: "user-1",
      first_name: "Test",
      last_name: "User",
      timezone: "America/Los_Angeles",
    },
  })),
}));

const createMockEnrichedSession = (
  overrides?: Partial<EnrichedCoachingSession>
): EnrichedCoachingSession => ({
  id: "session-1",
  coaching_relationship_id: "rel-1",
  date: DateTime.now().plus({ hours: 2 }).toUTC().toISO(),
  created_at: DateTime.now(),
  updated_at: DateTime.now(),
  relationship: {
    id: "rel-1",
    coach_id: "coach-1",
    coachee_id: "user-1",
    organization_id: "org-1",
    created_at: DateTime.now(),
    updated_at: DateTime.now(),
  },
  // Coach and coachee are top-level fields, not nested in relationship
  coach: {
    id: "coach-1",
    first_name: "Coach",
    last_name: "Person",
    display_name: "Coach Person",
    email: "coach@example.com",
    timezone: "America/Los_Angeles",
    role: "coach",
    roles: [],
    created_at: DateTime.now().toISO() ?? '',
    updated_at: DateTime.now().toISO() ?? '',
  },
  coachee: {
    id: "user-1",
    first_name: "Caleb",
    last_name: "Bourg",
    display_name: "Caleb Bourg",
    email: "caleb@example.com",
    timezone: "America/Los_Angeles",
    role: "coach",
    roles: [],
    created_at: DateTime.now().toISO() ?? '',
    updated_at: DateTime.now().toISO() ?? '',
  },
  organization: {
    id: "org-1",
    name: "Refactor Group",
    created_at: DateTime.now(),
    updated_at: DateTime.now(),
  },
  overarching_goal: {
    id: "goal-1",
    title: "Q4 Strategy Review",
    details: "",
    coaching_relationship_id: "rel-1",
    created_at: DateTime.now(),
    updated_at: DateTime.now(),
  },
  ...overrides,
});

describe("TodaySessionCard", () => {
  it("should render session goal title", () => {
    const session = createMockEnrichedSession({
      overarching_goal: {
        id: "goal-1",
        title: "Product Launch Planning",
        details: "",
        coaching_relationship_id: "rel-1",
        created_at: DateTime.now(),
        updated_at: DateTime.now(),
      },
    });

    render(<TodaySessionCard session={session} />);

    expect(screen.getByText("Goal: Product Launch Planning")).toBeInTheDocument();
  });

  it("should display participant name", () => {
    const session: EnrichedCoachingSession = {
      ...createMockEnrichedSession(),
      // Coach is top-level, user-1 is coachee so should show coach name
      coach: {
        id: "coach-1",
        first_name: "Alice",
        last_name: "Smith",
        display_name: "Alice Smith",
        email: "alice@example.com",
        timezone: "America/Los_Angeles",
        role: "coach",
        roles: [],
        created_at: DateTime.now().toISO() ?? '',
        updated_at: DateTime.now().toISO() ?? '',
      },
    };

    render(<TodaySessionCard session={session} />);

    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Meeting with:")).toBeInTheDocument();
  });

  it("should display user role as Coach", () => {
    const session: EnrichedCoachingSession = {
      ...createMockEnrichedSession(),
      relationship: {
        id: "rel-1",
        coach_id: "user-1", // User is the coach
        coachee_id: "coachee-2",
        organization_id: "org-1",
        created_at: DateTime.now(),
        updated_at: DateTime.now(),
      },
      // Coachee is top-level, user-1 is coach so should show coachee name
      coachee: {
        id: "coachee-2",
        first_name: "Caleb",
        last_name: "Bourg",
        display_name: "Caleb Bourg",
        email: "caleb@example.com",
        timezone: "America/Los_Angeles",
        role: "coach",
        roles: [],
        created_at: DateTime.now().toISO() ?? '',
        updated_at: DateTime.now().toISO() ?? '',
      },
    };

    render(<TodaySessionCard session={session} />);

    expect(screen.getByText("Coach")).toBeInTheDocument();
    expect(screen.getByText("Your role:")).toBeInTheDocument();
  });

  it("should display organization name", () => {
    const session = createMockEnrichedSession({
      organization: {
        id: "org-2",
        name: "Tech Innovations Inc",
        created_at: DateTime.now(),
        updated_at: DateTime.now(),
      },
    });

    render(<TodaySessionCard session={session} />);

    expect(screen.getByText("Tech Innovations Inc")).toBeInTheDocument();
  });

  it("should display urgency message for imminent session", () => {
    const session = createMockEnrichedSession({
      date: DateTime.now().plus({ minutes: 15 }).toUTC().toISO(),
    });

    render(<TodaySessionCard session={session} />);

    expect(screen.getByText(/Starting in \d+ minutes?/)).toBeInTheDocument();
  });

  it("should apply imminent urgency styles", () => {
    const session = createMockEnrichedSession({
      date: DateTime.now().plus({ minutes: 15 }).toUTC().toISO(),
    });

    const { container } = render(<TodaySessionCard session={session} />);

    const header = container.querySelector(".bg-amber-50");
    expect(header).toBeInTheDocument();
  });

  it("should apply soon urgency styles", () => {
    const session = createMockEnrichedSession({
      date: DateTime.now().plus({ hours: 1 }).toUTC().toISO(),
    });

    const { container } = render(<TodaySessionCard session={session} />);

    const header = container.querySelector(".bg-blue-50");
    expect(header).toBeInTheDocument();
  });

  it("should apply later urgency styles", () => {
    const session = createMockEnrichedSession({
      date: DateTime.now().plus({ hours: 3 }).toUTC().toISO(),
    });

    const { container } = render(<TodaySessionCard session={session} />);

    const header = container.querySelector(".bg-slate-50");
    expect(header).toBeInTheDocument();
  });

  it("should apply past urgency styles", () => {
    const session = createMockEnrichedSession({
      date: DateTime.now().minus({ hours: 1 }).toUTC().toISO(),
    });

    const { container } = render(<TodaySessionCard session={session} />);

    const header = container.querySelector(".bg-muted");
    expect(header).toBeInTheDocument();
  });

  it("should show 'Join Session' button for upcoming sessions", () => {
    const session = createMockEnrichedSession({
      date: DateTime.now().plus({ hours: 2 }).toUTC().toISO(),
    });

    render(<TodaySessionCard session={session} />);

    expect(screen.getByText("Join Session")).toBeInTheDocument();
  });

  it("should show 'View Session' button for past sessions", () => {
    const session = createMockEnrichedSession({
      date: DateTime.now().minus({ hours: 1 }).toUTC().toISO(),
    });

    render(<TodaySessionCard session={session} />);

    expect(screen.getByText("View Session")).toBeInTheDocument();
  });

  it("should have a link to the session detail page", () => {
    const session = createMockEnrichedSession({
      id: "session-123",
    });

    render(<TodaySessionCard session={session} />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/coaching-sessions/session-123");
  });

  it("should have a share button", () => {
    const session = createMockEnrichedSession();

    render(<TodaySessionCard session={session} />);

    const shareButton = screen.getByText("Copy session link", { selector: ".sr-only" });
    expect(shareButton).toBeInTheDocument();
  });

  it("should call share handler when share button is clicked", async () => {
    const { copyCoachingSessionLinkWithToast } = await import(
      "@/components/ui/share-session-link"
    );
    const session = createMockEnrichedSession({
      id: "session-456",
    });

    render(<TodaySessionCard session={session} />);

    // Find the button by its sr-only text
    const shareText = screen.getByText("Copy session link", { selector: ".sr-only" });
    const shareButton = shareText.closest("button");
    expect(shareButton).toBeInTheDocument();

    fireEvent.click(shareButton!);
    expect(copyCoachingSessionLinkWithToast).toHaveBeenCalledWith("session-456");
  });

  it("should render all icon elements", () => {
    const session = createMockEnrichedSession();

    const { container } = render(<TodaySessionCard session={session} />);

    // Check for presence of icon containers (Lucide icons render as SVGs)
    const icons = container.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
  });
});
