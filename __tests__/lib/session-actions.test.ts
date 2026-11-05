import { describe, expect, it } from "vitest";
import { DateTime } from "ts-luxon";
import { None, Some } from "@/types/option";
import { createMockEnrichedSession } from "../test-utils";
import {
  SessionAction,
  SessionActionGroup,
  sessionActionHint,
  sessionActionLabel,
  sessionActionsFor,
} from "@/lib/session-actions";

const NOW = DateTime.fromISO("2026-11-05T15:00:00Z", { zone: "utc" });

const oneOff = createMockEnrichedSession();
const seriesAhead = createMockEnrichedSession({
  coaching_session_series_id: Some("series-1"),
  series: Some({ id: "series-1", last_session_date: NOW.plus({ weeks: 4 }) }),
});
const seriesFinished = createMockEnrichedSession({
  coaching_session_series_id: Some("series-1"),
  series: Some({ id: "series-1", last_session_date: NOW.minus({ weeks: 1 }) }),
});
const seriesUnknown = createMockEnrichedSession({
  coaching_session_series_id: Some("series-1"),
});

function actions(session = oneOff, isCoach = true, isPast = false) {
  return sessionActionsFor(session, { isCoach, isPast, now: NOW }).map((i) => i.action);
}

describe("sessionActionsFor", () => {
  it("gives a coach every one-off action for an upcoming session, in menu order", () => {
    expect(actions()).toEqual([
      SessionAction.Reschedule,
      SessionAction.ShareLink,
      SessionAction.ResendInvite,
      SessionAction.DeleteSession,
    ]);
  });

  it("adds the series actions for a series session", () => {
    expect(actions(seriesAhead)).toEqual([
      SessionAction.Reschedule,
      SessionAction.ViewSeries,
      SessionAction.EditSeries,
      SessionAction.ShareLink,
      SessionAction.ResendInvite,
      SessionAction.DeleteSession,
      SessionAction.DeleteSeries,
    ]);
  });

  it("drops Reschedule on a past session but keeps delete for a coach", () => {
    expect(actions(oneOff, true, true)).toEqual([
      SessionAction.ShareLink,
      SessionAction.ResendInvite,
      SessionAction.DeleteSession,
    ]);
  });

  it("gives a coachee only Share link, plus View series on a series session", () => {
    expect(actions(oneOff, false)).toEqual([SessionAction.ShareLink]);
    expect(actions(seriesAhead, false)).toEqual([SessionAction.ViewSeries, SessionAction.ShareLink]);
  });

  it("groups items as schedule, share, then destructive", () => {
    const groups = sessionActionsFor(seriesAhead, { isCoach: true, isPast: false, now: NOW }).map(
      (i) => i.group
    );
    expect(groups).toEqual([
      SessionActionGroup.Schedule,
      SessionActionGroup.Schedule,
      SessionActionGroup.Schedule,
      SessionActionGroup.Share,
      SessionActionGroup.Share,
      SessionActionGroup.Destructive,
      SessionActionGroup.Destructive,
    ]);
  });

  it.each([
    ["an upcoming one-off", oneOff, false, true],
    ["a past one-off", oneOff, true, false],
    ["a series with a session ahead, even from a past row", seriesAhead, true, true],
    ["a finished series", seriesFinished, false, false],
    ["a series whose end is unknown", seriesUnknown, true, true],
  ])("enables Resend invite for %s: %s", (_label, session, isPast, enabled) => {
    const resend = sessionActionsFor(session, { isCoach: true, isPast, now: NOW }).find(
      (i) => i.action === SessionAction.ResendInvite
    );
    expect(resend?.enabled).toBe(enabled);
  });

  it("enables every other action", () => {
    const items = sessionActionsFor(seriesAhead, { isCoach: true, isPast: false, now: NOW });
    expect(items.filter((i) => i.action !== SessionAction.ResendInvite).every((i) => i.enabled)).toBe(true);
  });
});

describe("sessionActionLabel", () => {
  it.each([
    [SessionAction.Reschedule, oneOff, "Reschedule"],
    [SessionAction.ViewSeries, seriesAhead, "View series"],
    [SessionAction.EditSeries, seriesAhead, "Edit series"],
    [SessionAction.ShareLink, oneOff, "Share link"],
    [SessionAction.ResendInvite, oneOff, "Resend invite"],
    [SessionAction.ResendInvite, seriesAhead, "Resend series invite"],
    [SessionAction.DeleteSession, oneOff, "Delete session"],
    [SessionAction.DeleteSeries, seriesAhead, "Delete series"],
  ])("labels %s", (action, session, label) => {
    expect(sessionActionLabel(action, session)).toBe(label);
  });
});

describe("sessionActionHint", () => {
  it("explains a disabled Resend invite and nothing else", () => {
    const items = sessionActionsFor(seriesFinished, { isCoach: true, isPast: false, now: NOW });
    const hints = items.map((i) => sessionActionHint(i));
    const resendIndex = items.findIndex((i) => i.action === SessionAction.ResendInvite);
    expect(hints[resendIndex]).toEqual(Some("No upcoming sessions"));
    expect(hints.filter((_, i) => i !== resendIndex).every((h) => h.none)).toBe(true);
  });

  it("is None for an enabled Resend invite", () => {
    const resend = sessionActionsFor(oneOff, { isCoach: true, isPast: false, now: NOW }).find(
      (i) => i.action === SessionAction.ResendInvite
    );
    expect(resend && sessionActionHint(resend)).toEqual(None);
  });
});
