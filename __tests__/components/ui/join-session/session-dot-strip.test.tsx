import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { SessionDotStrip } from "@/components/ui/join-session/session-dot-strip";
import type { DotKind, MenuSession, MonthGroup } from "@/components/ui/join-session/types";

const at = (iso: string) => DateTime.fromISO(iso, { zone: "America/Chicago" });

function s(id: string, iso: string): MenuSession {
  return { id, start: at(iso), title: `Title ${id}`, liveness: "none" };
}

const p1 = s("p1", "2026-08-11T10:00");
const c = s("c", "2026-08-18T10:00");
const f1 = s("f1", "2026-09-01T10:00");

const groups: MonthGroup[] = [
  { key: "2026-08", label: "Aug", selected: true, sessions: [p1, c] },
  { key: "2026-09", label: "Sep", selected: false, sessions: [f1] },
];

const kinds: Record<string, DotKind> = { p1: "past", c: "current", f1: "upcoming" };

function renderStrip() {
  const onSelect = vi.fn();
  const { container } = render(
    <SessionDotStrip
      personName="Ehab Badawi"
      groups={groups}
      kindOf={(session) => kinds[session.id]}
      onSelect={onSelect}
    />
  );
  const tooltips = () => container.querySelectorAll(".bg-inverse");
  return { onSelect, tooltips };
}

describe("SessionDotStrip", () => {
  it("renders each dot as a labelled button with its kind", () => {
    renderStrip();
    expect(screen.getByRole("button", { name: "Aug 11 · Title p1" })).toHaveAttribute(
      "data-kind",
      "past"
    );
    expect(screen.getByRole("button", { name: "Aug 18 · Title c" })).toHaveAttribute(
      "data-kind",
      "current"
    );
    expect(screen.getByRole("button", { name: "Sep 1 · Title f1" })).toHaveAttribute(
      "data-kind",
      "upcoming"
    );
    expect(screen.getByText("Ehab Badawi")).toBeInTheDocument();
  });

  it("shows one tooltip on hover and hides it on leave", () => {
    const { tooltips } = renderStrip();
    const dot = screen.getByRole("button", { name: "Aug 11 · Title p1" });
    expect(tooltips()).toHaveLength(0);
    fireEvent.mouseEnter(dot);
    expect(tooltips()).toHaveLength(1);
    expect(tooltips()[0]).toHaveTextContent("Aug 11 · Title p1");
    fireEvent.mouseLeave(dot);
    expect(tooltips()).toHaveLength(0);
  });

  it("keeps a single tooltip when moving between dots", () => {
    const { tooltips } = renderStrip();
    const first = screen.getByRole("button", { name: "Aug 11 · Title p1" });
    const second = screen.getByRole("button", { name: "Sep 1 · Title f1" });
    fireEvent.mouseEnter(first);
    fireEvent.mouseEnter(second);
    fireEvent.mouseLeave(first);
    expect(tooltips()).toHaveLength(1);
    expect(tooltips()[0]).toHaveTextContent("Sep 1 · Title f1");
  });

  it("shows the tooltip on focus", () => {
    const { tooltips } = renderStrip();
    fireEvent.focus(screen.getByRole("button", { name: "Aug 18 · Title c" }));
    expect(tooltips()).toHaveLength(1);
    expect(tooltips()[0]).toHaveTextContent("Aug 18 · Title c");
  });

  it("selects a session when its dot is clicked", () => {
    const { onSelect } = renderStrip();
    fireEvent.click(screen.getByRole("button", { name: "Sep 1 · Title f1" }));
    expect(onSelect).toHaveBeenCalledWith("f1");
  });

  it("emphasizes the selected month label", () => {
    renderStrip();
    expect(screen.getByText("Aug")).toHaveClass("font-semibold");
    expect(screen.getByText("Sep")).not.toHaveClass("font-semibold");
  });
});
