"use client";

import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";
import { ItemStatus, Id, EntityApiError } from "@/types/general";
import { sortActionArray, type Action } from "@/types/action";
import { SortOrder } from "@/types/sorting";
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

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Custom hooks
// ---------------------------------------------------------------------------

/** Wide date range for fetching all sessions in this relationship */
const SESSION_LOOKBACK = { years: 5 };
const SESSION_LOOKAHEAD = { years: 1 };

/**
 * Fetches all sessions for a coaching relationship and finds the date of
 * the session immediately before `currentSessionDate`.
 */
function usePreviousSessionDate(
  coachingRelationshipId: Id,
  currentSessionDate: DateTime | null
): DateTime | null {
  const { coachingSessions } = useCoachingSessionList(
    coachingRelationshipId || null,
    DateTime.now().minus(SESSION_LOOKBACK),
    DateTime.now().plus(SESSION_LOOKAHEAD),
    "date",
    "asc"
  );

  return useMemo(() => {
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
}

/**
 * Filters all actions down to the review-eligible set, tracking which IDs
 * were initially shown so they remain visible ("sticky") even after edits.
 */
function useReviewActions(
  allActions: Action[],
  coachingSessionId: Id,
  currentSessionDate: DateTime | null,
  previousSessionDate: DateTime | null
): Action[] {
  const stickyIdsRef = useRef<Set<Id> | null>(null);

  return useMemo(() => {
    if (!currentSessionDate) return [];

    const filtered = filterReviewActions(
      allActions,
      coachingSessionId,
      currentSessionDate,
      previousSessionDate,
      stickyIdsRef.current ?? undefined
    );

    // Only lock the sticky set once previousSessionDate has resolved,
    // to avoid capturing actions that would be excluded by status-based
    // filtering once the previous session boundary is known.
    if (stickyIdsRef.current === null && filtered.length > 0 && previousSessionDate !== null) {
      stickyIdsRef.current = new Set(filtered.map((a) => a.id));
    }

    return filtered;
  }, [allActions, coachingSessionId, currentSessionDate, previousSessionDate]);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ActionCardSharedProps {
  coachId: Id;
  coachName: string;
  coacheeId: Id;
  coacheeName: string;
}

interface NewActionsSectionProps extends ActionCardSharedProps {
  actions: Action[];
  onStatusChange: (id: Id, status: ItemStatus) => void;
  onDueDateChange: (id: Id, dueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  onBodyChange: (id: Id, body: string) => void;
  onDelete: (id: Id) => void;
  onCreateAction: (
    body: string,
    status: ItemStatus,
    dueBy: DateTime,
    assigneeIds?: Id[]
  ) => Promise<Action>;
  isSaving: boolean;
}

function NewActionsSection({
  actions,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
  onBodyChange,
  onDelete,
  onCreateAction,
  isSaving,
}: NewActionsSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-2.5">
        <h3 className="text-sm font-semibold">New Actions</h3>
      </div>
      <div className="border-t border-border" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
        {actions.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">
            No actions yet for this session.
          </p>
        )}

        {sortActionArray(actions, SortOrder.Asc, "created_at").map(
          (action) => (
            <SessionActionCard
              key={action.id}
              action={action}
              coachId={coachId}
              coachName={coachName}
              coacheeId={coacheeId}
              coacheeName={coacheeName}
              onStatusChange={onStatusChange}
              onDueDateChange={onDueDateChange}
              onAssigneesChange={onAssigneesChange}
              onBodyChange={onBodyChange}
              onDelete={onDelete}
              variant="current"
            />
          )
        )}

        <GhostActionCard
          coachId={coachId}
          coachName={coachName}
          coacheeId={coacheeId}
          coacheeName={coacheeName}
          onCreateAction={onCreateAction}
          disabled={isSaving}
        />
      </div>
    </div>
  );
}

interface ReviewActionsSectionProps extends ActionCardSharedProps {
  actions: Action[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: Id, status: ItemStatus) => void;
  onDueDateChange: (id: Id, dueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
}

function ReviewActionsSection({
  actions,
  open,
  onOpenChange,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
}: ReviewActionsSectionProps) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 px-4 py-2.5 text-sm font-semibold hover:text-foreground/80 transition-colors">
          <span>Actions for Review</span>
          {actions.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {actions.length}
            </Badge>
          )}
          <ChevronRight
            className={cn(
              "h-4 w-4 transition-transform",
              open && "rotate-90"
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6">
            {actions.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                  <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h4 className="mb-1 text-sm font-semibold">All caught up</h4>
                <p className="text-sm text-muted-foreground max-w-xs">
                  No actions were due between the last session and this one.
                </p>
              </div>
            ) : (
              actions.map((action) => (
                <SessionActionCard
                  key={action.id}
                  action={action}
                  coachId={coachId}
                  coachName={coachName}
                  coacheeId={coacheeId}
                  coacheeName={coacheeName}
                  onStatusChange={onStatusChange}
                  onDueDateChange={onDueDateChange}
                  onAssigneesChange={onAssigneesChange}
                  onBodyChange={() => {}}
                  variant="previous"
                />
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ActionsPanelProps {
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
    coachingSessionId: Id,
    body: string,
    status: ItemStatus,
    dueBy: DateTime,
    assigneeIds?: Id[]
  ) => Promise<Action>;
  onActionDeleted: (id: Id) => Promise<Action>;
  isSaving: boolean;
}

const ActionsPanel = ({
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
}: ActionsPanelProps) => {
  const [reviewOpen, setReviewOpen] = useState(false);

  // Parse session date
  const currentSessionDate = sessionDate
    ? DateTime.fromISO(sessionDate)
    : null;

  // Derive the previous session's date from relationship history
  const previousSessionDate = usePreviousSessionDate(
    coachingRelationshipId,
    currentSessionDate
  );

  // Fetch current session actions and all actions across sessions
  const { actions: sessionActions, refresh: refreshSession } =
    useUserActionsList(userId, {
      scope: UserActionsScope.Sessions,
      coaching_session_id: coachingSessionId,
    });

  const { actions: allActions, refresh: refreshAll } = useUserActionsList(
    userId,
    { scope: UserActionsScope.Sessions }
  );

  // Filter review-eligible actions with sticky tracking
  const reviewActions = useReviewActions(
    allActions,
    coachingSessionId,
    currentSessionDate,
    previousSessionDate
  );

  // -- CRUD operations ------------------------------------------------------

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
    coachingSessionId: Id,
    body: string,
    status: ItemStatus,
    dueBy: DateTime,
    assigneeIds?: Id[]
  ): Promise<Action> => {
    const result = await onActionEdited(id, coachingSessionId, body, status, dueBy, assigneeIds);
    refreshSession();
    refreshAll();
    return result;
  };

  const handleDeleteAction = async (id: Id): Promise<void> => {
    try {
      await onActionDeleted(id);
      refreshSession();
      refreshAll();
    } catch (err) {
      if (err instanceof EntityApiError && err.isNetworkError()) {
        toast.error("Failed to delete action. Connection to service was lost.");
      } else {
        toast.error("Failed to delete action.");
      }
    }
  };

  // -- Field-level updater --------------------------------------------------

  /** Applies a partial field update to an action found by ID in `actions`. */
  const updateField = async (
    actions: Action[],
    id: Id,
    updates: Partial<Pick<Action, "body" | "status" | "due_by" | "assignee_ids">>
  ) => {
    const action = actions.find((a) => a.id === id);
    if (!action) return;
    try {
      await handleEditAction(
        id,
        action.coaching_session_id,
        updates.body ?? action.body ?? "",
        updates.status ?? action.status,
        updates.due_by ?? action.due_by,
        updates.assignee_ids ?? action.assignee_ids
      );
    } catch (err) {
      if (err instanceof EntityApiError && err.isNetworkError()) {
        toast.error("Failed to update action. Connection to service was lost.");
      } else {
        toast.error("Failed to update action.");
      }
    }
  };

  // -- Render ---------------------------------------------------------------

  return (
    <div className="flex flex-col gap-6 pt-4 pb-24 -mx-4 px-4 rounded-xl bg-muted/40">
      <NewActionsSection
        actions={sessionActions}
        coachId={coachId}
        coachName={coachName}
        coacheeId={coacheeId}
        coacheeName={coacheeName}
        onStatusChange={(id, status) => updateField(sessionActions, id, { status })}
        onDueDateChange={(id, due_by) => updateField(sessionActions, id, { due_by })}
        onAssigneesChange={(id, assignee_ids) => updateField(sessionActions, id, { assignee_ids })}
        onBodyChange={(id, body) => updateField(sessionActions, id, { body })}
        onDelete={handleDeleteAction}
        onCreateAction={handleCreateAction}
        isSaving={isSaving}
      />

      <ReviewActionsSection
        actions={reviewActions}
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        coachId={coachId}
        coachName={coachName}
        coacheeId={coacheeId}
        coacheeName={coacheeName}
        onStatusChange={(id, status) => updateField(allActions, id, { status })}
        onDueDateChange={(id, due_by) => updateField(allActions, id, { due_by })}
        onAssigneesChange={(id, assignee_ids) => updateField(allActions, id, { assignee_ids })}
      />
    </div>
  );
};

export { ActionsPanel };
