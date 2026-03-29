"use client";

import { useMemo, useRef, useCallback } from "react";
import { toast as sonnerToast } from "sonner";
import { useUserActionsList } from "@/lib/api/user-actions";
import { useActionMutation } from "@/lib/api/actions";
import { useCoachingSessionList } from "@/lib/api/coaching-sessions";
import { UserActionsScope } from "@/types/assigned-actions";
import { sortActionArray, defaultAction } from "@/types/action";
import type { Action } from "@/types/action";
import type { Id } from "@/types/general";
import { ItemStatus, EntityApiError } from "@/types/general";
import { SortOrder } from "@/types/sorting";
import { DateTime } from "ts-luxon";

// ── Pure helpers ───────────────────────────────────────────────────

/**
 * Pure filter for determining which actions should appear in "Actions for Review".
 *
 * Pre-condition: `allActions` must already be scoped to the current coaching
 * relationship (e.g. via `coaching_relationship_id` on the API call).
 *
 * Rules:
 * 1. Exclude actions belonging to the current session
 * 2. Include sticky actions (previously visible) regardless of current state
 * 3. Include only actions due within [previousSessionDate, currentSessionDate]
 *    (any status) — actions due before or after the window are excluded
 *
 * Results are sorted reverse-chronologically by due_by.
 */
export function filterReviewActions(
  allActions: Action[],
  currentSessionId: Id,
  currentSessionDate: DateTime,
  previousSessionDate: DateTime | null,
  stickyIds?: Set<Id>
): Action[] {
  const endOfCurrentDate = currentSessionDate.endOf("day");
  const startOfPrevDate = previousSessionDate?.startOf("day") ?? null;

  const filtered = allActions.filter((a) => {
    if (a.coaching_session_id === currentSessionId) return false;

    if (stickyIds?.has(a.id)) return true;

    const dueBy = a.due_by;

    if (dueBy > endOfCurrentDate) return false;

    if (!startOfPrevDate || dueBy >= startOfPrevDate) return true;

    return false;
  });

  return sortActionArray(filtered, SortOrder.Desc, "due_by");
}

// ── Hook: usePanelActions ──────────────────────────────────────────
//
// Encapsulates action data fetching, review filtering, and CRUD for
// the coaching session panel's Actions section. Reuses the same SWR
// hooks and filterReviewActions logic as the old ActionsPanel.

/** Wide date range for fetching all sessions in this relationship */
const SESSION_LOOKBACK = { years: 5 };
const SESSION_LOOKAHEAD = { years: 1 };

interface UsePanelActionsParams {
  userId: Id;
  coachingSessionId: Id;
  coachingRelationshipId: Id;
  sessionDate: string;
}

export function usePanelActions({
  userId,
  coachingSessionId,
  coachingRelationshipId,
  sessionDate,
}: UsePanelActionsParams) {
  const currentSessionDate = useMemo(
    () => DateTime.fromISO(sessionDate),
    [sessionDate]
  );

  // ── Session actions (current session only) ──────────────────────
  const { actions: sessionActions, refresh: refreshSessionActions } =
    useUserActionsList(userId, {
      scope: UserActionsScope.Sessions,
      coaching_session_id: coachingSessionId,
    });

  // ── All relationship actions (for review filtering) ─────────────
  const { actions: allRelationshipActions, refresh: refreshAllActions } =
    useUserActionsList(userId, {
      scope: UserActionsScope.Sessions,
      coaching_relationship_id: coachingRelationshipId,
    });

  // ── Previous session date (for review date window) ──────────────
  // Intentionally frozen at mount time — the 5-year window is wide enough
  // that recalculating on every render would add no value.
  const fromDate = useMemo(() => DateTime.now().minus(SESSION_LOOKBACK), []);
  const toDate = useMemo(() => DateTime.now().plus(SESSION_LOOKAHEAD), []);

  const { coachingSessions } = useCoachingSessionList(
    coachingRelationshipId,
    fromDate,
    toDate,
    "date",
    "asc"
  );

  const previousSessionDate = useMemo(() => {
    if (coachingSessions.length === 0) return null;
    const currentDateStr = currentSessionDate.toISODate();
    if (!currentDateStr) return null;

    let prev: DateTime | null = null;
    for (const session of coachingSessions) {
      if (session.date < currentDateStr) {
        prev = DateTime.fromISO(session.date);
      }
    }
    return prev;
  }, [coachingSessions, currentSessionDate]);

  // ── Session date map (for "view source session" links) ──────────
  const sessionDateMap = useMemo(() => {
    const map = new Map<Id, DateTime>();
    for (const s of coachingSessions) {
      map.set(s.id, DateTime.fromISO(s.date));
    }
    return map;
  }, [coachingSessions]);

  // ── Review actions (filtered + sticky) ──────────────────────────
  const stickyIdsRef = useRef<Set<Id>>(new Set());

  const reviewActions = useMemo(() => {
    const filtered = filterReviewActions(
      allRelationshipActions,
      coachingSessionId,
      currentSessionDate,
      previousSessionDate,
      stickyIdsRef.current.size > 0 ? stickyIdsRef.current : undefined
    );

    if (previousSessionDate !== null) {
      for (const action of filtered) {
        stickyIdsRef.current.add(action.id);
      }
    }

    return filtered;
  }, [
    allRelationshipActions,
    coachingSessionId,
    currentSessionDate,
    previousSessionDate,
  ]);

  // ── Sorted session actions ──────────────────────────────────────
  const sortedSessionActions = useMemo(
    () => sortActionArray(sessionActions, SortOrder.Asc, "created_at"),
    [sessionActions]
  );

  // ── CRUD ────────────────────────────────────────────────────────
  const { create, update, delete: deleteAction } = useActionMutation();

  const refresh = useCallback(() => {
    refreshSessionActions();
    refreshAllActions();
  }, [refreshSessionActions, refreshAllActions]);

  const handleCreate = useCallback(
    async (body: string) => {
      try {
        const newAction: Action = {
          ...defaultAction(),
          coaching_session_id: coachingSessionId,
          user_id: userId,
          body,
          status: ItemStatus.NotStarted,
          due_by: DateTime.now().plus({ days: 7 }),
        };
        await create(newAction);
        refresh();
      } catch (err) {
        if (err instanceof EntityApiError && err.isNetworkError()) {
          sonnerToast.error("Failed to create action. Connection to service was lost.");
        } else {
          sonnerToast.error("Failed to create action.");
        }
      }
    },
    [coachingSessionId, userId, create, refresh]
  );

  const handleStatusChange = useCallback(
    async (id: Id, newStatus: ItemStatus) => {
      const action =
        sessionActions.find((a) => a.id === id) ??
        allRelationshipActions.find((a) => a.id === id);
      if (!action) return;
      try {
        await update(id, { ...action, status: newStatus });
        refresh();
      } catch (err) {
        if (err instanceof EntityApiError && err.isNetworkError()) {
          sonnerToast.error("Failed to update status. Connection to service was lost.");
        } else {
          sonnerToast.error("Failed to update status.");
        }
      }
    },
    [sessionActions, allRelationshipActions, update, refresh]
  );

  const handleDueDateChange = useCallback(
    async (id: Id, newDueBy: DateTime) => {
      const action =
        sessionActions.find((a) => a.id === id) ??
        allRelationshipActions.find((a) => a.id === id);
      if (!action) return;
      try {
        await update(id, { ...action, due_by: newDueBy });
        refresh();
      } catch (err) {
        if (err instanceof EntityApiError && err.isNetworkError()) {
          sonnerToast.error("Failed to update due date. Connection to service was lost.");
        } else {
          sonnerToast.error("Failed to update due date.");
        }
      }
    },
    [sessionActions, allRelationshipActions, update, refresh]
  );

  const handleAssigneesChange = useCallback(
    async (id: Id, assigneeIds: Id[]) => {
      const action =
        sessionActions.find((a) => a.id === id) ??
        allRelationshipActions.find((a) => a.id === id);
      if (!action) return;
      try {
        await update(id, { ...action, assignee_ids: assigneeIds });
        refresh();
      } catch (err) {
        if (err instanceof EntityApiError && err.isNetworkError()) {
          sonnerToast.error("Failed to update assignees. Connection to service was lost.");
        } else {
          sonnerToast.error("Failed to update assignees.");
        }
      }
    },
    [sessionActions, allRelationshipActions, update, refresh]
  );

  const handleBodyChange = useCallback(
    async (id: Id, newBody: string) => {
      const action =
        sessionActions.find((a) => a.id === id) ??
        allRelationshipActions.find((a) => a.id === id);
      if (!action) return;
      try {
        await update(id, { ...action, body: newBody });
        refresh();
      } catch (err) {
        if (err instanceof EntityApiError && err.isNetworkError()) {
          sonnerToast.error("Failed to update action. Connection to service was lost.");
        } else {
          sonnerToast.error("Failed to update action.");
        }
      }
    },
    [sessionActions, allRelationshipActions, update, refresh]
  );

  const handleDelete = useCallback(
    async (id: Id) => {
      const action =
        sessionActions.find((a) => a.id === id) ??
        allRelationshipActions.find((a) => a.id === id);

      try {
        await deleteAction(id);
        refresh();
      } catch (err) {
        if (err instanceof EntityApiError && err.isNetworkError()) {
          sonnerToast.error("Failed to delete action. Connection to service was lost.");
        } else {
          sonnerToast.error("Failed to delete action.");
        }
        return;
      }

      const preview = action?.body
        ? action.body.length > 40
          ? `${action.body.slice(0, 40)}...`
          : action.body
        : "Action";
      sonnerToast(`"${preview}" deleted`, {
        action: {
          label: "Undo",
          onClick: async () => {
            if (!action) return;
            try {
              await create(action);
              refresh();
            } catch {
              sonnerToast.error("Failed to undo", {
                description: "Could not restore the action.",
              });
            }
          },
        },
      });
    },
    [sessionActions, allRelationshipActions, deleteAction, create, refresh]
  );

  return {
    sessionActions: sortedSessionActions,
    reviewActions,
    sessionDateMap,
    handleCreate,
    handleStatusChange,
    handleDueDateChange,
    handleAssigneesChange,
    handleBodyChange,
    handleDelete,
    refresh,
  };
}
