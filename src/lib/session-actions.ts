import type { DateTime } from "ts-luxon";
import { None, Some, type Option } from "@/types/option";
import type { EnrichedCoachingSession } from "@/types/coaching-session";

export enum SessionAction {
  Reschedule = "reschedule",
  ViewSeries = "view-series",
  EditSeries = "edit-series",
  ShareLink = "share-link",
  ResendInvite = "resend-invite",
  DeleteSession = "delete-session",
  DeleteSeries = "delete-series",
}

export enum SessionActionGroup {
  Schedule = "schedule",
  Share = "share",
  Destructive = "destructive",
}

export interface SessionActionContext {
  isCoach: boolean;
  isPast: boolean;
  now: DateTime;
}

export interface SessionActionItem {
  action: SessionAction;
  group: SessionActionGroup;
  enabled: boolean;
}

interface SessionActionRule {
  action: SessionAction;
  group: SessionActionGroup;
  shown: (session: EnrichedCoachingSession, context: SessionActionContext) => boolean;
}

const inSeries = (session: EnrichedCoachingSession) => session.coaching_session_series_id.some;

const RULES: SessionActionRule[] = [
  {
    action: SessionAction.Reschedule,
    group: SessionActionGroup.Schedule,
    shown: (_s, c) => c.isCoach && !c.isPast,
  },
  { action: SessionAction.ViewSeries, group: SessionActionGroup.Schedule, shown: inSeries },
  {
    action: SessionAction.EditSeries,
    group: SessionActionGroup.Schedule,
    shown: (s, c) => inSeries(s) && c.isCoach,
  },
  { action: SessionAction.ShareLink, group: SessionActionGroup.Share, shown: () => true },
  { action: SessionAction.ResendInvite, group: SessionActionGroup.Share, shown: (_s, c) => c.isCoach },
  {
    action: SessionAction.DeleteSession,
    group: SessionActionGroup.Destructive,
    shown: (_s, c) => c.isCoach,
  },
  {
    action: SessionAction.DeleteSeries,
    group: SessionActionGroup.Destructive,
    shown: (s, c) => inSeries(s) && c.isCoach,
  },
];

// An unknown series (not requested, or absent) stays enabled; the backend decides.
function hasUpcomingSession(session: EnrichedCoachingSession, context: SessionActionContext): boolean {
  if (!inSeries(session)) return !context.isPast;
  const series = session.series;
  if (series === undefined || series.none) return true;
  return series.val.last_session_date > context.now;
}

function isEnabled(
  action: SessionAction,
  session: EnrichedCoachingSession,
  context: SessionActionContext
): boolean {
  return action !== SessionAction.ResendInvite || hasUpcomingSession(session, context);
}

export function sessionActionsFor(
  session: EnrichedCoachingSession,
  context: SessionActionContext
): SessionActionItem[] {
  return RULES.filter((rule) => rule.shown(session, context)).map(({ action, group }) => ({
    action,
    group,
    enabled: isEnabled(action, session, context),
  }));
}

export function sessionActionLabel(action: SessionAction, session: EnrichedCoachingSession): string {
  switch (action) {
    case SessionAction.Reschedule:
      return "Reschedule";
    case SessionAction.ViewSeries:
      return "View series";
    case SessionAction.EditSeries:
      return "Edit series";
    case SessionAction.ShareLink:
      return "Share link";
    case SessionAction.ResendInvite:
      return inSeries(session) ? "Resend series invite" : "Resend invite";
    case SessionAction.DeleteSession:
      return "Delete session";
    case SessionAction.DeleteSeries:
      return "Delete series";
  }
}

export function sessionActionHint(item: SessionActionItem): Option<string> {
  return item.action === SessionAction.ResendInvite && !item.enabled
    ? Some("No upcoming sessions")
    : None;
}
