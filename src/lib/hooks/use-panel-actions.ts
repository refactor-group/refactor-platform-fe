"use client";

import { useMemo, useRef, useCallback } from "react";
import { useUserActionsList } from "@/lib/api/user-actions";
import { useActionMutation } from "@/lib/api/actions";
import { useCoachingSessionList } from "@/lib/api/coaching-sessions";
import { filterReviewActions } from "@/components/ui/coaching-sessions/actions-panel";
import { UserActionsScope } from "@/types/assigned-actions";
import { sortActionArray, defaultAction } from "@/types/action";
import type { Action } from "@/types/action";
import type { Id } from "@/types/general";
import { ItemStatus } from "@/types/general";
import { SortOrder } from "@/types/sorting";
import { DateTime } from "ts-luxon";

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
    },
    [coachingSessionId, userId, create, refresh]
  );

  const handleStatusChange = useCallback(
    async (id: Id, newStatus: ItemStatus) => {
      const action =
        sessionActions.find((a) => a.id === id) ??
        allRelationshipActions.find((a) => a.id === id);
      if (!action) return;
      await update(id, { ...action, status: newStatus });
      refresh();
    },
    [sessionActions, allRelationshipActions, update, refresh]
  );

  const handleDueDateChange = useCallback(
    async (id: Id, newDueBy: DateTime) => {
      const action =
        sessionActions.find((a) => a.id === id) ??
        allRelationshipActions.find((a) => a.id === id);
      if (!action) return;
      await update(id, { ...action, due_by: newDueBy });
      refresh();
    },
    [sessionActions, allRelationshipActions, update, refresh]
  );

  const handleAssigneesChange = useCallback(
    async (id: Id, assigneeIds: Id[]) => {
      const action =
        sessionActions.find((a) => a.id === id) ??
        allRelationshipActions.find((a) => a.id === id);
      if (!action) return;
      await update(id, { ...action, assignee_ids: assigneeIds });
      refresh();
    },
    [sessionActions, allRelationshipActions, update, refresh]
  );

  const handleBodyChange = useCallback(
    async (id: Id, newBody: string) => {
      const action =
        sessionActions.find((a) => a.id === id) ??
        allRelationshipActions.find((a) => a.id === id);
      if (!action) return;
      await update(id, { ...action, body: newBody });
      refresh();
    },
    [sessionActions, allRelationshipActions, update, refresh]
  );

  const handleDelete = useCallback(
    async (id: Id) => {
      await deleteAction(id);
      refresh();
    },
    [deleteAction, refresh]
  );

  return {
    sessionActions: sortedSessionActions,
    reviewActions,
    handleCreate,
    handleStatusChange,
    handleDueDateChange,
    handleAssigneesChange,
    handleBodyChange,
    handleDelete,
    refresh,
  };
}
