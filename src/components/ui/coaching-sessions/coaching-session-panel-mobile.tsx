"use client";

import { useState } from "react";
import { ChevronLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { GoalFlowStep } from "@/components/ui/coaching-sessions/goal-flow";
import { GoalFlowPages } from "@/components/ui/coaching-sessions/coaching-session-panel";
import { CoachingSessionPanelSelector, PanelSection } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";
import { CompactAgreementCard } from "@/components/ui/coaching-sessions/agreement-card-compact";
import { defaultAgreement } from "@/types/agreement";

const newAgreementPlaceholder = defaultAgreement();
import { maxActiveGoals } from "@/types/goal";
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

  const headerTitle = activeSection === "agreements"
    ? undefined
    : flow.step === GoalFlowStep.Idle || flow.step === GoalFlowStep.SelectingSwap
      ? undefined
      : flow.step === GoalFlowStep.Browsing
        ? "Add goal"
        : "New goal";

  const counts: Record<PanelSection, string> = {
    [PanelSection.Goals]: linkedGoals.length > 0
      ? `${linkedGoals.length}/${maxActiveGoals()}`
      : "",
    [PanelSection.Agreements]: agreements.length > 0
      ? `${agreements.length}`
      : "",
  };

  // Reset flow when sheet closes
  const handleOpenChange = (open: boolean) => {
    if (!open && flow.step !== GoalFlowStep.Idle) {
      goalFlow.handleCancel();
    }
    setIsOpen(open);
  };

  // Trigger button label
  const triggerLabel = activeSection === PanelSection.Goals ? "Goals" : "Agreements";
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
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {triggerCount}
          </span>
        )}
      </Button>

      {/* Sheet overlay */}
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-xl p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{triggerLabel}</SheetTitle>
            <SheetDescription>Manage {triggerLabel.toLowerCase()} for this coaching session.</SheetDescription>
          </SheetHeader>

          {/* Panel header */}
          <div className="sticky top-0 z-10 bg-background border-b border-border/50 px-4 py-3">
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
                  disabled={isAddingAgreement && activeSection === PanelSection.Agreements}
                  onClick={activeSection === PanelSection.Goals ? goalFlow.handleAddGoalClick : () => onAddingAgreementChange(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              )}
            </div>
          </div>

          {/* Panel content */}
          <div className="p-4 space-y-3">
            {activeSection === PanelSection.Goals ? (
              <GoalFlowPages
                linkedGoals={linkedGoals}
                goalFlow={goalFlow}
                readOnly={readOnly}
                onUnlink={handleUnlink}
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
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
