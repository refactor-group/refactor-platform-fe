import { describe, expect, it } from "vitest";
import { Some } from "@/types/option";
import { createMockEnrichedSession } from "../test-utils";
import {
  SessionAction,
  SessionActionGroup,
  SessionRemoval,
  sessionActionLabel,
  sessionActionsFor,
  sessionRemovalFor,
} from "@/lib/session-actions";

const oneOff = createMockEnrichedSession();
const inSeries = createMockEnrichedSession({ coaching_session_series_id: Some("series-1") });

const COACH_UPCOMING = { isCoach: true, isPast: false, isCompact: false };
const COACH_PAST = { isCoach: true, isPast: true, isCompact: false };
const COACHEE_UPCOMING = { isCoach: false, isPast: false, isCompact: false };
const COACHEE_PAST = { isCoach: false, isPast: true, isCompact: false };
const COACH_UPCOMING_COMPACT = { isCoach: true, isPast: false, isCompact: true };

const actions = (session = oneOff, context = COACH_UPCOMING) =>
  sessionActionsFor(session, context).map((i) => i.action);

describe("sessionActionsFor", () => {
  it("gives a coach the one-off actions for an upcoming session, in menu order", () => {
    expect(actions()).toEqual([
      SessionAction.OpenSession,
      SessionAction.Reschedule,
      SessionAction.ShareLink,
      SessionAction.ResendInvite,
      SessionAction.DeleteSession,
    ]);
  });

  it("adds the series actions for an upcoming series session", () => {
    expect(actions(inSeries)).toEqual([
      SessionAction.OpenSession,
      SessionAction.Reschedule,
      SessionAction.ViewSeries,
      SessionAction.EditSeries,
      SessionAction.ShareLink,
      SessionAction.ResendInvite,
      SessionAction.DeleteSession,
      SessionAction.DeleteSeries,
    ]);
  });

  it("gives a coach only Open and Remove on a past session, series or not", () => {
    expect(actions(oneOff, COACH_PAST)).toEqual([SessionAction.OpenSession, SessionAction.DeleteSession]);
    expect(actions(inSeries, COACH_PAST)).toEqual([SessionAction.OpenSession, SessionAction.DeleteSession]);
  });

  it("gives a coachee only Open session", () => {
    for (const context of [COACHEE_UPCOMING, COACHEE_PAST]) {
      expect(actions(oneOff, context)).toEqual([SessionAction.OpenSession]);
      expect(actions(inSeries, context)).toEqual([SessionAction.OpenSession]);
    }
  });

  it("groups items as navigate, schedule, share, then destructive", () => {
    expect(sessionActionsFor(inSeries, COACH_UPCOMING).map((i) => i.group)).toEqual([
      SessionActionGroup.Navigate,
      SessionActionGroup.Schedule,
      SessionActionGroup.Schedule,
      SessionActionGroup.Schedule,
      SessionActionGroup.Share,
      SessionActionGroup.Share,
      SessionActionGroup.Destructive,
      SessionActionGroup.Destructive,
    ]);
  });
});

describe("sessionActionsFor on a compact layout", () => {
  it("adds Move after Reschedule for an upcoming session the viewer coaches", () => {
    expect(actions(oneOff, COACH_UPCOMING_COMPACT)).toEqual([
      SessionAction.OpenSession,
      SessionAction.Reschedule,
      SessionAction.Move,
      SessionAction.ShareLink,
      SessionAction.ResendInvite,
      SessionAction.DeleteSession,
    ]);
    const move = sessionActionsFor(oneOff, COACH_UPCOMING_COMPACT).find((i) => i.action === SessionAction.Move);
    expect(move?.group).toBe(SessionActionGroup.Schedule);
  });

  it("never offers Move on a past session or to a coachee", () => {
    expect(actions(oneOff, { ...COACH_PAST, isCompact: true })).not.toContain(SessionAction.Move);
    expect(actions(oneOff, { ...COACHEE_UPCOMING, isCompact: true })).not.toContain(SessionAction.Move);
  });

  it("labels it Move…", () => {
    expect(sessionActionLabel(SessionAction.Move, oneOff, COACH_UPCOMING_COMPACT)).toBe("Move…");
  });
});

describe("sessionActionLabel", () => {
  it.each([
    [SessionAction.OpenSession, oneOff, COACH_UPCOMING, "Open session"],
    [SessionAction.Reschedule, oneOff, COACH_UPCOMING, "Reschedule…"],
    [SessionAction.ViewSeries, inSeries, COACH_UPCOMING, "View series"],
    [SessionAction.EditSeries, inSeries, COACH_UPCOMING, "Edit series…"],
    [SessionAction.ShareLink, oneOff, COACH_UPCOMING, "Share link"],
    [SessionAction.ResendInvite, oneOff, COACH_UPCOMING, "Resend invite"],
    [SessionAction.ResendInvite, inSeries, COACH_UPCOMING, "Resend series invite"],
    [SessionAction.DeleteSession, oneOff, COACH_UPCOMING, "Cancel session…"],
    [SessionAction.DeleteSession, oneOff, COACH_PAST, "Remove session…"],
    [SessionAction.DeleteSeries, inSeries, COACH_UPCOMING, "Cancel series…"],
  ])("labels %s", (action, session, context, label) => {
    expect(sessionActionLabel(action, session, context)).toBe(label);
  });

  it("never says Delete", () => {
    const labels = [COACH_UPCOMING, COACH_PAST].flatMap((context) =>
      sessionActionsFor(inSeries, context).map((i) => sessionActionLabel(i.action, inSeries, context))
    );
    expect(labels.join(" ")).not.toMatch(/delete/i);
  });
});

describe("sessionRemovalFor", () => {
  it("cancels an upcoming session and removes a past one", () => {
    expect(sessionRemovalFor(false)).toBe(SessionRemoval.Cancel);
    expect(sessionRemovalFor(true)).toBe(SessionRemoval.Remove);
  });
});
