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
import { GoalFlowPages } from "@/components/ui/coaching-sessions/goal-panel";
import { maxActiveGoals } from "@/types/goal";
import type { GoalPanelSharedProps } from "@/components/ui/coaching-sessions/goal-panel";

export function GoalsPanelMobile({
  linkedGoals,
  goalFlow,
  onUnlink,
  onUpdateGoal,
  readOnly = false,
}: GoalPanelSharedProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Wrap onUnlink to close the sheet so the undo toast is accessible
  const handleUnlink = (goalId: string) => {
    setIsOpen(false);
    onUnlink(goalId);
  };

  const { flow } = goalFlow;
  const isInFlow = flow.step !== GoalFlowStep.Idle;

  const headerTitle = flow.step === GoalFlowStep.Idle || flow.step === GoalFlowStep.SelectingSwap
    ? "Goals"
    : flow.step === GoalFlowStep.Browsing
      ? "Add goal"
      : "New goal";

  // Reset flow when sheet closes
  const handleOpenChange = (open: boolean) => {
    if (!open && isInFlow) {
      goalFlow.handleCancel();
    }
    setIsOpen(open);
  };

  return (
    <div className="md:hidden">
      {/* Trigger button */}
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 text-xs"
        onClick={() => setIsOpen(true)}
      >
        Goals
        {linkedGoals.length > 0 && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {linkedGoals.length}/{maxActiveGoals()}
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
            <SheetTitle>Goals</SheetTitle>
            <SheetDescription>Manage goals for this coaching session.</SheetDescription>
          </SheetHeader>

          {/* Panel header — mirrors desktop */}
          <div className="sticky top-0 z-10 bg-background border-b border-border/50 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isInFlow && (
                  <button
                    type="button"
                    onClick={goalFlow.handleBack}
                    aria-label="Back"
                    className="rounded-md p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}
                <h3 className="text-sm font-semibold text-foreground">{headerTitle}</h3>
                {flow.step === GoalFlowStep.Idle && linkedGoals.length > 0 && (
                  <span className="text-[11px] text-muted-foreground/50 tabular-nums">
                    {linkedGoals.length}/{maxActiveGoals()}
                  </span>
                )}
              </div>
              {flow.step === GoalFlowStep.Idle && !readOnly && (
                <Button
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={goalFlow.handleAddGoalClick}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add goal
                </Button>
              )}
            </div>
          </div>

          {/* Panel content — same as desktop */}
          <div className="p-4 space-y-3">
            <GoalFlowPages
              linkedGoals={linkedGoals}
              goalFlow={goalFlow}
              readOnly={readOnly}
              onUnlink={handleUnlink}
              onUpdateGoal={onUpdateGoal}
            />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
