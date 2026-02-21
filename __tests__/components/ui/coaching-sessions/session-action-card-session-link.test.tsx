import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import { SessionActionCard } from "@/components/ui/coaching-sessions/session-action-card";
import { TestProviders } from "@/test-utils/providers";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("react-syntax-highlighter", () => ({
  Prism: ({ children }: { children: string }) => children,
}));

vi.mock("react-syntax-highlighter/dist/esm/styles/prism", () => ({
  oneDark: {},
}));

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <TestProviders>
      <TooltipProvider>{children}</TooltipProvider>
    </TestProviders>
  );
}

const now = DateTime.now();

const baseProps = {
  action: {
    id: "action-1",
    coaching_session_id: "session-99",
    body: "Test action",
    user_id: "user-1",
    status: ItemStatus.NotStarted,
    status_changed_at: now,
    due_by: now.plus({ days: 7 }),
    created_at: now,
    updated_at: now,
    assignee_ids: ["user-1"],
  },
  locale: "en-US",
  coachId: "coach-1",
  coachName: "Alice",
  coacheeId: "coachee-1",
  coacheeName: "Bob",
  onStatusChange: vi.fn(),
  onDueDateChange: vi.fn(),
  onAssigneesChange: vi.fn(),
  onBodyChange: vi.fn(),
};

describe("SessionActionCard — showSessionLink / sessionDate", () => {
  it("hides session link when variant is 'current' and showSessionLink is false (default)", () => {
    render(
      <Wrapper>
        <SessionActionCard {...baseProps} variant="current" />
      </Wrapper>
    );

    expect(screen.queryByRole("link", { name: /From:/i })).not.toBeInTheDocument();
  });

  it("shows 'From:' with session date when showSessionLink and sessionDate are provided", () => {
    const sessionDate = DateTime.fromISO("2026-02-13");

    render(
      <Wrapper>
        <SessionActionCard
          {...baseProps}
          variant="current"
          showSessionLink
          sessionDate={sessionDate}
        />
      </Wrapper>
    );

    const link = screen.getByRole("link", { name: /From:/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/coaching-sessions/session-99?tab=actions");
    expect(link.textContent).toContain("Feb 13, 2026");
  });

  it("shows 'From:' with sessionDate when variant is 'previous' and sessionDate is provided", () => {
    const sessionDate = DateTime.fromISO("2026-01-20");

    render(
      <Wrapper>
        <SessionActionCard {...baseProps} variant="previous" sessionDate={sessionDate} />
      </Wrapper>
    );

    const link = screen.getByRole("link", { name: /From:/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/coaching-sessions/session-99?tab=actions");
    expect(link.textContent).toContain("Jan 20, 2026");
  });

  it("falls back to created_at when variant is 'previous' and no sessionDate", () => {
    render(
      <Wrapper>
        <SessionActionCard {...baseProps} variant="previous" />
      </Wrapper>
    );

    const link = screen.getByRole("link", { name: /From:/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/coaching-sessions/session-99?tab=actions");
  });
});
