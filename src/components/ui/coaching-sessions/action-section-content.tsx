"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CompactActionCard } from "@/components/ui/coaching-sessions/action-card-compact";
import { SuggestedActionCard } from "@/components/ui/coaching-sessions/suggested-action-card";
import { DismissedSuggestions } from "@/components/ui/coaching-sessions/dismissed-suggestions";
import { defaultAction } from "@/types/action";
import type { Action } from "@/types/action";
import type { Goal } from "@/types/goal";
import type { Id } from "@/types/general";
import type { ItemStatus } from "@/types/general";
import { type Option, Some, None } from "@/types/option";
import { RelationshipRole } from "@/types/relationship-role";
import type { ActionEdits, ActionSuggestion } from "@/types/transcript-suggestion";
import { cn } from "@/components/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DateTime } from "ts-luxon";

// ── Action Section Content ───────────────────────────────────────────
//
// Two tabbed sub-sections for the coaching session panel:
//   "Due" — actions from previous sessions that are due for review
//   "New" — actions created in the current session

export type ActionTab = "due" | "new";

const without = (id: Id) => (prev: ReadonlySet<Id>) =>
  new Set([...prev].filter((x) => x !== id));

export interface ActionSectionContentProps {
  reviewActions: Action[];
  sessionActions: Action[];
  /** Pending transcript suggestions, shown in the New tab; never locked. */
  actionSuggestions?: ActionSuggestion[];
  /** Dismissed transcript suggestions, collapsed under the pending ones. */
  dismissedSuggestions?: ActionSuggestion[];
  /** Decides who may act on a suggestion. */
  viewerRole?: RelationshipRole;
  /** Resolves to the created action when the accept succeeded. */
  onSuggestionAccept?: (s: ActionSuggestion, edits: Option<ActionEdits>) => Promise<Option<Action>>;
  /** Resolves true when the suggestion was dismissed. */
  onSuggestionDismiss?: (s: ActionSuggestion) => Promise<boolean>;
  /** Resolves true when the dismissed suggestion was restored. */
  onSuggestionRestore?: (s: ActionSuggestion) => Promise<boolean>;
  /** Shows a suggestion's quoted segment in the transcript. */
  onShowInTranscript?: (segmentId: Id) => void;
  /** Maps coaching_session_id → session date for "view source session" links on review cards */
  sessionDateMap?: Map<Id, DateTime>;
  locale: string;
  coachId: Id;
  coachName: string;
  coacheeId: Id;
  coacheeName: string;
  isAddingAction: boolean;
  onAddingActionChange: (adding: boolean) => void;
  /** Selected notes text appended into the add-action form body. */
  actionBodyAppend?: Option<{ text: string; nonce: number }>;
  onStatusChange: (id: Id, newStatus: ItemStatus) => void;
  onDueDateChange: (id: Id, newDueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  onBodyChange: (id: Id, newBody: string, assigneeIds?: Id[], goalId?: Id, dueBy?: DateTime) => Promise<void>;
  /** Session goals for the goal picker on action cards */
  goals?: Goal[];
  /** Called when user links/unlinks a goal on an action */
  onGoalChange?: (id: Id, goalId: Id | undefined) => void;
  onActionCreate?: (body: string, assigneeIds?: Id[], goalId?: Id, dueBy?: DateTime) => Promise<void>;
  onActionDelete?: (id: Id) => void;
  readOnly?: boolean;
  /** Called when the active tab changes so the parent can react (e.g. disable Add button) */
  onActiveTabChange?: (tab: ActionTab) => void;
}

export function ActionSectionContent({
  reviewActions,
  sessionActions,
  actionSuggestions = [],
  dismissedSuggestions = [],
  viewerRole = RelationshipRole.Coachee,
  onSuggestionAccept,
  onSuggestionDismiss,
  onSuggestionRestore,
  onShowInTranscript,
  sessionDateMap,
  locale,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  isAddingAction,
  onAddingActionChange,
  actionBodyAppend = None,
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
      if (value !== "due" && value !== "new") return;
      setActiveTab(value);
      onActiveTabChange?.(value);
    },
    [onActiveTabChange]
  );

  // ── Highlight & scroll-to for deep-linked or in-page requested actions ─
  const searchParams = useSearchParams();
  const [highlightRequest, setHighlightRequest] = useState<Option<{ id: Id; nonce: number }>>(None);
  const highlightId = highlightRequest.some
    ? highlightRequest.val.id
    : searchParams.get("highlight");
  // The nonce lets a repeat request for the same id ring it again.
  const highlightKey = highlightRequest.some
    ? `${highlightRequest.val.id}#${highlightRequest.val.nonce}`
    : highlightId;
  const [clearedHighlightKey, setClearedHighlightKey] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  // Derive the required tab from highlight param or isAddingAction.
  // Compute this synchronously so we can pass it to setActiveTab outside
  // of an effect (avoids the react-hooks/set-state-in-effect warning).
  const highlightTarget = useMemo(() => {
    if (!highlightId) return null;
    const allActions = [...reviewActions, ...sessionActions];
    return allActions.find((a) => a.id === highlightId) ?? null;
  }, [highlightId, reviewActions, sessionActions]);

  // An in-page request pins the tab only while ringed, so tabs stay switchable after.
  const highlightActive =
    highlightTarget !== null && clearedHighlightKey !== highlightKey;
  const tabTarget =
    !highlightRequest.some || highlightActive ? highlightTarget : null;

  const requiredTab = useMemo((): ActionTab | null => {
    if (tabTarget) {
      return reviewActions.some((a) => a.id === tabTarget.id)
        ? "due"
        : "new";
    }
    if (isAddingAction) return "new";
    return null;
  }, [tabTarget, reviewActions, isAddingAction]);

  // Switch tab when required (highlight deep-link or adding action).
  // setState during render is a React-supported pattern for derived state.
  if (requiredTab !== null && activeTab !== requiredTab) {
    setActiveTab(requiredTab);
  }

  // Notify parent asynchronously to avoid mid-render parent updates
  useEffect(() => {
    if (requiredTab !== null) {
      onActiveTabChange?.(requiredTab);
    }
  }, [requiredTab, onActiveTabChange]);

  // Derive activeHighlight from the highlight target, cleared after animation.
  // When clearedHighlightKey matches the current key, the highlight is off.
  // A new request automatically shows the highlight since keys won't match.
  const activeHighlight = highlightActive ? highlightTarget.id : null;

  // Scroll to highlighted card and clear highlight after animation.
  // Depend on the key so a repeat request for the same action still fires.
  const highlightTargetId = highlightTarget?.id ?? null;
  useEffect(() => {
    if (!highlightTargetId || !highlightKey) return;

    // Scroll to the card after a frame (let tab switch render)
    requestAnimationFrame(() => {
      const el = cardRefs.current.get(highlightTargetId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    // Clear highlight after animation
    const key = highlightKey;
    const timer = setTimeout(() => setClearedHighlightKey(key), 2000);
    return () => clearTimeout(timer);
  }, [highlightTargetId, highlightKey]);

  const requestHighlight = useCallback((id: Id) => {
    setHighlightRequest((prev) => Some({ id, nonce: (prev.some ? prev.val.nonce : 0) + 1 }));
  }, []);

  const showAction = (id: Id) => {
    if ([...reviewActions, ...sessionActions].some((a) => a.id === id)) requestHighlight(id);
  };

  // ── Suggestion exit: animate out, then hide until the refresh drops it ─
  const [exitingIds, setExitingIds] = useState<ReadonlySet<Id>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<Id>>(new Set());
  const [returningIds, setReturningIds] = useState<ReadonlySet<Id>>(new Set());
  const exitTimers = useRef<Map<Id, ReturnType<typeof setTimeout>>>(new Map());

  // A hidden id absent from the list is forgotten, so a restored one renders again.
  const listedIds = new Set(actionSuggestions.map((s) => s.id));
  const keepListed = (ids: ReadonlySet<Id>) => [...ids].every((id) => listedIds.has(id));
  if (!keepListed(hiddenIds)) {
    setHiddenIds(new Set([...hiddenIds].filter((id) => listedIds.has(id))));
  }
  if (!keepListed(exitingIds)) {
    setExitingIds(new Set([...exitingIds].filter((id) => listedIds.has(id))));
  }
  if (!keepListed(returningIds)) {
    setReturningIds(new Set([...returningIds].filter((id) => listedIds.has(id))));
  }

  const clearExitTimer = useCallback((id: Id) => {
    const timer = exitTimers.current.get(id);
    if (timer !== undefined) clearTimeout(timer);
    exitTimers.current.delete(id);
  }, []);

  const hideSuggestion = useCallback(
    (id: Id) => {
      clearExitTimer(id);
      setExitingIds(without(id));
      setHiddenIds((prev) => new Set(prev).add(id));
    },
    [clearExitTimer]
  );

  // jsdom never fires animationend, hence the timer fallback.
  const exitSuggestion = useCallback(
    (id: Id) => {
      setReturningIds(without(id));
      setExitingIds((prev) => new Set(prev).add(id));
      exitTimers.current.set(id, setTimeout(() => hideSuggestion(id), 400));
    },
    [hideSuggestion]
  );

  // Shows the card again at once, before the list refetches.
  const returnSuggestion = useCallback(
    (id: Id) => {
      clearExitTimer(id);
      setExitingIds(without(id));
      setHiddenIds(without(id));
      setReturningIds((prev) => new Set(prev).add(id));
    },
    [clearExitTimer]
  );

  const offerUndo = (suggestion: ActionSuggestion) => {
    if (!onSuggestionRestore) return;
    toast("Suggestion dismissed", {
      duration: 6000,
      action: {
        label: "Undo",
        onClick: async () => {
          if (await onSuggestionRestore(suggestion)) returnSuggestion(suggestion.id);
        },
      },
    });
  };

  useEffect(() => {
    const timers = exitTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  const visibleSuggestions = actionSuggestions.filter((s) => !hiddenIds.has(s.id));

  const reviewHandlers = (suggestion: ActionSuggestion) => ({
    onAccept: onSuggestionAccept
      ? async (edits: Option<ActionEdits>) => {
          const created = await onSuggestionAccept(suggestion, edits);
          if (!created.some) return;
          requestHighlight(created.val.id);
          exitSuggestion(suggestion.id);
        }
      : undefined,
    onDismiss: onSuggestionDismiss
      ? async () => {
          if (!(await onSuggestionDismiss(suggestion))) return;
          exitSuggestion(suggestion.id);
          offerUndo(suggestion);
        }
      : undefined,
  });

  // Lazy-init placeholder so defaultAction() isn't called at module scope.
  // Seed due_by to +7 days so the picker initially shows the same default
  // that the backend create handler falls back to when none is selected.
  const newActionPlaceholder = useMemo(
    () => ({ ...defaultAction(), due_by: Some(DateTime.now().plus({ days: 7 })) }),
    []
  );

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
      <TabsList className="h-8 w-full">
        <TabsTrigger value="due" className="flex-1 gap-1.5 py-1 text-xs" data-testid="action-tab-due">
          Due
          <span className="text-[10px] font-normal text-muted-foreground/60">
            ({reviewActions.length})
          </span>
        </TabsTrigger>
        <TabsTrigger value="new" className="min-w-0 flex-1 gap-1.5 py-1 text-xs" data-testid="action-tab-new">
          New
          <span className="text-[10px] font-normal text-muted-foreground/60">
            ({sessionActions.length})
          </span>
          {visibleSuggestions.length > 0 && (
            <span className="min-w-0 truncate text-[10px] font-normal text-muted-foreground/60">
              · {visibleSuggestions.length} suggested
            </span>
          )}
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
              bodyAppend={actionBodyAppend}
              onDelete={undefined}
              onDismiss={() => onAddingActionChange(false)}
              {...sharedCardProps}
              onBodyChange={async (_id, body, assigneeIds, goalId, dueBy) => {
                await onActionCreate(body, assigneeIds, goalId, dueBy);
                onAddingActionChange(false);
              }}
            />
          </div>
        )}
        {visibleSuggestions.length > 0 && (
          <div data-testid="suggested-actions-group" className="mb-4 flex flex-col gap-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Suggested from transcript
            </div>
            {visibleSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={cn(
                  exitingIds.has(suggestion.id)
                    ? "animate-kanban-card-exit"
                    : returningIds.has(suggestion.id) && "animate-in fade-in"
                )}
                onAnimationEnd={(e) => {
                  if (e.target === e.currentTarget && exitingIds.has(suggestion.id)) {
                    hideSuggestion(suggestion.id);
                  }
                }}
              >
                <SuggestedActionCard
                  suggestion={suggestion}
                  viewerRole={viewerRole}
                  locale={locale}
                  coachId={coachId}
                  coachName={coachName}
                  coacheeId={coacheeId}
                  coacheeName={coacheeName}
                  goals={goals}
                  {...reviewHandlers(suggestion)}
                  onShowAction={showAction}
                  onShowInTranscript={onShowInTranscript}
                />
              </div>
            ))}
          </div>
        )}
        {sessionActions.length === 0 && !isAddingAction && visibleSuggestions.length === 0 ? (
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
        <DismissedSuggestions
          suggestions={dismissedSuggestions}
          viewerRole={viewerRole}
          locale={locale}
          coachId={coachId}
          coachName={coachName}
          coacheeId={coacheeId}
          coacheeName={coacheeName}
          onRestore={onSuggestionRestore}
          onShowInTranscript={onShowInTranscript}
        />
      </TabsContent>
    </Tabs>
  );
}
