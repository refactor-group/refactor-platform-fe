"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { CompactActionCard } from "@/components/ui/coaching-sessions/action-card-compact";
import { defaultAction } from "@/types/action";
import type { Action } from "@/types/action";
import type { Goal } from "@/types/goal";
import type { Id } from "@/types/general";
import type { ItemStatus } from "@/types/general";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/components/lib/utils";
import { DateTime } from "ts-luxon";

// ── Action Section Content ───────────────────────────────────────────
//
// Two tabbed sub-sections for the coaching session panel:
//   "Due" — actions from previous sessions that are due for review
//   "New" — actions created in the current session

export type ActionTab = "due" | "new";

export interface ActionSectionContentProps {
  reviewActions: Action[];
  sessionActions: Action[];
  /** Maps coaching_session_id → session date for "view source session" links on review cards */
  sessionDateMap?: Map<Id, DateTime>;
  locale: string;
  coachId: Id;
  coachName: string;
  coacheeId: Id;
  coacheeName: string;
  isAddingAction: boolean;
  onAddingActionChange: (adding: boolean) => void;
  onStatusChange: (id: Id, newStatus: ItemStatus) => void;
  onDueDateChange: (id: Id, newDueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  onBodyChange: (id: Id, newBody: string, assigneeIds?: Id[]) => Promise<void>;
  /** Session goals for the goal picker on action cards */
  goals?: Goal[];
  /** Called when user links/unlinks a goal on an action */
  onGoalChange?: (id: Id, goalId: Id | undefined) => void;
  onActionCreate?: (body: string, assigneeIds?: Id[], goalId?: Id) => Promise<void>;
  onActionDelete?: (id: Id) => void;
  readOnly?: boolean;
  /** Called when the active tab changes so the parent can react (e.g. disable Add button) */
  onActiveTabChange?: (tab: ActionTab) => void;
}

export function ActionSectionContent({
  reviewActions,
  sessionActions,
  sessionDateMap,
  locale,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  isAddingAction,
  onAddingActionChange,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
  onBodyChange,
  goals,
  onGoalChange,
  onActionCreate,
  onActionDelete,
  readOnly = false,
  onActiveTabChange,
}: ActionSectionContentProps) {
  const [activeTab, setActiveTab] = useState<ActionTab>("new");

  const handleTabChange = useCallback(
    (value: string) => {
      const tab = value as ActionTab;
      setActiveTab(tab);
      onActiveTabChange?.(tab);
    },
    [onActiveTabChange]
  );

  // ── Highlight & scroll-to for deep-linked actions ────────────────
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  // When a highlight param is present and actions have loaded, switch to
  // the correct tab and scroll to the target card.
  useEffect(() => {
    if (!highlightId) return;

    const allActions = [...reviewActions, ...sessionActions];
    const target = allActions.find((a) => a.id === highlightId);
    if (!target) return;

    // Switch to the tab containing the target
    const isInReview = reviewActions.some((a) => a.id === highlightId);
    if (isInReview) {
      handleTabChange("due");
    } else {
      handleTabChange("new");
    }

    setActiveHighlight(highlightId);

    // Scroll to the card after a frame (let tab switch render)
    requestAnimationFrame(() => {
      const el = cardRefs.current.get(highlightId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    // Clear highlight after animation
    const timer = setTimeout(() => setActiveHighlight(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightId, reviewActions, sessionActions, handleTabChange]);

  // Scroll into view when adding a new action — switch to New tab first
  useEffect(() => {
    if (isAddingAction) {
      handleTabChange("new");
    }
  }, [isAddingAction, handleTabChange]);

  // Lazy-init placeholder so defaultAction() isn't called at module scope
  const newActionPlaceholder = useMemo(() => defaultAction(), []);

  const sharedCardProps = {
    locale,
    coachId,
    coachName,
    coacheeId,
    coacheeName,
    onStatusChange,
    onDueDateChange,
    onAssigneesChange,
    onBodyChange,
    goals,
    onGoalChange,
  };

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange} className="flex flex-col">
      <TabsList className="w-full">
        <TabsTrigger value="due" className="flex-1 gap-1.5" data-testid="action-tab-due">
          Due
          <span className="text-[11px] font-normal text-muted-foreground/60">
            ({reviewActions.length})
          </span>
        </TabsTrigger>
        <TabsTrigger value="new" className="flex-1 gap-1.5" data-testid="action-tab-new">
          New
          <span className="text-[11px] font-normal text-muted-foreground/60">
            ({sessionActions.length})
          </span>
        </TabsTrigger>
      </TabsList>

      {/* ── Due for Review ─────────────────────────────────────── */}
      <TabsContent value="due" data-testid="review-section-content">
        {reviewActions.length === 0 ? (
          <p className="text-sm text-muted-foreground/50 italic px-1 py-2">
            No actions due for review
          </p>
        ) : (
          <div className="space-y-3">
            {reviewActions.map((action) => {
              const sourceSessionDate = sessionDateMap?.get(action.coaching_session_id);
              return (
                <div key={action.id} ref={(el) => setCardRef(action.id, el)}>
                  <CompactActionCard
                    action={action}
                    variant="review"
                    sourceSessionId={action.coaching_session_id}
                    sourceSessionDate={sourceSessionDate}
                    highlighted={activeHighlight === action.id}
                    onDelete={readOnly ? undefined : onActionDelete}
                    {...sharedCardProps}
                  />
                </div>
              );
            })}
          </div>
        )}
      </TabsContent>

      {/* ── New This Session ───────────────────────────────────── */}
      <TabsContent value="new" data-testid="session-section-content">
        {isAddingAction && onActionCreate && (
          <div>
            <CompactActionCard
              action={newActionPlaceholder}
              initialEditing
              onDelete={undefined}
              onDismiss={() => onAddingActionChange(false)}
              {...sharedCardProps}
              onBodyChange={async (_id, body, assigneeIds, goalId) => {
                await onActionCreate(body, assigneeIds, goalId);
                onAddingActionChange(false);
              }}
            />
          </div>
        )}
        {sessionActions.length === 0 && !isAddingAction ? (
          <div className="rounded-lg border border-dashed border-border/50 py-6 px-4 text-center">
            <p className="text-sm text-muted-foreground/50 italic">
              No actions yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessionActions.map((action) => (
              <div key={action.id} ref={(el) => setCardRef(action.id, el)}>
                <CompactActionCard
                  action={action}
                  variant="current"
                  highlighted={activeHighlight === action.id}
                  onDelete={readOnly ? undefined : onActionDelete}
                  {...sharedCardProps}
                />
              </div>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
