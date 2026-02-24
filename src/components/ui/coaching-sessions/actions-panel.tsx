"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { ItemStatus, Id, EntityApiError, actionStatusToString } from "@/types/general";
import { sortActionArray, type Action } from "@/types/action";
import { SortOrder } from "@/types/sorting";
import { DateTime } from "ts-luxon";
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
import { NewActionCard } from "@/components/ui/coaching-sessions/new-action-card";
import {
  statusColor,
  statusTextColor,
  STATUS_COLUMN_ORDER,
  groupByStatus,
} from "@/components/ui/actions/utils";

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

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
  const fromDate = useMemo(() => DateTime.now().minus(SESSION_LOOKBACK), []);
  const toDate = useMemo(() => DateTime.now().plus(SESSION_LOOKAHEAD), []);

  const { coachingSessions } = useCoachingSessionList(
    coachingRelationshipId,
    fromDate,
    toDate,
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
 * Builds a Map<sessionId, sessionDate> for all sessions in a relationship.
 * Used to display "From: [session date]" on review action cards.
 * SWR deduplicates with the identical call in usePreviousSessionDate.
 */
function useSessionDateMap(coachingRelationshipId: Id): Map<Id, DateTime> {
  const fromDate = useMemo(() => DateTime.now().minus(SESSION_LOOKBACK), []);
  const toDate = useMemo(() => DateTime.now().plus(SESSION_LOOKAHEAD), []);

  const { coachingSessions } = useCoachingSessionList(
    coachingRelationshipId,
    fromDate,
    toDate,
    "date",
    "asc"
  );

  return useMemo(() => {
    const map = new Map<Id, DateTime>();
    for (const s of coachingSessions) {
      map.set(s.id, DateTime.fromISO(s.date));
    }
    return map;
  }, [coachingSessions]);
}

/**
 * Filters all actions down to the review-eligible set, tracking which IDs
 * have been shown so they remain visible ("sticky") even after edits.
 *
 * The sticky set is grow-only: once an action qualifies for review, its ID
 * is permanently added, ensuring it remains visible even if a subsequent
 * field change (e.g. status -> Completed) would otherwise exclude it.
 */
function useReviewActions(
  allActions: Action[],
  coachingSessionId: Id,
  currentSessionDate: DateTime | null,
  previousSessionDate: DateTime | null
): Action[] {
  const stickyIdsRef = useRef<Set<Id>>(new Set());

  return useMemo(() => {
    if (!currentSessionDate) return [];

    const filtered = filterReviewActions(
      allActions,
      coachingSessionId,
      currentSessionDate,
      previousSessionDate,
      stickyIdsRef.current.size > 0 ? stickyIdsRef.current : undefined
    );

    // Grow-only: once an action qualifies for review, it stays visible
    // for the lifetime of this component instance.
    // Guard: only accumulate IDs after previousSessionDate resolves to avoid
    // capturing actions during the loading phase when all actions pass the filter.
    if (previousSessionDate !== null) {
      for (const action of filtered) {
        stickyIdsRef.current.add(action.id);
      }
    }

    return filtered;
  }, [allActions, coachingSessionId, currentSessionDate, previousSessionDate]);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Shared grid layout for both New Actions and Actions for Review card grids */
const ACTION_CARD_GRID = "grid grid-cols-1 sm:grid-cols-2 gap-6 p-6";

enum ActionField {
  Body = "body",
  Status = "status",
  DueBy = "due_by",
  AssigneeIds = "assignee_ids",
}

/** Discriminated union for single-field action updates */
type ActionFieldUpdate =
  | { field: ActionField.Body; value: string }
  | { field: ActionField.Status; value: ItemStatus }
  | { field: ActionField.DueBy; value: DateTime }
  | { field: ActionField.AssigneeIds; value: Id[] };

interface ActionCardSharedProps {
  locale: string;
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
  locale,
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
      <div className={ACTION_CARD_GRID}>
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
              locale={locale}
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
              autoHeight={false}
            />
          )
        )}

        <NewActionCard
          locale={locale}
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

// ---------------------------------------------------------------------------
// Status summary badges (inline in the collapsible header)
// ---------------------------------------------------------------------------

function StatusSummaryBadges({ actions }: { actions: Action[] }) {
  const counts = new Map<ItemStatus, number>();
  for (const a of actions) {
    counts.set(a.status, (counts.get(a.status) ?? 0) + 1);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 ml-1 min-w-0">
      {STATUS_COLUMN_ORDER.map((status) => {
        const count = counts.get(status) ?? 0;
        return (
          <span
            key={status}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums whitespace-nowrap",
              "bg-muted/80",
              count === 0 ? "text-muted-foreground/50" : statusTextColor(status),
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                count === 0 ? "bg-muted-foreground/30" : statusColor(status),
              )}
            />
            {count} {actionStatusToString(status)}
          </span>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status group header
// ---------------------------------------------------------------------------

function StatusGroupHeader({ status, count }: { status: ItemStatus; count: number }) {
  return (
    <div className="flex items-center gap-2 pb-2">
      <span className={cn("h-2.5 w-2.5 rounded-full", statusColor(status))} aria-hidden />
      <h4 className="text-sm font-medium">{actionStatusToString(status)}</h4>
      <span className="text-xs text-muted-foreground tabular-nums rounded-full bg-muted px-2 py-0.5">
        {count}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review actions section (status-grouped vertical list)
// ---------------------------------------------------------------------------

interface ReviewActionsSectionProps extends ActionCardSharedProps {
  actions: Action[];
  sessionDateMap: Map<Id, DateTime>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStatusChange: (id: Id, status: ItemStatus) => void;
  onDueDateChange: (id: Id, dueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  justMovedId: string | null;
}

function ReviewActionsSection({
  actions,
  sessionDateMap,
  locale,
  open,
  onOpenChange,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
  justMovedId,
}: ReviewActionsSectionProps) {
  // Auto-scroll to the card that just moved to a new status group
  useEffect(() => {
    if (!justMovedId) return;
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-action-id="${justMovedId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }, [justMovedId]);

  const grouped = useMemo(
    () => groupByStatus(actions, (a) => a.status),
    [actions]
  );

  return (
    <div className="rounded-xl border border-border bg-card">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 px-4 py-2.5 text-sm font-semibold hover:text-foreground/80 transition-colors">
          <span className="shrink-0">Actions for Review</span>
          <StatusSummaryBadges actions={actions} />
          <ChevronRight
            className={cn(
              "ml-auto h-4 w-4 shrink-0 transition-transform",
              open && "rotate-90"
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t border-border" />
          {actions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="mb-1 text-sm font-semibold">All caught up</h4>
              <p className="text-sm text-muted-foreground max-w-xs">
                No actions were due between the last session and this one.
              </p>
            </div>
          ) : (
            <div className="px-5 pb-5 pt-6 space-y-0">
              {STATUS_COLUMN_ORDER.map((status, idx) => {
                const group = sortActionArray(
                  grouped[status],
                  SortOrder.Desc,
                  "due_by"
                );
                return (
                  <div key={status}>
                    {idx > 0 && <hr className="border-t border-border my-6" />}
                    <StatusGroupHeader status={status} count={group.length} />
                    {group.length === 0 ? (
                      <p className="text-sm text-muted-foreground/60 py-3 pl-5">
                        No actions
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {group.map((action) => (
                          <div
                            key={action.id}
                            data-action-id={action.id}
                            className={cn(
                              "rounded-xl transition-shadow duration-700",
                              action.id === justMovedId &&
                                "animate-slide-in-from-left ring-2 ring-primary/40",
                            )}
                          >
                            <SessionActionCard
                              action={action}
                              locale={locale}
                              coachId={coachId}
                              coachName={coachName}
                              coacheeId={coacheeId}
                              coacheeName={coacheeName}
                              onStatusChange={onStatusChange}
                              onDueDateChange={onDueDateChange}
                              onAssigneesChange={onAssigneesChange}
                              onBodyChange={() => {}}
                              variant="previous"
                              sessionDate={sessionDateMap.get(action.coaching_session_id)}
                              autoHeight
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
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
  locale: string;
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
  reviewActions: boolean;
}

const ActionsPanel = ({
  coachingSessionId,
  coachingRelationshipId,
  sessionDate,
  userId,
  locale,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onActionAdded,
  onActionEdited,
  onActionDeleted,
  isSaving,
  reviewActions,
}: ActionsPanelProps) => {
  const [reviewOpen, setReviewOpen] = useState(reviewActions);
  const reviewRef = useRef<HTMLDivElement>(null);

  // -- justMoved highlight for review action status changes -----------------
  const [justMovedId, setJustMovedId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const highlightCard = useCallback((id: string) => {
    setJustMovedId(id);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => setJustMovedId(null), 1500);
  }, []);

  // Auto-scroll to "Actions for Review" when navigated with review=true.
  // Uses requestAnimationFrame to wait for the collapsible content to render
  // before calculating scroll position.
  useEffect(() => {
    if (reviewActions && reviewRef.current) {
      requestAnimationFrame(() => {
        reviewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [reviewActions]);

  // Parse session date
  const currentSessionDate = sessionDate
    ? DateTime.fromISO(sessionDate)
    : null;

  // Derive the previous session's date from relationship history
  const previousSessionDate = usePreviousSessionDate(
    coachingRelationshipId,
    currentSessionDate
  );

  const sessionDateMap = useSessionDateMap(coachingRelationshipId);

  // Fetch current session actions and all actions across sessions
  const { actions: sessionActions, refresh: refreshSession } =
    useUserActionsList(userId, {
      scope: UserActionsScope.Sessions,
      coaching_session_id: coachingSessionId,
    });

  const { actions: allActions, refresh: refreshAll } = useUserActionsList(
    userId,
    {
      scope: UserActionsScope.Sessions,
      coaching_relationship_id: coachingRelationshipId,
    }
  );

  // Filter review-eligible actions with sticky tracking
  const reviewableActions = useReviewActions(
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
    update: ActionFieldUpdate
  ) => {
    const action = actions.find((a) => a.id === id);
    if (!action) return;

    let body = action.body ?? "";
    let status = action.status;
    let dueBy = action.due_by;
    let assigneeIds = action.assignee_ids;

    switch (update.field) {
      case ActionField.Body:
        body = update.value;
        break;
      case ActionField.Status:
        status = update.value;
        break;
      case ActionField.DueBy:
        dueBy = update.value;
        break;
      case ActionField.AssigneeIds:
        assigneeIds = update.value;
        break;
      default: {
        const _exhaustive: never = update;
        throw new Error(`Unhandled action field: ${(_exhaustive as ActionFieldUpdate).field}`);
      }
    }

    try {
      await handleEditAction(
        id,
        action.coaching_session_id,
        body,
        status,
        dueBy,
        assigneeIds
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
        locale={locale}
        coachId={coachId}
        coachName={coachName}
        coacheeId={coacheeId}
        coacheeName={coacheeName}
        onStatusChange={(id, v) => updateField(sessionActions, id, { field: ActionField.Status, value: v })}
        onDueDateChange={(id, v) => updateField(sessionActions, id, { field: ActionField.DueBy, value: v })}
        onAssigneesChange={(id, v) => updateField(sessionActions, id, { field: ActionField.AssigneeIds, value: v })}
        onBodyChange={(id, v) => updateField(sessionActions, id, { field: ActionField.Body, value: v })}
        onDelete={handleDeleteAction}
        onCreateAction={handleCreateAction}
        isSaving={isSaving}
      />

      <div ref={reviewRef} className="scroll-mt-20">
        <ReviewActionsSection
          actions={reviewableActions}
          sessionDateMap={sessionDateMap}
          locale={locale}
          open={reviewOpen}
          onOpenChange={setReviewOpen}
          coachId={coachId}
          coachName={coachName}
          coacheeId={coacheeId}
          coacheeName={coacheeName}
          onStatusChange={(id, v) => {
            updateField(allActions, id, { field: ActionField.Status, value: v });
            highlightCard(id);
          }}
          onDueDateChange={(id, v) => updateField(allActions, id, { field: ActionField.DueBy, value: v })}
          onAssigneesChange={(id, v) => updateField(allActions, id, { field: ActionField.AssigneeIds, value: v })}
          justMovedId={justMovedId}
        />
      </div>
    </div>
  );
};

export { ActionsPanel };
