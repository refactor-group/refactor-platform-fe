"use client";

import { useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CountPill } from "@/components/ui/count-pill";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { GoalFlowStep } from "@/components/ui/coaching-sessions/goal-flow";
import { GoalFlowPages, computePanelCounts, computeHeaderTitle } from "@/components/ui/coaching-sessions/coaching-session-panel";
import { CoachingSessionPanelSelector, PanelSection } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";
import { AgreementSectionContent } from "@/components/ui/coaching-sessions/agreement-section-content";
import { ActionSectionContent } from "@/components/ui/coaching-sessions/action-section-content";
import type { CoachingSessionPanelSharedProps } from "@/components/ui/coaching-sessions/coaching-session-panel";

export function CoachingSessionPanelMobile({
  linkedGoals,
  goalFlow,
  onUnlink,
  onUpdateGoal,
  readOnly = false,
  activeSection,
  onSectionChange,
  agreements,
  onAgreementEdit,
  onAgreementDelete,
  onAgreementCreate,
  isAddingAgreement,
  onAddingAgreementChange,
  // Action props
  reviewActions,
  sessionActions,
  sessionDateMap,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onActionCreate,
  onActionDelete,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
  onGoalChange,
  onBodyChange,
  isAddingAction,
  onAddingActionChange,
  activeActionTab,
  onActiveActionTabChange,
  locale,
}: CoachingSessionPanelSharedProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Wrap onUnlink to close the sheet so the undo toast is accessible
  const handleUnlink = (goalId: string) => {
    setIsOpen(false);
    onUnlink(goalId);
  };

  const { flow } = goalFlow;
  const isInGoalFlow = activeSection === PanelSection.Goals && flow.step !== GoalFlowStep.Idle;
  const headerTitle = computeHeaderTitle(activeSection, flow.step);
  const counts = computePanelCounts(linkedGoals, agreements, reviewActions, sessionActions);

  // Reset flow when sheet closes
  const handleOpenChange = (open: boolean) => {
    if (!open && flow.step !== GoalFlowStep.Idle) {
      goalFlow.handleCancel();
    }
    setIsOpen(open);
  };

  // Trigger button label
  const sectionLabels: Record<PanelSection, string> = {
    [PanelSection.Goals]: "Goals",
    [PanelSection.Agreements]: "Agreements",
    [PanelSection.Actions]: "Actions",
  };
  const triggerLabel = sectionLabels[activeSection];
  const triggerCount = counts[activeSection] || undefined;

  return (
    <div className="md:hidden">
      {/* Trigger button */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setIsOpen(true)}
      >
        {triggerLabel}
        {triggerCount && (
          <CountPill count={triggerCount} />
        )}
      </Button>

      {/* Sheet overlay */}
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] flex flex-col rounded-t-xl p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{triggerLabel}</SheetTitle>
            <SheetDescription>Manage {triggerLabel.toLowerCase()} for this coaching session.</SheetDescription>
          </SheetHeader>

          {/* Panel header — outside scroll container so section headers don't overlap */}
          <div className="shrink-0 bg-background border-b border-border/50 px-4 py-3 rounded-t-xl">
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
                    counts={counts}
                  />
                )}
              </div>
              {!isInGoalFlow && !readOnly && (
                <Button
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  disabled={
                    (isAddingAgreement && activeSection === PanelSection.Agreements) ||
                    (isAddingAction && activeSection === PanelSection.Actions) ||
                    (activeSection === PanelSection.Actions && activeActionTab === "due")
                  }
                  onClick={
                    activeSection === PanelSection.Goals
                      ? goalFlow.handleAddGoalClick
                      : activeSection === PanelSection.Actions
                        ? () => onAddingActionChange(true)
                        : () => onAddingAgreementChange(true)
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              )}
            </div>
          </div>

          {/* Panel content — own scroll container for sticky section headers */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
            {activeSection === PanelSection.Goals ? (
              <GoalFlowPages
                linkedGoals={linkedGoals}
                goalFlow={goalFlow}
                readOnly={readOnly}
                onUnlink={handleUnlink}
                onUpdateGoal={onUpdateGoal}
              />
            ) : activeSection === PanelSection.Agreements ? (
              <AgreementSectionContent
                agreements={agreements}
                locale={locale}
                isAddingAgreement={isAddingAgreement}
                onAddingAgreementChange={onAddingAgreementChange}
                onAgreementCreate={onAgreementCreate}
                onAgreementEdit={onAgreementEdit}
                onAgreementDelete={onAgreementDelete}
                readOnly={readOnly}
              />
            ) : coachId && coachName && coacheeId && coacheeName ? (
              <ActionSectionContent
                reviewActions={reviewActions}
                sessionActions={sessionActions}
                sessionDateMap={sessionDateMap}
                locale={locale}
                coachId={coachId}
                coachName={coachName}
                coacheeId={coacheeId}
                coacheeName={coacheeName}
                isAddingAction={isAddingAction}
                onAddingActionChange={onAddingActionChange}
                onStatusChange={onStatusChange}
                onDueDateChange={onDueDateChange}
                onAssigneesChange={onAssigneesChange}
                onGoalChange={onGoalChange}
                onBodyChange={onBodyChange}
                goals={linkedGoals}
                onActionCreate={onActionCreate}
                onActionDelete={onActionDelete}
                readOnly={readOnly}
                onActiveTabChange={onActiveActionTabChange}
              />
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
