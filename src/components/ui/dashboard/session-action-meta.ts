import {
  CalendarClock,
  CalendarRange,
  CalendarSync,
  Link2,
  MailPlus,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { SessionAction, SessionActionGroup } from "@/lib/session-actions";

export function sessionActionIcon(action: SessionAction): LucideIcon {
  switch (action) {
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
      return Trash2;
  }
}

export function sessionActionTestId(action: SessionAction): string {
  switch (action) {
    case SessionAction.Reschedule:
      return "session-row-reschedule";
    case SessionAction.ViewSeries:
      return "session-row-view-series";
    case SessionAction.EditSeries:
      return "session-row-edit-series";
    case SessionAction.ShareLink:
      return "session-row-share-link";
    case SessionAction.ResendInvite:
      return "session-row-resend-invite";
    case SessionAction.DeleteSession:
      return "session-row-delete";
    case SessionAction.DeleteSeries:
      return "session-row-delete-series";
  }
}

export function isDestructive(group: SessionActionGroup): boolean {
  switch (group) {
    case SessionActionGroup.Schedule:
    case SessionActionGroup.Share:
      return false;
    case SessionActionGroup.Destructive:
      return true;
  }
}
