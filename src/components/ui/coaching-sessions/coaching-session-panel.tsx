"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/lib/utils";
import { toast } from "@/components/ui/use-toast";
import { toast as sonnerToast } from "sonner";
import { CompactGoalCard } from "@/components/ui/coaching-sessions/goal-card-compact";
import { GoalBrowseView } from "@/components/ui/coaching-sessions/goal-browse-view";
import { GoalCreateForm } from "@/components/ui/coaching-sessions/goal-create-form";
import { CoachingSessionPanelDesktop } from "@/components/ui/coaching-sessions/coaching-session-panel-desktop";
import { CoachingSessionPanelMobile } from "@/components/ui/coaching-sessions/coaching-session-panel-mobile";
import {
  GoalFlowStep,
  SlideDirection,
  useGoalFlow,
} from "@/components/ui/coaching-sessions/goal-flow";
import type { GoalFlowState, LinkAttemptResult } from "@/components/ui/coaching-sessions/goal-flow";
import {
  useGoalsBySession,
  useGoalList,
  useGoalMutation,
  GoalApi,
} from "@/lib/api/goals";
import { useAgreementList, useAgreementMutation } from "@/lib/api/agreements";
import {
  useCoachingSessionTopicList,
  useCoachingSessionTopicMutation,
} from "@/lib/api/coaching-session-topics";
import { usePanelActions } from "@/lib/hooks/use-panel-actions";
import { useCoachingSessionList } from "@/lib/api/coaching-sessions";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { getCoachName, getCoacheeName } from "@/lib/utils/relationship";
import { selectPreviousSessionDate } from "@/lib/utils/session";
import type { Goal } from "@/types/goal";
import type { Action } from "@/types/action";
import type { Agreement } from "@/types/agreement";
import type {
  CoachingSessionTopic,
  TopicImmediacy,
  TopicRelevance,
} from "@/types/coaching-session-topic";
import { defaultAgreement } from "@/types/agreement";
import {
  defaultGoal,
  extractActiveGoalLimitError,
  goalTitle,
  isAtGoalLimit,
  isCannotLinkCompletedGoalError,
  isGoalAlreadyLinkedToSessionError,
  maxActiveGoals,
} from "@/types/goal";
import type { Id } from "@/types/general";
import { ItemStatus } from "@/types/general";
import { type Option, Some, None } from "@/types/option";
import type { NoteField, NoteSelection } from "@/types/note-selection";
import { DateTime } from "ts-luxon";
import { PanelSection } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";
import { siteConfig } from "@/site.config";
import type { ActionTab } from "@/components/ui/coaching-sessions/action-section-content";

// ── Shared props for both layouts ──────────────────────────────────────

export interface CoachingSessionPanelSharedProps {
  linkedGoals: Goal[];
  allGoals: Goal[];
  linkedGoalIds: Set<string>;
  atLimit: boolean;
  goalFlow: ReturnType<typeof useGoalFlow>;
  onLink: (goalId: string) => void;
  onUnlink: (goalId: string) => void;
  onCreateAndLink: (title: string, body?: string) => void;
  onCreateAndSwap: (title: string, swapGoalId: string, body?: string) => void;
  onSwapAndLink: (newGoalId: string, swapGoalId: string) => void;
  onUpdateGoal: (goalId: string, title: string, body: string) => Promise<void>;
  /** When true, goal linkage is immutable (past sessions) */
  readOnly?: boolean;
  // Panel section state
  activeSection: PanelSection;
  onSectionChange: (section: PanelSection) => void;
  // Topic data
  topics: CoachingSessionTopic[];
  /** Current user; a topic's delete affordance shows only on their own topics. */
  viewerId: Id;
  onTopicCreate: (body: string) => void;
  onTopicEdit: (id: Id, body: string) => void;
  onTopicDelete: (id: Id) => void;
  onTopicReorder: (orderedIds: Id[]) => void;
  /** True only when the viewer is the coachee; ratings are coachee-only. */
  canRateTopics: boolean;
  onTopicRate: (
    id: Id,
    fields: { relevance?: TopicRelevance; immediacy?: TopicImmediacy }
  ) => void;
  /** Resolves a topic author's user id to a display name for the badge. */
  resolveTopicAuthorName: (userId: Id) => string;
  /** FE-derived previous-session anchor; drives the "new since" dot. */
  previousSessionDate: Option<DateTime>;
  // Agreement data
  agreements: Agreement[];
  onAgreementEdit?: (id: string, body: string) => Promise<void>;
  onAgreementDelete?: (id: string) => void;
  onAgreementCreate?: (body: string) => Promise<void>;
  isAddingAgreement: boolean;
  onAddingAgreementChange: (adding: boolean) => void;
  /** Selected notes text appended into the add-agreement form body. */
  agreementBodyAppend: Option<NoteField>;
  // Action data
  reviewActions: Action[];
  sessionActions: Action[];
  /** Maps coaching_session_id → session date for "view source session" links */
  sessionDateMap: Map<Id, DateTime>;
  /** Undefined while the coaching relationship is still loading from SWR */
  coachId: Id | undefined;
  coachName: string | undefined;
  coacheeId: Id | undefined;
  coacheeName: string | undefined;
  onActionCreate?: (body: string, assigneeIds?: Id[], goalId?: Id, dueBy?: DateTime) => Promise<void>;
  onActionDelete?: (id: Id) => void;
  onStatusChange: (id: Id, newStatus: ItemStatus) => void;
  onDueDateChange: (id: Id, newDueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  onGoalChange?: (id: Id, goalId: Id | undefined) => void;
  onBodyChange: (id: Id, newBody: string, assigneeIds?: Id[], goalId?: Id, dueBy?: DateTime) => Promise<void>;
  isAddingAction: boolean;
  onAddingActionChange: (adding: boolean) => void;
  /** Selected notes text appended into the add-action form body. */
  actionBodyAppend: Option<NoteField>;
  /** Selected notes text to prefill the new-goal title field. */
  goalTitlePrefill: Option<NoteField>;
  locale: string;
  activeActionTab: ActionTab;
  onActiveActionTabChange: (tab: ActionTab) => void;
}

// How a section receives a routed notes selection. Every section supplies the
// same two methods, so the render-time dispatch needs no per-entity branching.
// (Clearing the prefill on close is a stable operation handled separately via
// `clearPrefill` so the change handlers can stay memoized.)
interface NoteSelectionTarget {
  /** Enter this section's add-flow. */
  open(): void;
  /** Route the selected text into this section's prefilled field. */
  prefill(field: Option<NoteField>): void;
}

// ── Shared helpers for desktop and mobile layouts ─────────────────────

export function computePanelCounts(
  linkedGoals: Goal[],
  agreements: Agreement[],
  reviewActions: Action[],
  sessionActions: Action[],
  topics: CoachingSessionTopic[],
): Record<PanelSection, string> {
  const totalActions = reviewActions.length + sessionActions.length;
  return {
    [PanelSection.Topics]: topics.length > 0
      ? `${topics.length}`
      : "",
    [PanelSection.Goals]: linkedGoals.length > 0
      ? `${linkedGoals.length}/${maxActiveGoals()}`
      : "",
    [PanelSection.Agreements]: agreements.length > 0
      ? `${agreements.length}`
      : "",
    [PanelSection.Actions]: totalActions > 0
      ? `${totalActions}`
      : "",
  };
}

export function computeHeaderTitle(
  activeSection: PanelSection,
  goalFlowStep: GoalFlowStep,
): string | undefined {
  if (activeSection !== PanelSection.Goals) return undefined;
  if (goalFlowStep === GoalFlowStep.Idle || goalFlowStep === GoalFlowStep.SelectingSwap) return undefined;
  return goalFlowStep === GoalFlowStep.Browsing ? "Add goal" : "New goal";
}

// ── Slide Panel (animate in on mount via CSS) ────────────────────────

function SlidePanel({
  children,
  direction = SlideDirection.Forward,
}: {
  children: React.ReactNode;
  direction?: SlideDirection;
}) {
  return (
    <div className={cn(
      "animate-in fade-in duration-200 fill-mode-both",
      direction === SlideDirection.Forward
        ? "slide-in-from-right-4"
        : "slide-in-from-left-4"
    )}>
      {children}
    </div>
  );
}

// ── Goal Flow Pages (shared wizard content for both layouts) ─────────

export function GoalFlowPages({
  linkedGoals,
  goalFlow,
  readOnly,
  onUnlink,
  onUpdateGoal,
  titlePrefill = None,
}: {
  linkedGoals: Goal[];
  goalFlow: ReturnType<typeof useGoalFlow>;
  readOnly: boolean;
  onUnlink: (goalId: string) => void;
  onUpdateGoal: (goalId: string, title: string, body: string) => Promise<void>;
  /** Notes selection prefilling the new-goal title (replace-if-empty). */
  titlePrefill?: Option<NoteField>;
}) {
  const { flow } = goalFlow;

  switch (flow.step) {
    case GoalFlowStep.Idle:
      return (
        <div className="space-y-3">
          {linkedGoals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/50 py-6 px-4 text-center">
              <p className="text-sm text-muted-foreground/50 italic">
                No goals added yet
              </p>
            </div>
          ) : (
            linkedGoals.map((goal) => (
              <CompactGoalCard
                key={goal.id}
                goal={goal}
                onRemove={readOnly ? undefined : () => onUnlink(goal.id)}
                onUpdate={readOnly ? undefined : onUpdateGoal}
              />
            ))
          )}
        </div>
      );

    case GoalFlowStep.SelectingSwap: {
      const isLinkRecovery = flow.pendingLinkGoalId !== undefined;
      const prompt = isLinkRecovery
        ? `You already have ${maxActiveGoals()} goals in progress. Pick one to put on hold so this one can replace it.`
        : `You already have ${maxActiveGoals()} goals in progress. Select an existing goal to replace with a new one.`;
      return (
        <SlidePanel direction={goalFlow.direction}>
          <div className="rounded-lg border border-border bg-background p-3 space-y-3">
            <p className="text-[12px] text-muted-foreground">{prompt}</p>
            {goalFlow.swapCandidates.map((goal) => (
              <CompactGoalCard
                key={goal.id}
                goal={goal}
                swapMode={{ onSelect: () => goalFlow.handleSwapSelected(goal.id) }}
              />
            ))}
            <div className="flex items-center justify-end pt-2 border-t border-border/30">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={goalFlow.handleCancel}
              >
                Cancel
              </Button>
            </div>
          </div>
        </SlidePanel>
      );
    }

    case GoalFlowStep.Browsing:
      return (
        <SlidePanel direction={goalFlow.direction}>
          <GoalBrowseView
            availableGoals={goalFlow.availableGoals}
            onGoalClick={goalFlow.handleBrowseGoalClick}
            onCreateNew={goalFlow.handleCreateNewClick}
            onCancel={goalFlow.handleBack}
            hint={flow.swapGoalId
              ? "Choose a replacement goal or create a new one."
              : "Choose an existing goal or create a new one."
            }
          />
        </SlidePanel>
      );

    case GoalFlowStep.Creating:
      return (
        <SlidePanel direction={goalFlow.direction}>
          <GoalCreateForm
            onSubmit={goalFlow.handleFormSubmit}
            onCancel={goalFlow.handleBack}
            submitLabel="Save"
            titlePrefill={titlePrefill}
          />
        </SlidePanel>
      );

    default: {
      const _exhaustive: never = flow;
      throw new Error(`Unhandled flow step: ${(_exhaustive as GoalFlowState).step}`);
    }
  }
}

// ── Coaching Session Panel (main export) ─────────────────────────────

interface CoachingSessionPanelProps {
  coachingSessionId: Id;
  coachingRelationshipId: Id;
  collapsed?: boolean;
  /**
   * Optional — when provided, lets the user expand/collapse the panel
   * independently of layout defaults. Collapsed rail becomes clickable,
   * expanded header renders a matching collapse button.
   */
  onToggleCollapsed?: () => void;
  /** When true, goal linkage is immutable (past sessions) */
  readOnly?: boolean;
  /** Initial panel section (persisted via URL param by the page) */
  defaultSection?: PanelSection;
  /** Called when the user switches sections, so the page can sync to URL */
  onSectionChange?: (section: PanelSection) => void;
  /**
   * Notes "Add as …" selection routed to a section's add-flow; a new nonce
   * opens that section's add-form and prefills the appropriate field.
   */
  noteSelection?: Option<NoteSelection>;
}

export function CoachingSessionPanel({
  coachingSessionId,
  coachingRelationshipId,
  collapsed = false,
  onToggleCollapsed,
  readOnly = false,
  defaultSection = PanelSection.Topics,
  onSectionChange: onSectionChangeExternal,
  noteSelection = None,
}: CoachingSessionPanelProps) {
  // ── Resolve user/relationship context for actions ───────────────
  const userId = useAuthStore((state) => state.userId);
  const { currentCoachingSession } = useCurrentCoachingSession();
  const { currentCoachingRelationship } = useCurrentCoachingRelationship();

  const sessionDate = currentCoachingSession?.date;
  const coachId = currentCoachingRelationship?.coach_id;
  const coachName = currentCoachingRelationship
    ? getCoachName(currentCoachingRelationship)
    : undefined;
  const coacheeId = currentCoachingRelationship?.coachee_id;
  const coacheeName = currentCoachingRelationship
    ? getCoacheeName(currentCoachingRelationship)
    : undefined;

  // ── Topic provenance: author-name resolver + previous-session anchor ──
  // Names come from the resolved relationship; while it loads, ids resolve to
  // "" and the badge degrades to initials-of-empty.
  const resolveTopicAuthorName = useCallback(
    (id: Id): string => {
      if (id === coachId && coachName) return coachName;
      if (id === coacheeId && coacheeName) return coacheeName;
      return "";
    },
    [coachId, coachName, coacheeId, coacheeName]
  );

  // The relationship list endpoint's date filter is BE-ignored, so fetch a wide
  // window (frozen at mount) and select the previous session client-side.
  const sessionsFrom = useMemo(() => DateTime.now().minus({ years: 5 }), []);
  const sessionsTo = useMemo(() => DateTime.now().plus({ years: 1 }), []);
  const { coachingSessions: relationshipSessions } = useCoachingSessionList(
    coachingRelationshipId,
    sessionsFrom,
    sessionsTo,
    "date",
    "asc"
  );

  const previousSessionDate = useMemo<Option<DateTime>>(() => {
    if (!sessionDate) return None;
    const currentDate = DateTime.fromISO(sessionDate, { zone: "utc" });
    return selectPreviousSessionDate(relationshipSessions, currentDate);
  }, [relationshipSessions, sessionDate]);

  // ── Section state ────────────────────────────────────────────────
  const [activeSection, setActiveSection] = useState<PanelSection>(defaultSection);

  const handleSectionChange = useCallback((section: PanelSection) => {
    setActiveSection(section);
    onSectionChangeExternal?.(section);
  }, [onSectionChangeExternal]);

  // ── Goal hooks ───────────────────────────────────────────────────
  const { goals: linkedGoals, refresh: refreshSessionGoals } =
    useGoalsBySession(coachingSessionId);
  const { goals: allGoals, refresh: refreshAllGoals } =
    useGoalList(coachingRelationshipId);
  const { create: createGoal, update: updateGoal } = useGoalMutation();

  const linkedGoalIds = useMemo(() => new Set(linkedGoals.map((g) => g.id)), [linkedGoals]);
  const inProgressGoals = allGoals.filter((g) => g.status === ItemStatus.InProgress);
  const atLimit = isAtGoalLimit(inProgressGoals, linkedGoals);

  // ── Agreement hooks ──────────────────────────────────────────────
  const { agreements, refresh: refreshAgreements } =
    useAgreementList(coachingSessionId);
  const { create: createAgreement, update: updateAgreement, delete: deleteAgreement } =
    useAgreementMutation();

  // ── Topic hooks ──────────────────────────────────────────────────
  const { topics, refresh: refreshTopics } =
    useCoachingSessionTopicList(coachingSessionId);
  const {
    create: createTopic,
    update: updateTopic,
    delete: deleteTopic,
    reorder: reorderTopics,
    rate: rateTopic,
  } = useCoachingSessionTopicMutation(coachingSessionId);

  // ── Goal handlers ────────────────────────────────────────────────

  // Returns a LinkAttemptResult so useGoalFlow can react to a cap-collision
  // 409 by transitioning into 409-recovery without a feedback cycle. All
  // other terminal outcomes (success, already-linked, completed-goal,
  // generic error) are handled inline with toasts/refreshes here.
  const handleLink = useCallback(
    async (goalId: string): Promise<LinkAttemptResult> => {
      // BE auto-promotes NotStarted/OnHold goals to InProgress atomically with
      // the join insert (see goal_session_link_invariant decision). FE must
      // NOT pre-promote — that races with the server's atomic write.
      const result = await GoalApi.linkToSession(coachingSessionId, goalId);
      if (result.isOk()) {
        refreshSessionGoals();
        refreshAllGoals();
        return { kind: "done" };
      }

      const err = result.error;
      const limitInfo = extractActiveGoalLimitError(err);
      if (limitInfo) {
        // Authoritative candidate list comes from details.in_progress_goals —
        // the FE's own atLimit/linkedGoals view may be stale at this point.
        // The hook will transition to SelectingSwap; the panel doesn't toast.
        return { kind: "needs-swap-recovery", candidates: limitInfo.inProgressGoals };
      }
      if (isGoalAlreadyLinkedToSessionError(err)) {
        // Race: another tab/window linked the same goal between when the
        // FE's linkable list was computed and this request. The FE
        // normally filters already-linked goals out of the picker, so
        // this is rare in practice. Refresh state so the goal disappears
        // from any visible list.
        refreshSessionGoals();
        refreshAllGoals();
        const goal = allGoals.find((g) => g.id === goalId);
        const name = goal ? goalTitle(goal) : "This goal";
        toast({
          variant: "destructive",
          title: "Already linked",
          description: `"${name}" is already linked to this session.`,
        });
        return { kind: "done" };
      }
      if (isCannotLinkCompletedGoalError(err)) {
        const goal = allGoals.find((g) => g.id === goalId);
        const name = goal ? goalTitle(goal) : "This goal";
        toast({
          variant: "destructive",
          title: "Goal is completed",
          description: `"${name}" is completed. Reopen it to in-progress before linking it to a session.`,
        });
        return { kind: "done" };
      }
      console.error("Failed to link goal:", err);
      toast({
        variant: "destructive",
        title: "Failed to link goal",
        description: err.message,
      });
      return { kind: "done" };
    },
    [coachingSessionId, allGoals, refreshSessionGoals, refreshAllGoals]
  );

  const handleUnlink = useCallback(
    async (goalId: string) => {
      const goal = allGoals.find((g) => g.id === goalId);
      const previousStatus = goal?.status;

      const result = await GoalApi.unlinkFromSession(
        coachingSessionId,
        goalId
      );
      result.match(
        async () => {
          if (!readOnly && goal && goal.status === ItemStatus.InProgress) {
            try {
              await updateGoal(goalId, { ...goal, status: ItemStatus.OnHold });
            } catch (err) {
              console.error("Failed to put goal on hold after unlink:", err);
            }
          }
          refreshSessionGoals();
          refreshAllGoals();

          const name = goal ? goalTitle(goal) : "Goal";
          sonnerToast(`"${name}" removed from session`, {
            action: {
              label: "Undo",
              onClick: async () => {
                const relinkResult = await GoalApi.linkToSession(coachingSessionId, goalId);
                if (relinkResult.isErr()) {
                  const err = relinkResult.error;
                  const limitInfo = extractActiveGoalLimitError(err);
                  if (limitInfo) {
                    sonnerToast.error("Goal limit reached", {
                      description: `You already have ${limitInfo.maxInProgressGoals} goals in progress. Demote one before restoring this goal.`,
                    });
                  } else if (isGoalAlreadyLinkedToSessionError(err)) {
                    // Concurrent re-link won the race — the goal is back, so
                    // surface a softer message and refresh.
                    sonnerToast("Goal already restored", {
                      description: "Looks like it was added back from another window.",
                    });
                    refreshSessionGoals();
                    refreshAllGoals();
                  } else if (isCannotLinkCompletedGoalError(err)) {
                    sonnerToast.error("Goal is completed", {
                      description: "Reopen this goal to in-progress before linking it again.",
                    });
                  } else {
                    sonnerToast.error("Failed to undo", { description: err.message });
                  }
                  return;
                }
                if (!readOnly && goal && previousStatus === ItemStatus.InProgress) {
                  try {
                    await updateGoal(goalId, { ...goal, status: ItemStatus.InProgress });
                  } catch (err) {
                    console.error("Failed to restore goal status:", err);
                  }
                }
                refreshSessionGoals();
                refreshAllGoals();
              },
            },
          });
        },
        (err) => {
          console.error("Failed to unlink goal:", err);
          toast({
            variant: "destructive",
            title: "Failed to remove goal",
            description: err.message,
          });
        }
      );
    },
    [coachingSessionId, readOnly, allGoals, updateGoal, refreshSessionGoals, refreshAllGoals]
  );

  const handleCreateAndLink = useCallback(
    async (title: string, body?: string) => {
      try {
        const newGoal = defaultGoal();
        newGoal.coaching_relationship_id = coachingRelationshipId;
        newGoal.created_in_session_id = coachingSessionId;
        newGoal.title = title;
        if (body) newGoal.body = body;
        newGoal.status = ItemStatus.InProgress;

        await createGoal(newGoal);
        refreshSessionGoals();
        refreshAllGoals();
      } catch (err) {
        const limitInfo = extractActiveGoalLimitError(err);
        if (limitInfo) {
          toast({
            variant: "destructive",
            title: "Goal limit reached",
            description: `You already have ${limitInfo.maxInProgressGoals} goals in progress. Please complete or change the status of one before starting another.`,
          });
        } else {
          console.error("Failed to create goal:", err);
        }
      }
    },
    [coachingRelationshipId, coachingSessionId, createGoal, refreshSessionGoals, refreshAllGoals]
  );

  const handleCreateAndSwap = useCallback(
    async (title: string, swapGoalId: string, body?: string) => {
      const swapGoal = allGoals.find((g) => g.id === swapGoalId);
      const wasLinked = linkedGoalIds.has(swapGoalId);

      try {
        if (swapGoal) {
          await updateGoal(swapGoalId, { ...swapGoal, status: ItemStatus.OnHold });
        }

        if (wasLinked) {
          const unlinkResult = await GoalApi.unlinkFromSession(coachingSessionId, swapGoalId);
          if (unlinkResult.isErr()) {
            console.error("Failed to unlink goal during swap:", unlinkResult.error);
            toast({
              variant: "destructive",
              title: "Failed to swap goal",
              description: unlinkResult.error.message,
            });
            return;
          }
        }

        const newGoal = defaultGoal();
        newGoal.coaching_relationship_id = coachingRelationshipId;
        newGoal.created_in_session_id = coachingSessionId;
        newGoal.title = title;
        if (body) newGoal.body = body;
        newGoal.status = ItemStatus.InProgress;

        await createGoal(newGoal);
        refreshSessionGoals();
        refreshAllGoals();
      } catch (err) {
        console.error("Failed to create and swap goal:", err);

        if (wasLinked) {
          const relinkResult = await GoalApi.linkToSession(coachingSessionId, swapGoalId);
          if (relinkResult.isOk() && swapGoal) {
            await updateGoal(swapGoalId, { ...swapGoal, status: ItemStatus.InProgress })
              .catch((err) => console.error("Failed to restore goal status during recovery:", err));
          }
          refreshSessionGoals();
          refreshAllGoals();
        }

        toast({
          variant: "destructive",
          title: "Failed to swap goal",
          description: "An error occurred while swapping goals. The original goal has been restored.",
        });
      }
    },
    [allGoals, linkedGoalIds, coachingSessionId, coachingRelationshipId, createGoal, updateGoal, refreshSessionGoals, refreshAllGoals]
  );

  const handleSwapAndLink = useCallback(
    async (newGoalId: string, swapGoalId: string) => {
      const swapGoal = allGoals.find((g) => g.id === swapGoalId);
      const wasLinked = linkedGoalIds.has(swapGoalId);

      try {
        if (swapGoal) {
          await updateGoal(swapGoalId, { ...swapGoal, status: ItemStatus.OnHold });
        }

        if (wasLinked) {
          const unlinkResult = await GoalApi.unlinkFromSession(coachingSessionId, swapGoalId);
          if (unlinkResult.isErr()) {
            console.error("Failed to unlink goal during swap:", unlinkResult.error);

            const relinkResult = await GoalApi.linkToSession(coachingSessionId, swapGoalId);
            if (relinkResult.isOk() && swapGoal) {
              await updateGoal(swapGoalId, { ...swapGoal, status: ItemStatus.InProgress })
              .catch((err) => console.error("Failed to restore goal status during recovery:", err));
            }
            refreshSessionGoals();
            refreshAllGoals();

            toast({
              variant: "destructive",
              title: "Failed to swap goal",
              description: unlinkResult.error.message,
            });
            return;
          }
        }

        const linkResult = await GoalApi.linkToSession(coachingSessionId, newGoalId);
        if (linkResult.isErr()) {
          console.error("Failed to link replacement goal:", linkResult.error);

          if (wasLinked) {
            const relinkResult = await GoalApi.linkToSession(coachingSessionId, swapGoalId);
            if (relinkResult.isOk() && swapGoal) {
              await updateGoal(swapGoalId, { ...swapGoal, status: ItemStatus.InProgress })
              .catch((err) => console.error("Failed to restore goal status during recovery:", err));
            }
            refreshSessionGoals();
            refreshAllGoals();
          }

          toast({
            variant: "destructive",
            title: "Failed to link replacement goal",
            description: linkResult.error.message,
          });
          return;
        }

        refreshSessionGoals();
        refreshAllGoals();
      } catch (err) {
        console.error("Failed to swap and link goal:", err);

        if (wasLinked) {
          const relinkResult = await GoalApi.linkToSession(coachingSessionId, swapGoalId);
          if (relinkResult.isOk() && swapGoal) {
            await updateGoal(swapGoalId, { ...swapGoal, status: ItemStatus.InProgress })
              .catch((err) => console.error("Failed to restore goal status during recovery:", err));
          }
          refreshSessionGoals();
          refreshAllGoals();
        }

        toast({
          variant: "destructive",
          title: "Failed to swap goal",
          description: "An error occurred while swapping goals. The original goal has been restored.",
        });
      }
    },
    [allGoals, linkedGoalIds, coachingSessionId, updateGoal, refreshSessionGoals, refreshAllGoals]
  );

  const handleUpdateGoal = useCallback(
    async (goalId: string, title: string, body: string) => {
      const goal = allGoals.find((g) => g.id === goalId);
      if (!goal) return;
      try {
        await updateGoal(goalId, { ...goal, title, body });
        refreshSessionGoals();
        refreshAllGoals();
      } catch (err) {
        console.error("Failed to update goal:", err);
        toast({
          variant: "destructive",
          title: "Failed to update goal",
          description: "An error occurred while saving changes.",
        });
      }
    },
    [allGoals, updateGoal, refreshSessionGoals, refreshAllGoals]
  );

  const goalFlow = useGoalFlow({
    atLimit,
    allGoals,
    linkedGoalIds,
    onLink: handleLink,
    onSwapAndLink: handleSwapAndLink,
    onCreateAndLink: handleCreateAndLink,
    onCreateAndSwap: handleCreateAndSwap,
    onRefreshGoals: refreshAllGoals,
  });

  // ── Action hooks & state ─────────────────────────────────────────

  const {
    sessionActions,
    reviewActions: panelReviewActions,
    handleCreate: handleActionCreate,
    handleGoalChange,
    handleStatusChange,
    handleDueDateChange,
    handleAssigneesChange,
    handleBodyChange,
    handleDelete: handleActionDelete,
    sessionDateMap,
  } = usePanelActions({
    userId,
    coachingSessionId,
    coachingRelationshipId,
    sessionDate,
  });

  const [isAddingAction, setIsAddingAction] = useState(false);
  const [activeActionTab, setActiveActionTab] = useState<ActionTab>("new");
  const [isAddingAgreement, setIsAddingAgreement] = useState(false);

  // Notes "Add as …" prefill signals. Appending to an empty body fills it, so
  // one signal covers both fresh-open and in-progress add-forms; goals prefill
  // the title (replace-if-empty) since that is their primary field.
  const [actionBodyAppend, setActionBodyAppend] = useState<Option<NoteField>>(None);
  const [agreementBodyAppend, setAgreementBodyAppend] = useState<Option<NoteField>>(None);
  const [goalTitlePrefill, setGoalTitlePrefill] = useState<Option<NoteField>>(None);
  const handledNonce = useRef(0);

  // Render-time dispatch targets: each section opens its add-flow and prefills
  // its field through the same interface, so the dispatch below needs no
  // per-entity switch. Rebuilt each render because `open` reads the live
  // `atLimit`/`goalFlow`; clearing is hoisted to `clearPrefill` (below) instead.
  const noteTargets: Record<PanelSection, NoteSelectionTarget> = {
    // Topics aren't a notes-routing target: the add input is a persistent
    // inline field with no host-owned open/prefill state.
    [PanelSection.Topics]: { open: () => {}, prefill: () => {} },
    [PanelSection.Goals]: {
      // At the goal cap, creation requires a swap first; both routes land on
      // the create form, where the prefilled title is applied on mount.
      open: () => (atLimit ? goalFlow.handleAddGoalClick() : goalFlow.handleCreateNewClick()),
      prefill: setGoalTitlePrefill,
    },
    [PanelSection.Agreements]: {
      open: () => setIsAddingAgreement(true),
      prefill: setAgreementBodyAppend,
    },
    [PanelSection.Actions]: {
      open: () => setIsAddingAction(true),
      prefill: setActionBodyAppend,
    },
  };

  // One uniform clear mechanism, shared by the change handlers and the
  // goal-idle effect. Stable (useState setters never change identity), so the
  // handlers below can stay memoized.
  const clearPrefill = useMemo<Record<PanelSection, () => void>>(
    () => ({
      [PanelSection.Topics]: () => {},
      [PanelSection.Goals]: () => setGoalTitlePrefill(None),
      [PanelSection.Agreements]: () => setAgreementBodyAppend(None),
      [PanelSection.Actions]: () => setActionBodyAppend(None),
    }),
    []
  );

  // Open the target section's add-form on a new selection nonce (render-time
  // own-state adjustment, mirroring action-section-content's requiredTab).
  if (noteSelection.some && noteSelection.val.nonce !== handledNonce.current) {
    handledNonce.current = noteSelection.val.nonce;
    const { section, text, nonce } = noteSelection.val;
    setActiveSection(section);
    noteTargets[section].open();
    noteTargets[section].prefill(Some({ text, nonce }));
  }

  // Clear a section's prefill when its add-flow closes, so a later fresh "Add"
  // starts blank and the still-present selection (same nonce) won't re-prefill.
  const handleAddingActionChange = useCallback(
    (adding: boolean) => {
      setIsAddingAction(adding);
      if (!adding) clearPrefill[PanelSection.Actions]();
    },
    [clearPrefill]
  );
  const handleAddingAgreementChange = useCallback(
    (adding: boolean) => {
      setIsAddingAgreement(adding);
      if (!adding) clearPrefill[PanelSection.Agreements]();
    },
    [clearPrefill]
  );

  // The goal create form unmounts when the flow leaves Creating; drop the
  // title prefill once it returns to Idle so a manual "Add Goal" starts blank.
  useEffect(() => {
    if (goalFlow.flow.step === GoalFlowStep.Idle) clearPrefill[PanelSection.Goals]();
  }, [goalFlow.flow.step, clearPrefill]);

  // ── Agreement state & handlers ──────────────────────────────────

  const handleAgreementCreate = useCallback(async (body: string) => {
    try {
      const newAgreement = defaultAgreement();
      newAgreement.coaching_session_id = coachingSessionId;
      newAgreement.body = body;
      await createAgreement(newAgreement);
      refreshAgreements();
      setIsAddingAgreement(false);
    } catch (err) {
      console.error("Failed to create agreement:", err);
      toast({
        variant: "destructive",
        title: "Failed to create agreement",
        description: "An error occurred while creating the agreement.",
      });
    }
  }, [coachingSessionId, createAgreement, refreshAgreements]);

  const handleAgreementEdit = useCallback(
    async (id: string, body: string) => {
      const agreement = agreements.find((a) => a.id === id);
      if (!agreement) return;
      try {
        await updateAgreement(id, { ...agreement, body });
        refreshAgreements();
      } catch (err) {
        console.error("Failed to update agreement:", err);
        toast({
          variant: "destructive",
          title: "Failed to update agreement",
          description: "An error occurred while saving changes.",
        });
      }
    },
    [agreements, updateAgreement, refreshAgreements]
  );

  const handleAgreementDelete = useCallback(
    async (id: string) => {
      const agreement = agreements.find((a) => a.id === id);
      try {
        await deleteAgreement(id);
        refreshAgreements();

        const preview = agreement?.body
          ? agreement.body.length > 40
            ? `${agreement.body.slice(0, 40)}...`
            : agreement.body
          : "Agreement";
        sonnerToast(`"${preview}" deleted`, {
          action: {
            label: "Undo",
            onClick: async () => {
              if (!agreement) return;
              try {
                await createAgreement(agreement);
                refreshAgreements();
              } catch {
                sonnerToast.error("Failed to undo", {
                  description: "Could not restore the agreement.",
                });
              }
            },
          },
        });
      } catch (err) {
        console.error("Failed to delete agreement:", err);
        toast({
          variant: "destructive",
          title: "Failed to delete agreement",
          description: "An error occurred while deleting the agreement.",
        });
      }
    },
    [agreements, deleteAgreement, createAgreement, refreshAgreements]
  );

  // ── Topic handlers ──────────────────────────────────────────────

  const handleTopicCreate = useCallback(
    async (body: string) => {
      try {
        await createTopic(body);
        refreshTopics();
      } catch (err) {
        console.error("Failed to create topic:", err);
        toast({
          variant: "destructive",
          title: "Failed to add topic",
          description: "An error occurred while adding the topic.",
        });
      }
    },
    [createTopic, refreshTopics]
  );

  const handleTopicEdit = useCallback(
    async (id: Id, body: string) => {
      try {
        await updateTopic(id, { body });
        refreshTopics();
      } catch (err) {
        console.error("Failed to update topic:", err);
        toast({
          variant: "destructive",
          title: "Failed to update topic",
          description: "An error occurred while saving changes.",
        });
      }
    },
    [updateTopic, refreshTopics]
  );

  const handleTopicDelete = useCallback(
    async (id: Id) => {
      const topic = topics.find((t) => t.id === id);
      try {
        await deleteTopic(id);
        refreshTopics();

        const preview = topic?.body
          ? topic.body.length > 40
            ? `${topic.body.slice(0, 40)}...`
            : topic.body
          : "Topic";
        sonnerToast(`"${preview}" deleted`, {
          action: {
            label: "Undo",
            onClick: async () => {
              if (!topic) return;
              try {
                await createTopic(topic.body);
                refreshTopics();
              } catch {
                sonnerToast.error("Failed to undo", {
                  description: "Could not restore the topic.",
                });
              }
            },
          },
        });
      } catch (err) {
        console.error("Failed to delete topic:", err);
        toast({
          variant: "destructive",
          title: "Failed to delete topic",
          description: "An error occurred while deleting the topic.",
        });
      }
    },
    [topics, deleteTopic, createTopic, refreshTopics]
  );

  const handleTopicReorder = useCallback(
    async (orderedIds: Id[]) => {
      try {
        await reorderTopics(orderedIds);
        refreshTopics();
      } catch (err) {
        console.error("Failed to reorder topics:", err);
        toast({
          variant: "destructive",
          title: "Failed to reorder topics",
          description: "An error occurred while saving the new order.",
        });
        refreshTopics();
      }
    },
    [reorderTopics, refreshTopics]
  );

  const handleTopicRate = useCallback(
    async (
      id: Id,
      fields: { relevance?: TopicRelevance; immediacy?: TopicImmediacy }
    ) => {
      try {
        await rateTopic(id, fields);
        refreshTopics();
      } catch (err) {
        console.error("Failed to rate topic:", err);
        toast({
          variant: "destructive",
          title: "Failed to save rating",
          description: "An error occurred while saving the rating.",
        });
      }
    },
    [rateTopic, refreshTopics]
  );

  // ── Shared props ─────────────────────────────────────────────────

  const sharedProps: CoachingSessionPanelSharedProps = {
    linkedGoals,
    allGoals,
    linkedGoalIds,
    atLimit,
    goalFlow,
    onLink: handleLink,
    onUnlink: handleUnlink,
    onCreateAndLink: handleCreateAndLink,
    onCreateAndSwap: handleCreateAndSwap,
    onSwapAndLink: handleSwapAndLink,
    onUpdateGoal: handleUpdateGoal,
    readOnly,
    activeSection,
    onSectionChange: handleSectionChange,
    topics,
    viewerId: userId,
    onTopicCreate: handleTopicCreate,
    onTopicEdit: handleTopicEdit,
    onTopicDelete: handleTopicDelete,
    onTopicReorder: handleTopicReorder,
    canRateTopics: Boolean(userId && coacheeId && userId === coacheeId),
    onTopicRate: handleTopicRate,
    resolveTopicAuthorName,
    previousSessionDate,
    agreements,
    onAgreementEdit: handleAgreementEdit,
    onAgreementDelete: handleAgreementDelete,
    onAgreementCreate: handleAgreementCreate,
    isAddingAgreement,
    onAddingAgreementChange: handleAddingAgreementChange,
    agreementBodyAppend,
    // Action data
    reviewActions: panelReviewActions,
    sessionActions,
    sessionDateMap,
    coachId,
    coachName,
    coacheeId,
    coacheeName,
    onActionCreate: handleActionCreate,
    onActionDelete: handleActionDelete,
    onStatusChange: handleStatusChange,
    onDueDateChange: handleDueDateChange,
    onAssigneesChange: handleAssigneesChange,
    onGoalChange: handleGoalChange,
    onBodyChange: handleBodyChange,
    isAddingAction,
    onAddingActionChange: handleAddingActionChange,
    actionBodyAppend,
    goalTitlePrefill,
    locale: siteConfig.locale,
    activeActionTab,
    onActiveActionTabChange: setActiveActionTab,
  };

  return (
    <>
      <CoachingSessionPanelDesktop
        {...sharedProps}
        collapsed={collapsed}
        onToggleCollapsed={onToggleCollapsed}
      />
      <CoachingSessionPanelMobile {...sharedProps} />
    </>
  );
}
