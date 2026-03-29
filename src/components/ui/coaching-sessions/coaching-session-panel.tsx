"use client";

import { useCallback, useMemo, useState } from "react";
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
import type { GoalFlowState } from "@/components/ui/coaching-sessions/goal-flow";
import {
  useGoalsBySession,
  useGoalList,
  useGoalMutation,
  GoalApi,
} from "@/lib/api/goals";
import { useAgreementList, useAgreementMutation } from "@/lib/api/agreements";
import { usePanelActions } from "@/lib/hooks/use-panel-actions";
import { useCurrentCoachingSession } from "@/lib/hooks/use-current-coaching-session";
import { useCurrentCoachingRelationship } from "@/lib/hooks/use-current-coaching-relationship";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { getCoachName, getCoacheeName } from "@/lib/utils/relationship";
import type { Goal } from "@/types/goal";
import type { Action } from "@/types/action";
import type { Agreement } from "@/types/agreement";
import { defaultAgreement } from "@/types/agreement";
import {
  defaultGoal,
  extractActiveGoalLimitError,
  goalTitle,
  isAtGoalLimit,
  maxActiveGoals,
} from "@/types/goal";
import type { Id } from "@/types/general";
import { ItemStatus } from "@/types/general";
import { DateTime } from "ts-luxon";
import { PanelSection } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";
import { siteConfig } from "@/site.config";

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
  // Agreement data
  agreements: Agreement[];
  onAgreementEdit?: (id: string, body: string) => Promise<void>;
  onAgreementDelete?: (id: string) => void;
  onAgreementCreate?: (body: string) => Promise<void>;
  isAddingAgreement: boolean;
  onAddingAgreementChange: (adding: boolean) => void;
  // Action data
  reviewActions: Action[];
  sessionActions: Action[];
  /** Maps coaching_session_id → session date for "view source session" links */
  sessionDateMap: Map<Id, DateTime>;
  coachId: Id;
  coachName: string;
  coacheeId: Id;
  coacheeName: string;
  onActionCreate?: (body: string) => Promise<void>;
  onActionDelete?: (id: Id) => void;
  onStatusChange: (id: Id, newStatus: ItemStatus) => void;
  onDueDateChange: (id: Id, newDueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  onBodyChange: (id: Id, newBody: string) => Promise<void>;
  isAddingAction: boolean;
  onAddingActionChange: (adding: boolean) => void;
  locale: string;
}

// ── Shared helpers for desktop and mobile layouts ─────────────────────

export function computePanelCounts(
  linkedGoals: Goal[],
  agreements: Agreement[],
  reviewActions: Action[],
  sessionActions: Action[],
): Record<PanelSection, string> {
  const totalActions = reviewActions.length + sessionActions.length;
  return {
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
  if (activeSection === PanelSection.Agreements || activeSection === PanelSection.Actions) return undefined;
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
}: {
  linkedGoals: Goal[];
  goalFlow: ReturnType<typeof useGoalFlow>;
  readOnly: boolean;
  onUnlink: (goalId: string) => void;
  onUpdateGoal: (goalId: string, title: string, body: string) => Promise<void>;
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

    case GoalFlowStep.SelectingSwap:
      return (
        <SlidePanel direction={goalFlow.direction}>
          <div className="rounded-lg border border-border bg-background p-3 space-y-3">
            <p className="text-[12px] text-muted-foreground">
              You already have {maxActiveGoals()} goals in progress. Select an existing goal to replace with a new one.
            </p>
            {linkedGoals.map((goal) => (
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
  /** When true, goal linkage is immutable (past sessions) */
  readOnly?: boolean;
  /** Initial panel section (persisted via URL param by the page) */
  defaultSection?: PanelSection;
  /** Called when the user switches sections, so the page can sync to URL */
  onSectionChange?: (section: PanelSection) => void;
}

export function CoachingSessionPanel({
  coachingSessionId,
  coachingRelationshipId,
  collapsed = false,
  readOnly = false,
  defaultSection = PanelSection.Goals,
  onSectionChange: onSectionChangeExternal,
}: CoachingSessionPanelProps) {
  // ── Resolve user/relationship context for actions ───────────────
  const userId = useAuthStore((state) => state.userId);
  const { currentCoachingSession } = useCurrentCoachingSession();
  const { currentCoachingRelationship } = useCurrentCoachingRelationship();

  const sessionDate = currentCoachingSession?.date ?? "";
  const coachId = currentCoachingRelationship?.coach_id ?? "";
  const coachName = currentCoachingRelationship
    ? getCoachName(currentCoachingRelationship)
    : "";
  const coacheeId = currentCoachingRelationship?.coachee_id ?? "";
  const coacheeName = currentCoachingRelationship
    ? getCoacheeName(currentCoachingRelationship)
    : "";

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

  // ── Goal handlers ────────────────────────────────────────────────

  const handleLink = useCallback(
    async (goalId: string) => {
      const goal = allGoals.find((g) => g.id === goalId);
      if (goal && goal.status === ItemStatus.OnHold) {
        try {
          await updateGoal(goalId, { ...goal, status: ItemStatus.InProgress });
        } catch (err) {
          const limitInfo = extractActiveGoalLimitError(err);
          if (limitInfo) {
            toast({
              variant: "destructive",
              title: "Goal limit reached",
              description: `You already have ${limitInfo.maxActiveGoals} goals in progress. Please complete or change the status of one before starting another.`,
            });
          } else {
            console.error("Failed to activate goal:", err);
          }
          return;
        }
      }

      const result = await GoalApi.linkToSession(coachingSessionId, goalId);
      result.match(
        () => {
          refreshSessionGoals();
          refreshAllGoals();
        },
        (err) => {
          console.error("Failed to link goal:", err);
          toast({
            variant: "destructive",
            title: "Failed to link goal",
            description: err.message,
          });
        }
      );
    },
    [coachingSessionId, allGoals, updateGoal, refreshSessionGoals, refreshAllGoals]
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
                  sonnerToast.error("Failed to undo", {
                    description: relinkResult.error.message,
                  });
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
            description: `You already have ${limitInfo.maxActiveGoals} goals in progress. Please complete or change the status of one before starting another.`,
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
  });

  // ── Action hooks & state ─────────────────────────────────────────

  const {
    sessionActions,
    reviewActions: panelReviewActions,
    handleCreate: handleActionCreate,
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

  // ── Agreement state & handlers ──────────────────────────────────

  const [isAddingAgreement, setIsAddingAgreement] = useState(false);

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
              } catch (err) {
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
    agreements,
    onAgreementEdit: handleAgreementEdit,
    onAgreementDelete: handleAgreementDelete,
    onAgreementCreate: handleAgreementCreate,
    isAddingAgreement,
    onAddingAgreementChange: setIsAddingAgreement,
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
    onBodyChange: handleBodyChange,
    isAddingAction,
    onAddingActionChange: setIsAddingAction,
    locale: siteConfig.locale,
  };

  return (
    <>
      <CoachingSessionPanelDesktop
        {...sharedProps}
        collapsed={collapsed}
      />
      <CoachingSessionPanelMobile {...sharedProps} />
    </>
  );
}
