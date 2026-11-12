import type { EnrichedCoachingSession } from "@/types/coaching-session";

export enum SessionAction {
  OpenSession = "open-session",
  Reschedule = "reschedule",
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
  /** Locked (see `sessionLocked`): only Open session and the delete item remain. */
  isLocked: boolean;
  /** Its start has passed: a one-off's invite can't be resent, though the session may still be edited today. */
  hasStarted: boolean;
  /** The other participant left the organization: nothing can be rescheduled or resent. */
  participantLeft: boolean;
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
  /** Shown but unavailable. Defaults to always enabled. */
  enabled?: (context: SessionActionContext) => boolean;
}

const inSeries = (session: EnrichedCoachingSession) => session.coaching_session_series_id.some;

const coachUpcoming = (c: SessionActionContext) => c.isCoach && !c.isLocked;

const coachCanSchedule = (c: SessionActionContext) => coachUpcoming(c) && !c.participantLeft;

const RULES: SessionActionRule[] = [
  { action: SessionAction.OpenSession, group: SessionActionGroup.Navigate, shown: () => true },
  {
    action: SessionAction.Reschedule,
    group: SessionActionGroup.Schedule,
    shown: (_s, c) => coachCanSchedule(c),
  },
  {
    action: SessionAction.ViewSeries,
    group: SessionActionGroup.Schedule,
    shown: (s, c) => inSeries(s) && coachUpcoming(c),
  },
  {
    action: SessionAction.EditSeries,
    group: SessionActionGroup.Schedule,
    shown: (s, c) => inSeries(s) && coachCanSchedule(c),
  },
  {
    action: SessionAction.ShareLink,
    group: SessionActionGroup.Share,
    shown: (_s, c) => coachUpcoming(c),
  },
  {
    action: SessionAction.ResendInvite,
    group: SessionActionGroup.Share,
    // The series resend covers its later sessions; a one-off has none once it starts.
    shown: (s, c) => coachUpcoming(c) && (inSeries(s) || !c.hasStarted),
    // Kept in place, disabled, so the note beside it explains why.
    enabled: (c) => !c.participantLeft,
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
  return RULES.filter((rule) => rule.shown(session, context)).map(({ action, group, enabled }) => ({
    action,
    group,
    enabled: enabled ? enabled(context) : true,
  }));
}

export function sessionRemovalFor(isLocked: boolean): SessionRemoval {
  return isLocked ? SessionRemoval.Remove : SessionRemoval.Cancel;
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
    case SessionAction.ViewSeries:
      return "View series";
    case SessionAction.EditSeries:
      return "Edit series…";
    case SessionAction.ShareLink:
      return "Share link";
    case SessionAction.ResendInvite:
      return inSeries(session) ? "Resend series invite" : "Resend invite";
    case SessionAction.DeleteSession:
      return removalLabel(sessionRemovalFor(context.isLocked));
    case SessionAction.DeleteSeries:
      return "Cancel series…";
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unhandled action: ${_exhaustive}`);
    }
  }
}
