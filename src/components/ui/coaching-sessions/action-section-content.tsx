"use client";

import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { CompactActionCard } from "@/components/ui/coaching-sessions/action-card-compact";
import { defaultAction } from "@/types/action";
import type { Action } from "@/types/action";
import type { Id } from "@/types/general";
import type { ItemStatus } from "@/types/general";
import { cn } from "@/components/lib/utils";
import { DateTime } from "ts-luxon";

// ── Action Section Content ───────────────────────────────────────────
//
// Two collapsible sub-sections for the coaching session panel:
//   "Due for Review" — actions from previous sessions that are due
//   "New This Session" — actions created in the current session
//
// Both sub-sections have sticky headers within the panel scroll area.

export interface ActionSectionContentProps {
  reviewActions: Action[];
  sessionActions: Action[];
  locale: string;
  coachId: Id;
  coachName: string;
  coacheeId: Id;
  coacheeName: string;
  isAddingAction: boolean;
  onAddingActionChange: (adding: boolean) => void;
  onStatusChange: (id: Id, newStatus: ItemStatus) => void;
  onDueDateChange: (id: Id, newDueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  onBodyChange: (id: Id, newBody: string) => Promise<void>;
  onActionCreate?: (body: string) => Promise<void>;
  onActionDelete?: (id: Id) => void;
  readOnly?: boolean;
}

export function ActionSectionContent({
  reviewActions,
  sessionActions,
  locale,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  isAddingAction,
  onAddingActionChange,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
  onBodyChange,
  onActionCreate,
  onActionDelete,
  readOnly = false,
}: ActionSectionContentProps) {
  const [reviewExpanded, setReviewExpanded] = useState(
    reviewActions.length > 0
  );
  const [sessionExpanded, setSessionExpanded] = useState(true);

  // Lazy-init placeholder so defaultAction() isn't called at module scope
  const newActionPlaceholder = useMemo(() => defaultAction(), []);

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
  };

  return (
    <div className="space-y-1">
      {/* ── Due for Review ─────────────────────────────────────── */}
      <CollapsibleSection
        title="Due for Review"
        count={reviewActions.length}
        expanded={reviewExpanded}
        onToggle={() => setReviewExpanded((prev) => !prev)}
        testIdPrefix="review"
      >
        {reviewActions.length === 0 ? (
          <p className="text-sm text-muted-foreground/50 italic px-1 py-2">
            No actions due for review
          </p>
        ) : (
          <div className="space-y-3">
            {reviewActions.map((action) => (
              <CompactActionCard
                key={action.id}
                action={action}
                variant="review"
                onDelete={readOnly ? undefined : onActionDelete}
                {...sharedCardProps}
              />
            ))}
          </div>
        )}
      </CollapsibleSection>

      {/* ── New This Session ───────────────────────────────────── */}
      <CollapsibleSection
        title="New This Session"
        count={sessionActions.length}
        expanded={sessionExpanded}
        onToggle={() => setSessionExpanded((prev) => !prev)}
        testIdPrefix="session"
      >
        {isAddingAction && onActionCreate && (
          <CompactActionCard
            action={newActionPlaceholder}
            initialEditing
            onDelete={undefined}
            onDismiss={() => onAddingActionChange(false)}
            {...sharedCardProps}
            onBodyChange={async (_id, body) => {
              await onActionCreate(body);
            }}
          />
        )}
        {sessionActions.length === 0 && !isAddingAction ? (
          <div className="rounded-lg border border-dashed border-border/50 py-6 px-4 text-center">
            <p className="text-sm text-muted-foreground/50 italic">
              No actions yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessionActions.map((action) => (
              <CompactActionCard
                key={action.id}
                action={action}
                variant="current"
                onDelete={readOnly ? undefined : onActionDelete}
                {...sharedCardProps}
              />
            ))}
          </div>
        )}
      </CollapsibleSection>
    </div>
  );
}

// ── Collapsible Section ─────────────────────────────────────────────

function CollapsibleSection({
  title,
  count,
  expanded,
  onToggle,
  testIdPrefix,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  testIdPrefix: string;
  children: React.ReactNode;
}) {
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div>
      <button
        type="button"
        data-testid={`${testIdPrefix}-section-toggle`}
        onClick={onToggle}
        className="flex w-full items-center gap-1.5 py-2 px-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground transition-colors sticky top-0 bg-background z-10"
      >
        <Chevron className="h-3.5 w-3.5 shrink-0" />
        {title}
        <span className="text-[11px] font-normal text-muted-foreground/60">
          ({count})
        </span>
      </button>
      <div
        data-testid={`${testIdPrefix}-section-content`}
        className={cn(!expanded && "hidden")}
      >
        {children}
      </div>
    </div>
  );
}
