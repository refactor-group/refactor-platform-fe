/**
 * The single home for which actions are due at a session, the previous
 * session, and the overdue rule.
 */

import type { DateTime } from "ts-luxon";
import type { Action } from "@/types/action";
import { sortActionArray } from "@/types/action";
import type { CoachingSession } from "@/types/coaching-session";
import { ItemStatus, type Id } from "@/types/general";
import { type Option, Some, None } from "@/types/option";
import { SortOrder } from "@/types/sorting";
import { sessionStartIn } from "@/lib/session-window";

/** Session-list window shared by the Actions panel and the dashboard, so their SWR keys match. */
export const SESSION_LIST_LOOKBACK = { years: 5 };
export const SESSION_LIST_LOOKAHEAD = { years: 1 };

/** The session before `sessionId` in the same coaching relationship, by start time; same-day sessions count. */
export function previousSessionOf<T extends CoachingSession>(
  sessions: T[],
  sessionId: Id
): Option<T> {
  const target = sessions.find((s) => s.id === sessionId);
  if (!target) return None;

  const sameRelationship = sessions
    .filter((s) => s.coaching_relationship_id === target.coaching_relationship_id)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const idx = sameRelationship.findIndex((s) => s.id === sessionId);
  return idx > 0 ? Some(sameRelationship[idx - 1]) : None;
}

/**
 * Pure filter matching the coaching-session Actions panel's "Due" tab
 * semantics: which actions from a given relationship should surface as
 * "due for review" at a given session.
 *
 * Pre-condition: `allActions` must already be scoped to the session's
 * coaching relationship (e.g. via the `coaching_relationship_id` query param).
 *
 * Rules:
 * 1. Exclude actions that were created in the current session (they belong
 *    to the session's own "New" tab, not the carry-forward review window).
 * 2. Include sticky actions (previously visible in the panel) regardless of
 *    current state. Dashboard callers typically pass no sticky set.
 * 3. Include only actions due within `[previousSessionDate, currentSessionDate]`
 *    — of any status. The panel's Due tab shows Completed actions too so
 *    they're visible for review; the count mirrors that.
 *
 * Results are sorted reverse-chronologically by due_by.
 */
export function filterReviewActions(
  allActions: Action[],
  currentSessionId: Id,
  currentSessionDate: DateTime,
  previousSessionDate: DateTime | null,
  stickyIds?: Set<Id>,
): Action[] {
  const endOfCurrentDate = currentSessionDate.endOf("day");
  const startOfPrevDate = previousSessionDate?.startOf("day") ?? null;

  const filtered = allActions.filter((a) => {
    if (a.coaching_session_id === currentSessionId) return false;
    if (stickyIds?.has(a.id)) return true;

    if (a.due_by.none) return false;
    const dueBy = a.due_by.val;
    if (dueBy > endOfCurrentDate) return false;
    if (!startOfPrevDate || dueBy >= startOfPrevDate) return true;
    return false;
  });

  return sortActionArray(filtered, SortOrder.Desc, "due_by");
}

export interface ActionsDueOptions {
  fallbackPriorDate?: DateTime;
  stickyIds?: Set<Id>;
}

/**
 * The Due tab's set at `sessionId`. `actions` must already be scoped to the
 * target session's relationship; the previous session is found within that
 * relationship, so `sessions` may span several.
 *
 * `fallbackPriorDate` bounds the window when no previous session exists;
 * without it every earlier-due action is included.
 *
 * `stickyIds` keeps actions visible across status changes, as the panel's
 * Due tab does after the user marks one complete.
 *
 * `timezone` is the user's profile zone, whose calendar days bound the window.
 *
 * Returns `[]` when the target session is not in the list.
 */
export function actionsDueAt(
  actions: Action[],
  sessions: CoachingSession[],
  sessionId: Id,
  timezone: string,
  opts: ActionsDueOptions = {}
): Action[] {
  const target = sessions.find((s) => s.id === sessionId);
  if (!target) return [];

  const prev = previousSessionOf(sessions, sessionId);
  const previousSessionDate = prev.some
    ? sessionStartIn(prev.val.date, timezone)
    : (opts.fallbackPriorDate?.setZone(timezone) ?? null);

  return filterReviewActions(
    actions,
    sessionId,
    sessionStartIn(target.date, timezone),
    previousSessionDate,
    opts.stickyIds
  );
}

/** Open (not started or in progress) and due on a day before today in `now`'s zone. Pass `now` in the user's zone. */
export function isOverdue(
  action: Pick<Action, "status" | "due_by">,
  now: DateTime
): boolean {
  if (action.status !== ItemStatus.NotStarted && action.status !== ItemStatus.InProgress) {
    return false;
  }
  if (action.due_by.none) return false;
  return action.due_by.val.setZone(now.zone).startOf("day") < now.startOf("day");
}

export enum ActionsDueKind {
  None = "none",
  Count = "count",
  Overdue = "overdue",
}

export type ActionsDueSummary =
  | { kind: ActionsDueKind.None }
  | { kind: ActionsDueKind.Count; count: number }
  | { kind: ActionsDueKind.Overdue; count: number; overdue: number };

export function summarizeActionsDue(due: Action[], now: DateTime): ActionsDueSummary {
  if (due.length === 0) return { kind: ActionsDueKind.None };
  const overdue = due.filter((a) => isOverdue(a, now)).length;
  return overdue > 0
    ? { kind: ActionsDueKind.Overdue, count: due.length, overdue }
    : { kind: ActionsDueKind.Count, count: due.length };
}
