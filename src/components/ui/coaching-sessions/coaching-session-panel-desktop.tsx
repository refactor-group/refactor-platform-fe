"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/lib/utils";
import { GoalFlowStep } from "@/components/ui/coaching-sessions/goal-flow";
import { GoalFlowPages } from "@/components/ui/coaching-sessions/coaching-session-panel";
import { CoachingSessionPanelSelector } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";
import { CompactAgreementCard } from "@/components/ui/coaching-sessions/agreement-card-compact";
import { defaultAgreement } from "@/types/agreement";
import { maxActiveGoals } from "@/types/goal";

const newAgreementPlaceholder = defaultAgreement();
import type { CoachingSessionPanelSharedProps } from "@/components/ui/coaching-sessions/coaching-session-panel";

interface CoachingSessionPanelDesktopProps extends CoachingSessionPanelSharedProps {
  collapsed?: boolean;
}

/** Width the panel expands to during add/create/swap flows (px). */
const EXPANDED_WIDTH = 420;

export function CoachingSessionPanelDesktop({
  linkedGoals,
  goalFlow,
  onUnlink,
  onUpdateGoal,
  readOnly = false,
  collapsed = false,
  activeSection,
  onSectionChange,
  agreements,
  onAgreementEdit,
  onAgreementDelete,
  onAgreementCreate,
  isAddingAgreement,
  onAddingAgreementChange,
  locale,
}: CoachingSessionPanelDesktopProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const { flow } = goalFlow;

  // Dismiss the flow when clicking outside the expanded panel.
  useEffect(() => {
    if (flow.step === GoalFlowStep.Idle) return;

    const mq = window.matchMedia("(min-width: 768px)");

    function handlePointerDown(e: PointerEvent) {
      if (!mq.matches) return;
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        goalFlow.handleCancel();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [flow.step, goalFlow]);

  const goalsLabel = linkedGoals.length > 0
    ? `Goals (${linkedGoals.length}/${maxActiveGoals()})`
    : "Goals";
  const agreementsLabel = agreements.length > 0
    ? `Agreements (${agreements.length})`
    : "Agreements";

  if (collapsed) {
    const collapsedLabel = activeSection === "goals" ? "Goals" : "Agreements";
    const collapsedCount = activeSection === "goals"
      ? (linkedGoals.length > 0 ? `${linkedGoals.length}/${maxActiveGoals()}` : undefined)
      : (agreements.length > 0 ? `${agreements.length}` : undefined);

    return (
      <div className="hidden md:flex md:flex-col md:items-center md:gap-2 md:pt-3 md:pb-3 md:px-1 h-full rounded-lg border border-border/50 bg-card">
        <span className="text-[11px] font-medium text-muted-foreground [writing-mode:vertical-lr]">
          {collapsedLabel}
        </span>
        {collapsedCount && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
            {collapsedCount}
          </span>
        )}
      </div>
    );
  }

  const isInGoalFlow = activeSection === "goals" && flow.step !== GoalFlowStep.Idle;

  const headerTitle = activeSection === "agreements"
    ? undefined  // selector handles the title
    : flow.step === GoalFlowStep.Idle || flow.step === GoalFlowStep.SelectingSwap
      ? undefined  // selector handles the title
      : flow.step === GoalFlowStep.Browsing
        ? "Add goal"
        : "New goal";

  return (
    <div ref={panelRef} className="hidden md:block relative">
      <Card
        className={cn(
          "flex flex-col h-full transition-[width,box-shadow] duration-300 ease-in-out",
          isInGoalFlow
            ? "absolute inset-y-0 left-0 z-10 shadow-xl"
            : "relative shadow-sm"
        )}
        style={{ width: isInGoalFlow ? `${EXPANDED_WIDTH}px` : "100%" }}
      >
        <CardHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isInGoalFlow && (
                <button
                  type="button"
                  onClick={goalFlow.handleBack}
                  aria-label="Back"
                  className="rounded-md p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              {headerTitle ? (
                <h3 className="text-sm font-semibold text-foreground">{headerTitle}</h3>
              ) : (
                <CoachingSessionPanelSelector
                  activeSection={activeSection}
                  onSectionChange={onSectionChange}
                  goalsLabel={goalsLabel}
                  agreementsLabel={agreementsLabel}
                />
              )}
            </div>
            {!isInGoalFlow && !readOnly && !isAddingAgreement && (
              <Button
                size="sm"
                className="h-8 gap-1 text-xs"
                onClick={activeSection === "goals" ? goalFlow.handleAddGoalClick : () => onAddingAgreementChange(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3 flex-1 min-h-0 overflow-hidden">
          {activeSection === "goals" ? (
            <GoalFlowPages
              linkedGoals={linkedGoals}
              goalFlow={goalFlow}
              readOnly={readOnly}
              onUnlink={onUnlink}
              onUpdateGoal={onUpdateGoal}
            />
          ) : (
            <div className="space-y-3">
              {isAddingAgreement && onAgreementCreate && (
                <CompactAgreementCard
                  agreement={newAgreementPlaceholder}
                  locale={locale}
                  initialEditing
                  onSave={onAgreementCreate}
                  onDismiss={() => onAddingAgreementChange(false)}
                />
              )}
              {agreements.length === 0 && !isAddingAgreement ? (
                <div className="rounded-lg border border-dashed border-border/50 py-6 px-4 text-center">
                  <p className="text-sm text-muted-foreground/50 italic">
                    No agreements yet
                  </p>
                </div>
              ) : (
                agreements.map((agreement) => (
                  <CompactAgreementCard
                    key={agreement.id}
                    agreement={agreement}
                    locale={locale}
                    onSave={readOnly ? undefined : onAgreementEdit
                      ? (body) => onAgreementEdit(agreement.id, body)
                      : undefined}
                    onDelete={readOnly ? undefined : onAgreementDelete}
                  />
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
