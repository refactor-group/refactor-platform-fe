import { DateTime } from "ts-luxon";
import type { Action } from "@/types/action";
import type { CoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { filterReviewActions } from "@/lib/utils/session";

/**
 * Determines which actions are "due for review" at a given session, mirroring
 * the calculation `usePanelActions` performs for the session page's Action
 * panel "Due" tab — but driven from data the dashboard already has in hand.
 *
 * The "previous session" is computed *within the same coaching relationship*
 * (matching the session page semantics), so this works correctly when
 * `sessions` spans multiple relationships (as on the dashboard).
 *
 * `fallbackPriorDate` (optional) is used when no prior session exists in
 * `sessions` for the target's relationship. Without it, `filterReviewActions`
 * would treat "no prior" as "include every earlier-due action" — which can
 * surface long-ago actions for the oldest session in a windowed list. Passing
 * the user's display-window floor (e.g. `now - 7d`) bounds that lookup so
 * nothing older than the user's selected window ever appears.
 *
 * Returns `[]` when the target session is not in the list — never throws.
 */
export function selectReviewActionsForSession(
  allActions: Action[],
  sessions: CoachingSession[],
  sessionId: Id,
  fallbackPriorDate?: DateTime
): Action[] {
  const target = sessions.find((s) => s.id === sessionId);
  if (!target) return [];

  // Restrict to sessions in the same relationship, sorted ascending by date —
  // the "previous session" must be the prior session for the *same* coach &
  // coachee, not just the prior chronological session globally.
  const sameRelationshipSessions = sessions
    .filter((s) => s.coaching_relationship_id === target.coaching_relationship_id)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const targetIdx = sameRelationshipSessions.findIndex((s) => s.id === sessionId);
  const currentSessionDate = DateTime.fromISO(target.date);
  const previousSessionDate =
    targetIdx > 0
      ? DateTime.fromISO(sameRelationshipSessions[targetIdx - 1].date)
      : (fallbackPriorDate ?? null);

  return filterReviewActions(
    allActions,
    sessionId,
    currentSessionDate,
    previousSessionDate
  );
}
