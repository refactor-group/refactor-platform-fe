"use client";

import { useState, useMemo, useRef } from "react";
import { ItemStatus, Id } from "@/types/general";
import type { Action } from "@/types/action";
import { DateTime } from "ts-luxon";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { CheckCircle, ChevronRight } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { useUserActionsList } from "@/lib/api/user-actions";
import { useCoachingSessionList } from "@/lib/api/coaching-sessions";
import { UserActionsScope } from "@/types/assigned-actions";
import { SessionActionCard } from "@/components/ui/coaching-sessions/session-action-card";
import { GhostActionCard } from "@/components/ui/coaching-sessions/ghost-action-card";

/**
 * Pure filter for determining which actions should appear in "Actions for Review".
 *
 * Rules:
 * 1. Exclude actions belonging to the current session
 * 2. Include sticky actions (previously visible) regardless of current state
 * 3. Exclude actions due after the current session date
 * 4. Include actions due within [previousSessionDate, currentSessionDate] (any status)
 * 5. Include actions due before the window only if still outstanding (NotStarted/InProgress)
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

  return allActions
    .filter((a) => {
      if (a.coaching_session_id === currentSessionId) return false;

      if (stickyIds?.has(a.id)) return true;

      const dueBy = a.due_by;

      if (dueBy > endOfCurrentDate) return false;

      if (!startOfPrevDate || dueBy >= startOfPrevDate) return true;

      return (
        a.status === ItemStatus.NotStarted ||
        a.status === ItemStatus.InProgress
      );
    })
    .sort((a, b) => b.due_by.toMillis() - a.due_by.toMillis());
}

interface ActionsListProps {
  coachingSessionId: Id;
  coachingRelationshipId: Id;
  /** ISO date string for the current session (e.g. "2026-02-11") */
  sessionDate: string;
  userId: Id;
  locale: string | "us";
  coachId: Id;
  coachName: string;
  coacheeId: Id;
  coacheeName: string;
  onActionAdded: (
    body: string,
    status: ItemStatus,
    dueBy: DateTime,
    assigneeIds?: Id[]
  ) => Promise<Action>;
  onActionEdited: (
    id: Id,
    body: string,
    status: ItemStatus,
    dueBy: DateTime,
    assigneeIds?: Id[]
  ) => Promise<Action>;
  onActionDeleted: (id: Id) => Promise<Action>;
  isSaving: boolean;
}

/** Wide date range for fetching all sessions in this relationship */
const SESSION_LOOKBACK = { years: 5 };
const SESSION_LOOKAHEAD = { years: 1 };

const ActionsList = ({
  coachingSessionId,
  coachingRelationshipId,
  sessionDate,
  userId,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onActionAdded,
  onActionEdited,
  onActionDeleted,
  isSaving,
}: ActionsListProps) => {
  const [reviewOpen, setReviewOpen] = useState(false);

  const currentSessionDate = sessionDate
    ? DateTime.fromISO(sessionDate)
    : null;

  // Fetch sessions for this relationship to find the previous session
  const { coachingSessions } = useCoachingSessionList(
    coachingRelationshipId || null,
    DateTime.now().minus(SESSION_LOOKBACK),
    DateTime.now().plus(SESSION_LOOKAHEAD),
    "date",
    "asc"
  );

  // Determine the previous session's date
  const previousSessionDate = useMemo(() => {
    if (!currentSessionDate || coachingSessions.length === 0) return null;

    // Sessions are sorted ascending by date. Find the one immediately before this one.
    const currentDateStr = currentSessionDate.toISODate();
    let prev: DateTime | null = null;
    for (const session of coachingSessions) {
      const sessionDt = DateTime.fromISO(session.date);
      if (session.date < currentDateStr!) {
        prev = sessionDt;
      }
    }
    return prev;
  }, [coachingSessions, currentSessionDate]);

  // Current session's actions
  const { actions: sessionActions, refresh: refreshSession } =
    useUserActionsList(userId, {
      scope: UserActionsScope.Sessions,
      coaching_session_id: coachingSessionId,
    });

  // All actions across sessions (for filtering to review window)
  const { actions: allActions, refresh: refreshAll } = useUserActionsList(
    userId,
    {
      scope: UserActionsScope.Sessions,
    }
  );

  // Track which action IDs were initially shown in review so they remain
  // visible even if the user edits a due date outside the window.
  const stickyReviewIdsRef = useRef<Set<Id> | null>(null);

  const reviewActions = useMemo(() => {
    if (!currentSessionDate) return [];

    const filtered = filterReviewActions(
      allActions,
      coachingSessionId,
      currentSessionDate,
      previousSessionDate,
      stickyReviewIdsRef.current ?? undefined
    );

    // Capture initial set of visible IDs on first computation
    if (stickyReviewIdsRef.current === null && filtered.length > 0) {
      stickyReviewIdsRef.current = new Set(filtered.map((a) => a.id));
    }

    return filtered;
  }, [allActions, coachingSessionId, currentSessionDate, previousSessionDate]);

  const reviewCount = reviewActions.length;

  // CRUD wrappers that refresh both lists after mutation

  const handleCreateAction = async (
    body: string,
    status: ItemStatus,
    dueBy: DateTime,
    assigneeIds?: Id[]
  ): Promise<Action> => {
    const result = await onActionAdded(body, status, dueBy, assigneeIds);
    refreshSession();
    refreshAll();
    return result;
  };

  const handleEditAction = async (
    id: Id,
    body: string,
    status: ItemStatus,
    dueBy: DateTime,
    assigneeIds?: Id[]
  ): Promise<Action> => {
    const result = await onActionEdited(id, body, status, dueBy, assigneeIds);
    refreshSession();
    refreshAll();
    return result;
  };

  const handleDeleteAction = async (id: Id): Promise<void> => {
    await onActionDeleted(id);
    refreshSession();
    refreshAll();
  };

  // Helpers for individual field changes on session actions
  const handleStatusChange = (id: Id, newStatus: ItemStatus) => {
    const action = sessionActions.find((a) => a.id === id);
    if (!action) return;
    handleEditAction(
      id,
      action.body ?? "",
      newStatus,
      action.due_by,
      action.assignee_ids
    );
  };

  const handleDueDateChange = (id: Id, newDueBy: DateTime) => {
    const action = sessionActions.find((a) => a.id === id);
    if (!action) return;
    handleEditAction(
      id,
      action.body ?? "",
      action.status,
      newDueBy,
      action.assignee_ids
    );
  };

  const handleAssigneesChange = (id: Id, assigneeIds: Id[]) => {
    const action = sessionActions.find((a) => a.id === id);
    if (!action) return;
    handleEditAction(
      id,
      action.body ?? "",
      action.status,
      action.due_by,
      assigneeIds
    );
  };

  const handleBodyChange = (id: Id, newBody: string) => {
    const action = sessionActions.find((a) => a.id === id);
    if (!action) return;
    handleEditAction(
      id,
      newBody,
      action.status,
      action.due_by,
      action.assignee_ids
    );
  };

  // Helpers for field changes on review actions (search allActions)
  const handleReviewStatusChange = (id: Id, newStatus: ItemStatus) => {
    const action = allActions.find((a) => a.id === id);
    if (!action) return;
    handleEditAction(
      id,
      action.body ?? "",
      newStatus,
      action.due_by,
      action.assignee_ids
    );
  };

  const handleReviewDueDateChange = (id: Id, newDueBy: DateTime) => {
    const action = allActions.find((a) => a.id === id);
    if (!action) return;
    handleEditAction(
      id,
      action.body ?? "",
      action.status,
      newDueBy,
      action.assignee_ids
    );
  };

  const handleReviewAssigneesChange = (id: Id, assigneeIds: Id[]) => {
    const action = allActions.find((a) => a.id === id);
    if (!action) return;
    handleEditAction(
      id,
      action.body ?? "",
      action.status,
      action.due_by,
      assigneeIds
    );
  };

  // Review action body is read-only, so no handleReviewBodyChange needed

  return (
    <div className="flex flex-col gap-6 pt-4 pb-24">
      {/* Section 1: New Actions */}
      <div className="rounded-xl border border-border bg-card">
        <div className="px-6 py-4">
          <h3 className="text-sm font-semibold">New Actions</h3>
        </div>
        <div className="border-t border-border" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
          {sessionActions.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              No actions yet for this session.
            </p>
          )}

          {sessionActions.map((action) => (
            <SessionActionCard
              key={action.id}
              action={action}
              coachId={coachId}
              coachName={coachName}
              coacheeId={coacheeId}
              coacheeName={coacheeName}
              onStatusChange={handleStatusChange}
              onDueDateChange={handleDueDateChange}
              onAssigneesChange={handleAssigneesChange}
              onBodyChange={handleBodyChange}
              onDelete={handleDeleteAction}
              variant="current"
            />
          ))}

          <GhostActionCard
            coachId={coachId}
            coachName={coachName}
            coacheeId={coacheeId}
            coacheeName={coacheeName}
            onCreateAction={handleCreateAction}
            disabled={isSaving}
          />
        </div>
      </div>

      {/* Section 2: Actions for Review (collapsible) */}
      <div className="rounded-xl border border-border bg-card">
        <Collapsible open={reviewOpen} onOpenChange={setReviewOpen}>
          <CollapsibleTrigger className="flex w-full items-center gap-2 px-6 py-4 text-sm font-semibold hover:text-foreground/80 transition-colors">
            <span>Actions for Review</span>
            {reviewCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {reviewCount}
              </Badge>
            )}
            <ChevronRight
              className={cn(
                "h-4 w-4 transition-transform",
                reviewOpen && "rotate-90"
              )}
            />
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="border-t border-border" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
              {reviewActions.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-8 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h4 className="mb-1 text-sm font-semibold">
                    All caught up
                  </h4>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    No actions were due between the last session and this one.
                  </p>
                </div>
              ) : (
                reviewActions.map((action) => (
                  <SessionActionCard
                    key={action.id}
                    action={action}
                    coachId={coachId}
                    coachName={coachName}
                    coacheeId={coacheeId}
                    coacheeName={coacheeName}
                    onStatusChange={handleReviewStatusChange}
                    onDueDateChange={handleReviewDueDateChange}
                    onAssigneesChange={handleReviewAssigneesChange}
                    onBodyChange={() => {}}
                    variant="previous"
                  />
                ))
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
};

export { ActionsList };
