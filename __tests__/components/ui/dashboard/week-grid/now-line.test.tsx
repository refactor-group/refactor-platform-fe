import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { Some } from "@/types/option";
import { cardView } from "@/lib/week-grid/card";
import { withNowLine } from "@/components/ui/dashboard/week-grid/now-line";
import { SessionCard } from "@/components/ui/dashboard/week-grid/session-card";
import { createMockEnrichedSession } from "../../../../test-utils";

const TZ = "America/Chicago";
const at = (utc: string) => DateTime.fromISO(`2026-08-18T${utc}:00Z`, { zone: "utc" });
const SESSION = createMockEnrichedSession({ id: "s-1", date: "2026-08-18T18:40:00", duration_minutes: 10 });

function Today({ now }: { now: DateTime }) {
  const card = { ...cardView(SESSION, { viewerId: "coach-1", now, timezone: TZ }), dimmed: false };
  const nodes = [<SessionCard key={card.session.id} view={card} onAction={vi.fn()} onOpen={vi.fn()} />];
  return <div>{withNowLine(nodes, [card], Some(now))}</div>;
}

describe("withNowLine", () => {
  it("fills a session under way and drops the line, then brings it back", () => {
    const { rerender } = render(<Today now={at("18:35")} />);
    expect(screen.getByRole("separator", { name: /^Now,/ })).toBeInTheDocument();

    rerender(<Today now={at("18:45")} />);
    expect(screen.queryByRole("separator")).not.toBeInTheDocument();
    expect(screen.getByTestId("session-card-s-1").style.backgroundImage).toContain("50%");

    rerender(<Today now={at("18:55")} />);
    expect(screen.getByRole("separator", { name: /^Now,/ })).toBeInTheDocument();
    expect(screen.getByTestId("session-card-s-1").style.backgroundImage).toBe("");
  });

  it("keeps a focused card mounted as its session starts and ends", () => {
    const { rerender } = render(<Today now={at("18:35")} />);
    const card = screen.getByTestId("session-card-s-1");
    card.focus();

    for (const now of ["18:45", "18:55"]) {
      rerender(<Today now={at(now)} />);
      expect(screen.getByTestId("session-card-s-1")).toBe(card);
      expect(card).toHaveFocus();
    }
  });
});
