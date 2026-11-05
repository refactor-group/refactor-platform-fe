import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateTime } from "ts-luxon";
import { Some } from "@/types/option";
import { defaultCoachingSessionTopic } from "@/types/coaching-session-topic";
import { cardView, CardTense, type CardContext } from "@/lib/week-grid/card";
import { SessionAction } from "@/lib/session-actions";
import { SessionCard } from "@/components/ui/dashboard/week-grid/session-card";
import { createMockEnrichedSession } from "../../../../test-utils";

const TZ = "America/Chicago";
// 1:45 PM in Chicago.
const NOW = DateTime.fromISO("2026-08-18T18:45:00Z", { zone: "utc" });
const COACH: CardContext = { viewerId: "coach-1", now: NOW, timezone: TZ };
const COACHEE: CardContext = { viewerId: "coachee-1", now: NOW, timezone: TZ };

const topics = (n: number) => Array.from({ length: n }, () => defaultCoachingSessionTopic());

function view(utc: string, topicCount: number, context = COACH, series = false) {
  return cardView(
    createMockEnrichedSession({
      id: "s-1",
      date: utc,
      duration_minutes: 50,
      topics: topics(topicCount),
      ...(series && { coaching_session_series_id: Some("series-1") }),
    }),
    context
  );
}

function renderCard(v = view("2026-08-19T15:00:00", 3)) {
  const onAction = vi.fn();
  render(<SessionCard view={v} onAction={onAction} />);
  return { onAction, card: screen.getByTestId("session-card-s-1") };
}

function openMenu(card: HTMLElement) {
  fireEvent.contextMenu(card);
  return screen.getByRole("menu");
}

const itemNames = (menu: HTMLElement) =>
  within(menu)
    .getAllByRole("menuitem")
    .map((i) => i.textContent?.trim());

describe("SessionCard", () => {
  it("shows the time in the viewer's zone, the other person and the note", () => {
    const { card } = renderCard();
    expect(card).toHaveTextContent("10:00 AM");
    expect(card).toHaveTextContent("Alex Chen");
    expect(card).toHaveTextContent("3 topics");
  });

  it("is keyboard focusable and carries its tense", () => {
    const { card } = renderCard(view("2026-08-17T15:00:00", 2));
    expect(card).toHaveAttribute("tabindex", "0");
    expect(card).toHaveAttribute("data-tense", CardTense.Past);
  });

  it("shows the relative start on a live card", () => {
    const { card } = renderCard(view("2026-08-18T19:30:00", 0));
    expect(card).toHaveAttribute("data-tense", CardTense.Live);
    expect(card).toHaveTextContent("in 45 min");
  });

  it("flags an upcoming card with no topics", () => {
    expect(renderCard(view("2026-08-19T15:00:00", 0)).card).toHaveTextContent("No topics yet");
  });

  it("links Prepare to the session page when topics are missing", () => {
    const { card } = renderCard(view("2026-08-19T15:00:00", 0));
    expect(within(card).getByRole("link", { name: /Prepare/ })).toHaveAttribute("href", "/coaching-sessions/s-1");
    expect(card).not.toHaveTextContent("Ready");
  });

  it("reads Ready with at least one topic, with no Prepare link", () => {
    const { card } = renderCard();
    expect(card).toHaveTextContent("Ready");
    expect(within(card).queryByRole("link", { name: /Prepare/ })).not.toBeInTheDocument();
  });

  it("reads Done once past", () => {
    const { card } = renderCard(view("2026-08-17T15:00:00", 2));
    expect(card).toHaveTextContent("Done");
    expect(card).toHaveTextContent("2 topics");
  });
});

describe("SessionCard context menu", () => {
  it("offers the coach's upcoming actions, with Cancel instead of Delete", () => {
    const { card } = renderCard();
    const menu = openMenu(card);
    expect(itemNames(menu)).toEqual([
      "Open session",
      "Reschedule…",
      "Share link",
      "Resend invite",
      "Cancel session…",
    ]);
    expect(menu).not.toHaveTextContent(/delete/i);
  });

  it("adds the series items on a series session", () => {
    const { card } = renderCard(view("2026-08-19T15:00:00", 3, COACH, true));
    expect(itemNames(openMenu(card))).toEqual([
      "Open session",
      "Reschedule…",
      "View series",
      "Edit series…",
      "Share link",
      "Resend series invite",
      "Cancel session…",
      "Cancel series…",
    ]);
  });

  it("offers Open and Remove on a past session the viewer coaches", () => {
    const { card } = renderCard(view("2026-08-17T15:00:00", 2));
    expect(itemNames(openMenu(card))).toEqual(["Open session", "Remove session…"]);
  });

  it("offers only Open session to a coachee", () => {
    const { card } = renderCard(view("2026-08-19T15:00:00", 3, COACHEE));
    expect(itemNames(openMenu(card))).toEqual(["Open session"]);
  });

  it("runs the chosen action on the card's session", () => {
    const v = view("2026-08-19T15:00:00", 3);
    const { card, onAction } = renderCard(v);
    fireEvent.click(within(openMenu(card)).getByRole("menuitem", { name: "Cancel session…" }));
    expect(onAction).toHaveBeenCalledWith(SessionAction.DeleteSession, v.session);
  });

  it("tags each item with a stable test id", () => {
    const { card } = renderCard();
    expect(within(openMenu(card)).getByTestId("session-action-resend-invite")).toBeInTheDocument();
  });
});
