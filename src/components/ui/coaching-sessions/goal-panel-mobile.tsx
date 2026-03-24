"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { GoalChip } from "@/components/ui/coaching-sessions/goal-chip";
import { GoalFlowStep } from "@/components/ui/coaching-sessions/goal-flow";
import { GoalFlowPages } from "@/components/ui/coaching-sessions/goal-panel";
import { useGoalProgress } from "@/lib/api/goal-progress";
import type { Goal } from "@/types/goal";
import { maxActiveGoals } from "@/types/goal";
import { Some } from "@/types/option";
import type { GoalPanelSharedProps } from "@/components/ui/coaching-sessions/goal-panel";

// ── GoalChip wrapper that fetches its own progress ─────────────────────

function GoalChipWithProgress({
  goal,
}: {
  goal: Goal;
}) {
  const { progressMetrics } = useGoalProgress(Some(goal.id));

  return (
    <GoalChip
      goal={goal}
      actionsCompleted={progressMetrics.actions_completed}
      actionsTotal={progressMetrics.actions_total}
    />
  );
}

export function GoalsPanelMobile({
  linkedGoals,
  goalFlow,
  onUnlink,
  onUpdateGoal,
  readOnly = false,
}: GoalPanelSharedProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { flow } = goalFlow;
  const isInFlow = flow.step !== GoalFlowStep.Idle;

  const headerTitle = flow.step === GoalFlowStep.Idle || flow.step === GoalFlowStep.SelectingSwap
    ? "Goals"
    : flow.step === GoalFlowStep.Browsing
      ? "Add goal"
      : "New goal";

  return (
    <Card className="md:hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-3 min-h-[44px] px-4">
          {isInFlow && (
            <button
              type="button"
              onClick={goalFlow.handleBack}
              aria-label="Back"
              className="rounded-md p-0.5 text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          <span className="text-sm font-semibold text-foreground shrink-0">
            {headerTitle}
          </span>
          {flow.step === GoalFlowStep.Idle && linkedGoals.length > 0 && (
            <span className="text-[11px] text-muted-foreground/50 tabular-nums shrink-0">
              {linkedGoals.length}/{maxActiveGoals()}
            </span>
          )}
          {!isInFlow && (
            <>
              <div className="flex flex-wrap items-center gap-2 flex-1 py-1">
                {linkedGoals.length === 0 ? (
                  <span className="text-sm text-muted-foreground/50 italic">
                    No goals added yet
                  </span>
                ) : (
                  linkedGoals.map((goal) => (
                    <GoalChipWithProgress
                      key={goal.id}
                      goal={goal}
                    />
                  ))
                )}
              </div>
              <div className="flex items-center shrink-0">
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
                    aria-label={isOpen ? "Collapse goals" : "Expand goals"}
                  >
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </div>
            </>
          )}
        </div>

        <CollapsibleContent>
          <div className="px-4 pt-1 pb-4 space-y-3">
            {flow.step === GoalFlowStep.Idle && !readOnly && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={goalFlow.handleAddGoalClick}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add goal
                </Button>
              </div>
            )}
            <GoalFlowPages
              linkedGoals={linkedGoals}
              goalFlow={goalFlow}
              readOnly={readOnly}
              onUnlink={onUnlink}
              onUpdateGoal={onUpdateGoal}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
