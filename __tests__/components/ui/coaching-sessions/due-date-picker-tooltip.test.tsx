import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { DateTime } from "ts-luxon";
import { DueDatePicker } from "@/components/ui/coaching-sessions/action-card-parts";
import { TooltipProvider } from "@/components/ui/tooltip";

function Wrapper({ children }: { children: ReactNode }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}

const noop = vi.fn();

describe("DueDatePicker — overdue tooltip", () => {
  it("shows 'This was due on <date>' tooltip when overdue and due date is in the past", async () => {
    const user = userEvent.setup();
    const pastDate = DateTime.fromISO("2026-01-15");

    render(
      <Wrapper>
        <DueDatePicker
          value={pastDate}
          onChange={noop}
          locale="en-US"
          variant="text"
          isOverdue
        />
      </Wrapper>
    );

    const pill = screen.getByText("Overdue");
    await user.hover(pill);

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("This was due on Jan 15, 2026");
  });

  it("shows 'This is due today' tooltip when overdue and due date is today", async () => {
    const user = userEvent.setup();
    const today = DateTime.now();

    render(
      <Wrapper>
        <DueDatePicker
          value={today}
          onChange={noop}
          locale="en-US"
          variant="text"
          isOverdue
        />
      </Wrapper>
    );

    const pill = screen.getByText("Overdue");
    await user.hover(pill);

    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip).toHaveTextContent("This is due today");
  });

  it("does not render a tooltip when not overdue", () => {
    const futureDate = DateTime.now().plus({ days: 3 });

    render(
      <Wrapper>
        <DueDatePicker
          value={futureDate}
          onChange={noop}
          locale="en-US"
          variant="text"
          isOverdue={false}
        />
      </Wrapper>
    );

    expect(screen.queryByText("Overdue")).not.toBeInTheDocument();
    expect(screen.getByText(/^Due:/)).toBeInTheDocument();
  });
});
