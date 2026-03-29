"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
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
  /** Maps coaching_session_id → session date for "view source session" links on review cards */
  sessionDateMap?: Map<Id, DateTime>;
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
  onBodyChange: (id: Id, newBody: string, assigneeIds?: Id[]) => Promise<void>;
  onActionCreate?: (body: string, assigneeIds?: Id[]) => Promise<void>;
  onActionDelete?: (id: Id) => void;
  readOnly?: boolean;
}

export function ActionSectionContent({
  reviewActions,
  sessionActions,
  sessionDateMap,
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

  // Auto-expand "Due for Review" when actions arrive after initial render
  // (SWR data loads asynchronously). Only expand once — don't re-expand
  // if the user manually collapsed it.
  const hasAutoExpanded = useRef(reviewActions.length > 0);
  useEffect(() => {
    if (!hasAutoExpanded.current && reviewActions.length > 0) {
      hasAutoExpanded.current = true;
      setReviewExpanded(true);
    }
  }, [reviewActions.length]);

  // ── Highlight & scroll-to for deep-linked actions ────────────────
  const searchParams = useSearchParams();
  const highlightId = searchParams.get("highlight");
  const [activeHighlight, setActiveHighlight] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const setCardRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  // When a highlight param is present and actions have loaded, scroll to
  // and highlight the target card. Also ensure the containing section is expanded.
  useEffect(() => {
    if (!highlightId) return;

    const allActions = [...reviewActions, ...sessionActions];
    const target = allActions.find((a) => a.id === highlightId);
    if (!target) return;

    // Expand the section containing the target
    const isInReview = reviewActions.some((a) => a.id === highlightId);
    if (isInReview) setReviewExpanded(true);
    else setSessionExpanded(true);

    setActiveHighlight(highlightId);

    // Scroll to the card after a frame (let expansion render)
    requestAnimationFrame(() => {
      const el = cardRefs.current.get(highlightId);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });

    // Clear highlight after animation
    const timer = setTimeout(() => setActiveHighlight(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightId, reviewActions, sessionActions]);

  // Scroll "New This Session" header into view when adding a new action
  const sessionSectionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isAddingAction && sessionSectionRef.current) {
      requestAnimationFrame(() => {
        sessionSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [isAddingAction]);

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
    <div className="space-y-4">
      {/* ── Due for Review ─────────────────────────────────────── */}
      <CollapsibleSection
        title="Due for Review"
        count={reviewActions.length}
        expanded={reviewExpanded}
        onToggle={() => setReviewExpanded((prev) => !prev)}
        testIdPrefix="review"
        stickyTop="-top-4"
        stickyPadding="pt-4"
      >
        {reviewActions.length === 0 ? (
          <p className="text-sm text-muted-foreground/50 italic px-1 py-2">
            No actions due for review
          </p>
        ) : (
          <div className="space-y-3">
            {reviewActions.map((action) => {
              const sourceSessionDate = sessionDateMap?.get(action.coaching_session_id);
              return (
                <div key={action.id} ref={(el) => setCardRef(action.id, el)}>
                  <CompactActionCard
                    action={action}
                    variant="review"
                    sourceSessionId={action.coaching_session_id}
                    sourceSessionDate={sourceSessionDate}
                    highlighted={activeHighlight === action.id}
                    onDelete={readOnly ? undefined : onActionDelete}
                    {...sharedCardProps}
                  />
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleSection>

      {/* ── New This Session ───────────────────────────────────── */}
      <CollapsibleSection
        sectionRef={sessionSectionRef}
        title="New This Session"
        count={sessionActions.length}
        expanded={sessionExpanded}
        onToggle={() => setSessionExpanded((prev) => !prev)}
        testIdPrefix="session"
        stickyTop="top-8"
      >
        {isAddingAction && onActionCreate && (
          <div>
            <CompactActionCard
              action={newActionPlaceholder}
              initialEditing
              onDelete={undefined}
              onDismiss={() => onAddingActionChange(false)}
              {...sharedCardProps}
              onBodyChange={async (_id, body, assigneeIds) => {
                await onActionCreate(body, assigneeIds);
                onAddingActionChange(false);
              }}
            />
          </div>
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
              <div key={action.id} ref={(el) => setCardRef(action.id, el)}>
                <CompactActionCard
                  action={action}
                  variant="current"
                  highlighted={activeHighlight === action.id}
                  onDelete={readOnly ? undefined : onActionDelete}
                  {...sharedCardProps}
                />
              </div>
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
  sectionRef,
  stickyTop = "top-0",
  stickyPadding,
  children,
}: {
  title: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  testIdPrefix: string;
  sectionRef?: React.RefObject<HTMLDivElement | null>;
  /** Tailwind top class for sticky stacking (e.g. "top-0", "-top-4") */
  stickyTop?: string;
  /** Extra padding on the sticky header to cover the scroll gap (e.g. "pt-4") */
  stickyPadding?: string;
  children: React.ReactNode;
}) {
  const Chevron = expanded ? ChevronDown : ChevronRight;

  return (
    <div ref={sectionRef} className="relative">
      <div className={cn("sticky z-10 bg-background", stickyTop, stickyPadding)}>
        <button
          type="button"
          data-testid={`${testIdPrefix}-section-toggle`}
          onClick={onToggle}
          className="flex w-full items-center gap-1.5 py-2 px-1 text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <Chevron className="h-3.5 w-3.5 shrink-0" />
          {title}
          <span className="text-[11px] font-normal text-muted-foreground/60">
            ({count})
          </span>
        </button>
      </div>
      <div
        data-testid={`${testIdPrefix}-section-content`}
        className={cn("relative", !expanded && "hidden")}
      >
        {children}
      </div>
    </div>
  );
}
