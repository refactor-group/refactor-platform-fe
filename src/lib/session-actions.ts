import type { EnrichedCoachingSession } from "@/types/coaching-session";

export enum SessionAction {
  OpenSession = "open-session",
  Reschedule = "reschedule",
  Move = "move",
  ViewSeries = "view-series",
  EditSeries = "edit-series",
  ShareLink = "share-link",
  ResendInvite = "resend-invite",
  DeleteSession = "delete-session",
  DeleteSeries = "delete-series",
}

export enum SessionActionGroup {
  Navigate = "navigate",
  Schedule = "schedule",
  Share = "share",
  Destructive = "destructive",
}

export enum SessionRemoval {
  Cancel = "cancel",
  Remove = "remove",
}

export interface SessionActionContext {
  isCoach: boolean;
  isPast: boolean;
  isCompact: boolean;
}

export interface SessionActionItem {
  action: SessionAction;
  group: SessionActionGroup;
}

interface SessionActionRule {
  action: SessionAction;
  group: SessionActionGroup;
  shown: (session: EnrichedCoachingSession, context: SessionActionContext) => boolean;
}

const inSeries = (session: EnrichedCoachingSession) => session.coaching_session_series_id.some;

const coachUpcoming = (c: SessionActionContext) => c.isCoach && !c.isPast;

const RULES: SessionActionRule[] = [
  { action: SessionAction.OpenSession, group: SessionActionGroup.Navigate, shown: () => true },
  {
    action: SessionAction.Reschedule,
    group: SessionActionGroup.Schedule,
    shown: (_s, c) => coachUpcoming(c),
  },
  {
    action: SessionAction.Move,
    group: SessionActionGroup.Schedule,
    shown: (_s, c) => c.isCompact && coachUpcoming(c),
  },
  {
    action: SessionAction.ViewSeries,
    group: SessionActionGroup.Schedule,
    shown: (s, c) => inSeries(s) && coachUpcoming(c),
  },
  {
    action: SessionAction.EditSeries,
    group: SessionActionGroup.Schedule,
    shown: (s, c) => inSeries(s) && coachUpcoming(c),
  },
  {
    action: SessionAction.ShareLink,
    group: SessionActionGroup.Share,
    shown: (_s, c) => coachUpcoming(c),
  },
  {
    action: SessionAction.ResendInvite,
    group: SessionActionGroup.Share,
    shown: (_s, c) => coachUpcoming(c),
  },
  {
    action: SessionAction.DeleteSession,
    group: SessionActionGroup.Destructive,
    shown: (_s, c) => c.isCoach,
  },
  {
    action: SessionAction.DeleteSeries,
    group: SessionActionGroup.Destructive,
    shown: (s, c) => inSeries(s) && coachUpcoming(c),
  },
];

export function sessionActionsFor(
  session: EnrichedCoachingSession,
  context: SessionActionContext
): SessionActionItem[] {
  return RULES.filter((rule) => rule.shown(session, context)).map(({ action, group }) => ({
    action,
    group,
  }));
}

export function sessionRemovalFor(isPast: boolean): SessionRemoval {
  return isPast ? SessionRemoval.Remove : SessionRemoval.Cancel;
}

function removalLabel(removal: SessionRemoval): string {
  switch (removal) {
    case SessionRemoval.Cancel:
      return "Cancel session…";
    case SessionRemoval.Remove:
      return "Remove session…";
    default: {
      const _exhaustive: never = removal;
      throw new Error(`Unhandled removal: ${_exhaustive}`);
    }
  }
}

export function sessionActionLabel(
  action: SessionAction,
  session: EnrichedCoachingSession,
  context: SessionActionContext
): string {
  switch (action) {
    case SessionAction.OpenSession:
      return "Open session";
    case SessionAction.Reschedule:
      return "Reschedule…";
    case SessionAction.Move:
      return "Move…";
    case SessionAction.ViewSeries:
      return "View series";
    case SessionAction.EditSeries:
      return "Edit series…";
    case SessionAction.ShareLink:
      return "Share link";
    case SessionAction.ResendInvite:
      return inSeries(session) ? "Resend series invite" : "Resend invite";
    case SessionAction.DeleteSession:
      return removalLabel(sessionRemovalFor(context.isPast));
    case SessionAction.DeleteSeries:
      return "Cancel series…";
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unhandled action: ${_exhaustive}`);
    }
  }
}
