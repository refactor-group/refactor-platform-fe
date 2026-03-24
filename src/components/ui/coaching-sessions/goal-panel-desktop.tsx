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
import { GoalFlowPages } from "@/components/ui/coaching-sessions/goal-panel";
import { maxActiveGoals } from "@/types/goal";
import type { GoalPanelSharedProps } from "@/components/ui/coaching-sessions/goal-panel";

interface GoalsPanelDesktopProps extends GoalPanelSharedProps {
  collapsed?: boolean;
}

/** Width the panel expands to during add/create/swap flows (px). */
const EXPANDED_WIDTH = 420;

export function GoalsPanelDesktop({
  linkedGoals,
  goalFlow,
  onUnlink,
  onUpdateGoal,
  readOnly = false,
  collapsed = false,
}: GoalsPanelDesktopProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  const { flow } = goalFlow;

  // Dismiss the flow when clicking outside the expanded panel
  useEffect(() => {
    if (flow.step === GoalFlowStep.Idle) return;

    function handlePointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        goalFlow.handleCancel();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [flow.step, goalFlow]);

  if (collapsed) {
    return (
      <div className="hidden md:flex md:flex-col md:items-center md:gap-2 md:pt-3 md:pb-3 md:px-1 h-full rounded-lg border border-border/50 bg-card">
        <span className="text-[11px] font-medium text-muted-foreground [writing-mode:vertical-lr]">
          Goals
        </span>
        {linkedGoals.length > 0 && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
            {linkedGoals.length}/{maxActiveGoals()}
          </span>
        )}
      </div>
    );
  }

  const isInFlow = flow.step !== GoalFlowStep.Idle;

  const headerTitle = flow.step === GoalFlowStep.Idle || flow.step === GoalFlowStep.SelectingSwap
    ? "Goals"
    : flow.step === GoalFlowStep.Browsing
      ? "Add goal"
      : "New goal";

  return (
    // Wrapper stays in the grid's 300px column; the Card overlays rightward when expanded
    <div ref={panelRef} className="hidden md:block relative">
      <Card
        className={cn(
          "flex flex-col h-full transition-[width,box-shadow] duration-300 ease-in-out",
          isInFlow
            ? "absolute inset-y-0 left-0 z-10 shadow-xl"
            : "relative shadow-sm"
        )}
        style={{ width: isInFlow ? `${EXPANDED_WIDTH}px` : "100%" }}
      >
        <CardHeader className="p-4 pb-0">
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
        </CardHeader>
        <CardContent className="p-4 space-y-3 flex-1 min-h-0 overflow-hidden">
          <GoalFlowPages
            linkedGoals={linkedGoals}
            goalFlow={goalFlow}
            readOnly={readOnly}
            onUnlink={onUnlink}
            onUpdateGoal={onUpdateGoal}
          />
        </CardContent>
      </Card>
    </div>
  );
}
