"use client";

import { useState, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DateTime } from "ts-luxon";
import { toast } from "sonner";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useCurrentOrganization } from "@/lib/hooks/use-current-organization";
import { useCoachingRelationshipList } from "@/lib/api/coaching-relationships";
import { isUserCoachInRelationship, isUserCoacheeInRelationship, sortRelationshipsByParticipantName } from "@/types/coaching-relationship";
import { useActionMutation } from "@/lib/api/actions";
import { useAllActionsWithContext } from "@/lib/hooks/use-all-actions-with-context";
import {
  CoachViewMode,
  StatusVisibility,
  TimeRange,
} from "@/types/assigned-actions";
import type { Id, ItemStatus } from "@/types/general";
import { applyTimeFilter } from "@/components/ui/actions/utils";
import { ActionsPageHeader } from "@/components/ui/actions/actions-page-header";
import { KanbanBoard } from "@/components/ui/actions/kanban-board";
import { EntityApiError } from "@/lib/api/entity-api";
import { Skeleton } from "@/components/ui/skeleton";

// Default filter values — used for initialization and URL cleanup
const DEFAULT_STATUS = StatusVisibility.Open;
const DEFAULT_RANGE = TimeRange.Last30Days;
const DEFAULT_VIEW = CoachViewMode.MyActions;

/** Validates a URL param against an enum's values, returning the fallback if invalid. */
function parseEnum<T extends string>(
  enumObj: Record<string, T>,
  value: string | null,
  fallback: T
): T {
  if (!value) return fallback;
  const valid = new Set(Object.values(enumObj));
  return valid.has(value as T) ? (value as T) : fallback;
}

interface ActionsPageContainerProps {
  locale: string;
}

export function ActionsPageContainer({ locale }: ActionsPageContainerProps) {
  // ---------------------------------------------------------------------------
  // Auth + org context
  // ---------------------------------------------------------------------------

  const { isACoach, userSession } = useAuthStore((state) => ({
    isACoach: state.isACoach,
    userSession: state.userSession,
  }));
  const userId = userSession?.id ?? null;
  const { currentOrganizationId } = useCurrentOrganization();

  // ---------------------------------------------------------------------------
  // URL query param syncing
  // ---------------------------------------------------------------------------

  const searchParams = useSearchParams();
  const router = useRouter();

  const updateQueryParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined) {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      // Omit default values to keep the URL clean
      if (next.get("status") === DEFAULT_STATUS) next.delete("status");
      if (next.get("range") === DEFAULT_RANGE) next.delete("range");
      if (next.get("view") === DEFAULT_VIEW) next.delete("view");

      const qs = next.toString();
      const url = qs
        ? `${window.location.pathname}?${qs}`
        : window.location.pathname;
      router.replace(url, { scroll: false });
    },
    [searchParams, router]
  );

  // ---------------------------------------------------------------------------
  // Filter state (initialized from URL params)
  // ---------------------------------------------------------------------------

  const [viewMode, setViewMode] = useState(() =>
    parseEnum(CoachViewMode, searchParams.get("view"), DEFAULT_VIEW)
  );
  const [statusVisibility, setStatusVisibility] = useState(() =>
    parseEnum(StatusVisibility, searchParams.get("status"), DEFAULT_STATUS)
  );
  const [timeRange, setTimeRange] = useState(() =>
    parseEnum(TimeRange, searchParams.get("range"), DEFAULT_RANGE)
  );
  const [relationshipId, setRelationshipId] = useState<Id | undefined>(
    () => searchParams.get("rel") ?? undefined
  );

  // Wrap setters to also update the URL
  const handleViewModeChange = useCallback(
    (mode: CoachViewMode) => {
      setViewMode(mode);
      updateQueryParams({ view: mode });
    },
    [updateQueryParams]
  );

  const handleStatusVisibilityChange = useCallback(
    (vis: StatusVisibility) => {
      setStatusVisibility(vis);
      updateQueryParams({ status: vis });
    },
    [updateQueryParams]
  );

  const handleTimeRangeChange = useCallback(
    (range: TimeRange) => {
      setTimeRange(range);
      updateQueryParams({ range });
    },
    [updateQueryParams]
  );

  const handleRelationshipChange = useCallback(
    (id: Id | undefined) => {
      setRelationshipId(id);
      updateQueryParams({ rel: id });
    },
    [updateQueryParams]
  );

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const { actionsWithContext, isLoading, isError, refresh } =
    useAllActionsWithContext(viewMode, relationshipId);

  const { relationships } = useCoachingRelationshipList(
    currentOrganizationId
  );

  const relationshipOptions = useMemo(() => {
    if (!relationships || !userId) return [];
    const userRelationships = relationships.filter(
      (r) => r.coach_id === userId || r.coachee_id === userId
    );
    return sortRelationshipsByParticipantName(userRelationships, userId).map(
      (r) => {
        const coachLabel = isUserCoachInRelationship(userId, r)
          ? "You"
          : `${r.coach_first_name} ${r.coach_last_name}`;
        const coacheeLabel = isUserCoacheeInRelationship(userId, r)
          ? "You"
          : `${r.coachee_first_name} ${r.coachee_last_name}`;
        return {
          id: r.id,
          label: `${coachLabel} \u2192 ${coacheeLabel}`,
        };
      }
    );
  }, [relationships, userId]);

  // ---------------------------------------------------------------------------
  // Client-side filters
  // ---------------------------------------------------------------------------

  const filteredActions = useMemo(
    () => applyTimeFilter(actionsWithContext, timeRange),
    [actionsWithContext, timeRange]
  );

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  const { update: updateAction, delete: deleteAction } = useActionMutation();

  const handleStatusChange = useCallback(
    async (id: Id, newStatus: ItemStatus) => {
      const ctx = actionsWithContext.find((a) => a.action.id === id);
      if (!ctx) return;

      try {
        await updateAction(id, {
          ...ctx.action,
          status: newStatus,
          status_changed_at: DateTime.now(),
        });
        refresh();
      } catch (err) {
        if (err instanceof EntityApiError && err.isNetworkError()) {
          toast.error("Failed to update status. Connection to service was lost.");
        } else {
          toast.error("Failed to update status.");
        }
        throw err; // Re-throw so the board can roll back optimistic updates
      }
    },
    [actionsWithContext, updateAction, refresh]
  );

  const handleDueDateChange = useCallback(
    async (id: Id, newDueBy: DateTime) => {
      const ctx = actionsWithContext.find((a) => a.action.id === id);
      if (!ctx) return;

      try {
        await updateAction(id, { ...ctx.action, due_by: newDueBy });
        refresh();
      } catch (err) {
        if (err instanceof EntityApiError && err.isNetworkError()) {
          toast.error("Failed to update due date. Connection to service was lost.");
        } else {
          toast.error("Failed to update due date.");
        }
      }
    },
    [actionsWithContext, updateAction, refresh]
  );

  const handleAssigneesChange = useCallback(
    async (id: Id, assigneeIds: Id[]) => {
      const ctx = actionsWithContext.find((a) => a.action.id === id);
      if (!ctx) return;

      try {
        await updateAction(id, { ...ctx.action, assignee_ids: assigneeIds });
        refresh();
      } catch (err) {
        if (err instanceof EntityApiError && err.isNetworkError()) {
          toast.error("Failed to update assignees. Connection to service was lost.");
        } else {
          toast.error("Failed to update assignees.");
        }
      }
    },
    [actionsWithContext, updateAction, refresh]
  );

  const handleBodyChange = useCallback(
    async (id: Id, newBody: string) => {
      const ctx = actionsWithContext.find((a) => a.action.id === id);
      if (!ctx) return;

      try {
        await updateAction(id, { ...ctx.action, body: newBody });
        refresh();
      } catch (err) {
        if (err instanceof EntityApiError && err.isNetworkError()) {
          toast.error("Failed to update action. Connection to service was lost.");
        } else {
          toast.error("Failed to update action.");
        }
      }
    },
    [actionsWithContext, updateAction, refresh]
  );

  const handleDelete = useCallback(
    async (id: Id) => {
      try {
        await deleteAction(id);
        refresh();
      } catch (err) {
        if (err instanceof EntityApiError && err.isNetworkError()) {
          toast.error("Failed to delete action. Connection to service was lost.");
        } else {
          toast.error("Failed to delete action.");
        }
      }
    },
    [deleteAction, refresh]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p>Failed to load actions. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ActionsPageHeader
        isCoach={isACoach}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        statusVisibility={statusVisibility}
        onStatusVisibilityChange={handleStatusVisibilityChange}
        timeRange={timeRange}
        onTimeRangeChange={handleTimeRangeChange}
        relationshipId={relationshipId}
        onRelationshipChange={handleRelationshipChange}
        relationships={relationshipOptions}
      />

      {isLoading ? (
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex-1 min-w-[320px] space-y-3">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-56 w-full rounded-xl" />
              <Skeleton className="h-56 w-full rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <KanbanBoard
          actions={filteredActions}
          visibility={statusVisibility}
          locale={locale}
          onStatusChange={handleStatusChange}
          onDueDateChange={handleDueDateChange}
          onAssigneesChange={handleAssigneesChange}
          onBodyChange={handleBodyChange}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
