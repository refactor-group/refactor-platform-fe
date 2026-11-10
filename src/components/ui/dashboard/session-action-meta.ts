import {
  ArrowUpRight,
  CalendarClock,
  CalendarRange,
  CalendarSync,
  CalendarX2,
  Link2,
  MailPlus,
  type LucideIcon,
} from "lucide-react";
import { SessionAction, SessionActionGroup } from "@/lib/session-actions";

export function sessionActionIcon(action: SessionAction): LucideIcon {
  switch (action) {
    case SessionAction.OpenSession:
      return ArrowUpRight;
    case SessionAction.Reschedule:
      return CalendarClock;
    case SessionAction.ViewSeries:
      return CalendarRange;
    case SessionAction.EditSeries:
      return CalendarSync;
    case SessionAction.ShareLink:
      return Link2;
    case SessionAction.ResendInvite:
      return MailPlus;
    case SessionAction.DeleteSession:
    case SessionAction.DeleteSeries:
      return CalendarX2;
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unhandled action: ${_exhaustive}`);
    }
  }
}

export function sessionActionTestId(action: SessionAction): string {
  return `session-action-${action}`;
}

export function isDestructive(group: SessionActionGroup): boolean {
  switch (group) {
    case SessionActionGroup.Navigate:
    case SessionActionGroup.Schedule:
    case SessionActionGroup.Share:
      return false;
    case SessionActionGroup.Destructive:
      return true;
    default: {
      const _exhaustive: never = group;
      throw new Error(`Unhandled group: ${_exhaustive}`);
    }
  }
}
