import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { SessionRow } from "@/components/ui/join-session/session-row";
import type { Liveness, MenuSession } from "@/components/ui/join-session/types";

const ZONE = "America/Chicago";
const at = (iso: string) => DateTime.fromISO(iso, { zone: ZONE });
const now = at("2026-08-25T12:00");

function session(isoStart: string, liveness: Liveness = "none"): MenuSession {
  return { id: "id", start: at(isoStart), title: "Session 7", liveness };
}

function renderList(s: MenuSession, isCurrent = false) {
  const onSelect = vi.fn();
  render(
    <SessionRow variant="list" session={s} isCurrent={isCurrent} now={now} onSelect={onSelect} />
  );
  return { onSelect, button: screen.getByRole("button") };
}

describe("SessionRow list variant", () => {
  it("renders a past session", () => {
    const { button } = renderList(session("2026-08-18T10:00"));
    expect(screen.getByText("Tue Aug 18")).toBeInTheDocument();
    expect(screen.getByText("Session 7")).toBeInTheDocument();
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(button).not.toHaveClass("opacity-75");
  });

  it("dims a future session and tags it upcoming", () => {
    const { button } = renderList(session("2026-09-01T10:00"));
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(button).toHaveClass("opacity-75");
  });

  it("pulses a live session and tints its tag", () => {
    const { button } = renderList(session("2026-08-25T11:55", "live"));
    expect(button.querySelector(".animate-live-pulse")).not.toBeNull();
    expect(screen.getByText("Previous")).toHaveClass("text-brand");
  });

  it("marks the current session with a chip instead of a chevron", () => {
    const { button } = renderList(session("2026-08-18T10:00"), true);
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(button.querySelector('[data-slot="row-chevron"]')).toBeNull();
    expect(button).toHaveAttribute("aria-current", "true");
    expect(button).toHaveClass("bg-brand-tint");
  });

  it("shows a chevron and no aria-current otherwise", () => {
    const { button } = renderList(session("2026-08-18T10:00"));
    expect(button.querySelector('[data-slot="row-chevron"]')).not.toBeNull();
    expect(button).not.toHaveAttribute("aria-current");
  });

  it("selects the session on click", () => {
    const { button, onSelect } = renderList(session("2026-08-18T10:00"));
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("id");
  });
});

describe("SessionRow today variant", () => {
  const person = {
    userId: "u1",
    firstName: "Ehab",
    fullName: "Ehab Badawi",
    initials: "EB",
  };

  function renderToday(liveness: Liveness) {
    render(
      <SessionRow
        variant="today"
        session={session("2026-08-25T14:30", liveness)}
        person={person}
        onSelect={vi.fn()}
      />
    );
    return screen.getByRole("button");
  }

  it("shows the person, time and title", () => {
    renderToday("none");
    expect(screen.getByText("EB")).toBeInTheDocument();
    expect(screen.getByText("Ehab Badawi")).toBeInTheDocument();
    expect(screen.getByText("Today · 2:30 PM")).toBeInTheDocument();
    expect(screen.getByText("Session 7")).toBeInTheDocument();
  });

  it("lifts a live session onto the card surface", () => {
    expect(renderToday("live")).toHaveClass("bg-card");
  });

  it("keeps a non-live session on the wash", () => {
    expect(renderToday("none")).not.toHaveClass("bg-card");
  });
});
