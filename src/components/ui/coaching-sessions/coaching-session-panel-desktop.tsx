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
import { CountPill } from "@/components/ui/count-pill";
import { GoalFlowStep } from "@/components/ui/coaching-sessions/goal-flow";
import { GoalFlowPages, computePanelCounts, computeHeaderTitle } from "@/components/ui/coaching-sessions/coaching-session-panel";
import { CoachingSessionPanelSelector, PanelSection } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";
import { AgreementSectionContent } from "@/components/ui/coaching-sessions/agreement-section-content";
import { ActionSectionContent } from "@/components/ui/coaching-sessions/action-section-content";
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

  const counts = computePanelCounts(linkedGoals, agreements, reviewActions, sessionActions);

  if (collapsed) {
    const sectionLabels: Record<PanelSection, string> = {
      [PanelSection.Goals]: "Goals",
      [PanelSection.Agreements]: "Agreements",
      [PanelSection.Actions]: "Actions",
    };
    const collapsedLabel = sectionLabels[activeSection];
    const collapsedCount = counts[activeSection] || undefined;

    return (
      <div className="hidden md:flex md:flex-col md:items-center md:gap-2 md:pt-3 md:pb-3 md:px-1 h-full rounded-lg border border-border/50 bg-card">
        <span className="text-[11px] font-medium text-muted-foreground [writing-mode:vertical-lr]">
          {collapsedLabel}
        </span>
        {collapsedCount && (
          <CountPill count={collapsedCount} className="text-[10px] text-muted-foreground/50" />
        )}
      </div>
    );
  }

  const isInGoalFlow = activeSection === PanelSection.Goals && flow.step !== GoalFlowStep.Idle;
  const headerTitle = computeHeaderTitle(activeSection, flow.step);

  return (
    <div ref={panelRef} className="hidden md:block relative h-full min-h-0">
      <Card
        className={cn(
          "flex flex-col h-full overflow-clip transition-[width,box-shadow] duration-300 ease-in-out",
          isInGoalFlow
            ? "absolute inset-y-0 left-0 z-10 shadow-xl"
            : "relative shadow-sm"
        )}
        style={{ width: isInGoalFlow ? `${EXPANDED_WIDTH}px` : "100%" }}
      >
        <CardHeader className="p-4 pb-2">
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
                  (isAddingAction && activeSection === PanelSection.Actions)
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
        </CardHeader>
        <CardContent className="p-4 space-y-3 flex-1 min-h-0 overflow-y-auto [scrollbar-width:thin]">
          {activeSection === PanelSection.Goals ? (
            <GoalFlowPages
              linkedGoals={linkedGoals}
              goalFlow={goalFlow}
              readOnly={readOnly}
              onUnlink={onUnlink}
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
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
