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

/** Find an action by ID across session and relationship action lists. */
function findActionById(
  id: Id,
  sessionActions: Action[],
  allRelationshipActions: Action[]
): Action | undefined {
  return (
    sessionActions.find((a) => a.id === id) ??
    allRelationshipActions.find((a) => a.id === id)
  );
}

/** Show an error toast, distinguishing network errors from other failures. */
function showActionError(message: string, err: unknown) {
  if (err instanceof EntityApiError && err.isNetworkError()) {
    sonnerToast.error(`${message}. Connection to service was lost.`);
  } else {
    sonnerToast.error(`${message}.`);
  }
}

/** Truncate action body for display in toast messages. */
function actionPreview(action: Action | undefined): string {
  if (!action?.body) return "Action";
  return action.body.length > 40
    ? `${action.body.slice(0, 40)}...`
    : action.body;
}

// ── Sub-hooks ─────────────────────────────────────────────────────

/** Wide date range for fetching all sessions in this relationship */
const SESSION_LOOKBACK = { years: 5 };
const SESSION_LOOKAHEAD = { years: 1 };

interface ActionDataParams {
  userId: Id;
  coachingSessionId: Id;
  coachingRelationshipId: Id;
}

/** Fetches session-scoped and relationship-scoped action lists via SWR. */
function useActionData({
  userId,
  coachingSessionId,
  coachingRelationshipId,
}: ActionDataParams) {
  const { actions: sessionActions, refresh: refreshSessionActions } =
    useUserActionsList(userId, {
      scope: UserActionsScope.Sessions,
      coaching_session_id: coachingSessionId,
    });

  const { actions: allRelationshipActions, refresh: refreshAllActions } =
    useUserActionsList(userId, {
      scope: UserActionsScope.Sessions,
      coaching_relationship_id: coachingRelationshipId,
    });

  const refresh = useCallback(() => {
    refreshSessionActions();
    refreshAllActions();
  }, [refreshSessionActions, refreshAllActions]);

  const sortedSessionActions = useMemo(
    () => sortActionArray(sessionActions, SortOrder.Asc, "created_at"),
    [sessionActions]
  );

  return { sessionActions, allRelationshipActions, sortedSessionActions, refresh };
}

interface ReviewWindowParams {
  coachingSessionId: Id;
  coachingRelationshipId: Id;
  /** May be undefined while the session is still loading from SWR */
  sessionDate: string | undefined;
}

/**
 * Derives the review window (previous → current session date),
 * filters relationship actions into the "due for review" list,
 * and builds a session-id → date lookup map.
 */
function useReviewWindow(
  { coachingSessionId, coachingRelationshipId, sessionDate }: ReviewWindowParams,
  allRelationshipActions: Action[]
) {
  const currentSessionDate = useMemo(
    () => sessionDate ? DateTime.fromISO(sessionDate) : null,
    [sessionDate]
  );

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
    if (!currentSessionDate || coachingSessions.length === 0) return null;
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

  const sessionDateMap = useMemo(() => {
    const map = new Map<Id, DateTime>();
    for (const s of coachingSessions) {
      map.set(s.id, DateTime.fromISO(s.date));
    }
    return map;
  }, [coachingSessions]);

  const stickyIdsRef = useRef<Set<Id>>(new Set());

  const reviewActions = useMemo(() => {
    if (!currentSessionDate) return [];

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

  return { reviewActions, sessionDateMap };
}

interface ActionCrudParams {
  userId: Id;
  coachingSessionId: Id;
}

/** Provides create, update-field, and delete-with-undo handlers. */
function useActionCrud(
  { userId, coachingSessionId }: ActionCrudParams,
  sessionActions: Action[],
  allRelationshipActions: Action[],
  refresh: () => void
) {
  const { create, update, delete: deleteAction } = useActionMutation();

  const updateField = useCallback(
    async (id: Id, fields: Partial<Action>, errorMessage: string) => {
      const action = findActionById(id, sessionActions, allRelationshipActions);
      if (!action) return;
      try {
        await update(id, { ...action, ...fields });
        refresh();
      } catch (err) {
        showActionError(errorMessage, err);
      }
    },
    [sessionActions, allRelationshipActions, update, refresh]
  );

  const handleCreate = useCallback(
    async (body: string, assigneeIds?: Id[]) => {
      try {
        const newAction: Action = {
          ...defaultAction(),
          coaching_session_id: coachingSessionId,
          user_id: userId,
          body,
          status: ItemStatus.NotStarted,
          due_by: DateTime.now().plus({ days: 7 }),
          assignee_ids: assigneeIds ?? [],
        };
        await create(newAction);
        refresh();
      } catch (err) {
        showActionError("Failed to create action", err);
      }
    },
    [coachingSessionId, userId, create, refresh]
  );

  const handleStatusChange = useCallback(
    (id: Id, newStatus: ItemStatus) =>
      updateField(id, { status: newStatus }, "Failed to update status"),
    [updateField]
  );

  const handleDueDateChange = useCallback(
    (id: Id, newDueBy: DateTime) =>
      updateField(id, { due_by: newDueBy }, "Failed to update due date"),
    [updateField]
  );

  const handleAssigneesChange = useCallback(
    (id: Id, assigneeIds: Id[]) =>
      updateField(id, { assignee_ids: assigneeIds }, "Failed to update assignees"),
    [updateField]
  );

  const handleBodyChange = useCallback(
    (id: Id, newBody: string) =>
      updateField(id, { body: newBody }, "Failed to update action"),
    [updateField]
  );

  const handleDelete = useCallback(
    async (id: Id) => {
      const action = findActionById(id, sessionActions, allRelationshipActions);

      try {
        await deleteAction(id);
        refresh();
      } catch (err) {
        showActionError("Failed to delete action", err);
        return;
      }

      sonnerToast(`"${actionPreview(action)}" deleted`, {
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
    handleCreate,
    handleStatusChange,
    handleDueDateChange,
    handleAssigneesChange,
    handleBodyChange,
    handleDelete,
  };
}

// ── Main hook ─────────────────────────────────────────────────────

interface UsePanelActionsParams {
  userId: Id;
  coachingSessionId: Id;
  coachingRelationshipId: Id;
  /** May be undefined while the session is still loading from SWR */
  sessionDate: string | undefined;
}

export function usePanelActions(params: UsePanelActionsParams) {
  const { sessionActions, allRelationshipActions, sortedSessionActions, refresh } =
    useActionData(params);

  const { reviewActions, sessionDateMap } =
    useReviewWindow(params, allRelationshipActions);

  const handlers =
    useActionCrud(params, sessionActions, allRelationshipActions, refresh);

  return {
    sessionActions: sortedSessionActions,
    reviewActions,
    sessionDateMap,
    ...handlers,
    refresh,
  };
}
