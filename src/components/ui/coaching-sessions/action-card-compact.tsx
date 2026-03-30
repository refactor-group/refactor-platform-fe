"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import TextareaMarkdown from "textarea-markdown-editor";
import type { TextareaMarkdownRef } from "textarea-markdown-editor";
import { ArrowUpRight, Bold, Italic, Link2, List, ListOrdered, Info, Pencil, Strikethrough, Trash2, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BaseCardCompactEditable } from "@/components/ui/base-card-compact-editable";
import {
  StatusSelect,
  DueDatePicker,
  AssigneePickerPopover,
  GoalPickerPopover,
  resolveAssignees,
} from "@/components/ui/coaching-sessions/action-card-parts";
import type { Action } from "@/types/action";
import type { Goal } from "@/types/goal";
import { goalTitle as getGoalTitle } from "@/types/goal";
import { useGoal, useGoalsBySession } from "@/lib/api/goals";
import { ItemStatus, Id } from "@/types/general";
import { cn } from "@/components/lib/utils";
import { DateTime } from "ts-luxon";

// Open all markdown links in a new tab
const markdownComponents = {
  a: ({ href, children, ...props }: React.ComponentPropsWithoutRef<"a">) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
};

// ── Compact Action Card (flip-card interaction) ──────────────────────
//
// Uses BaseCardCompactEditable with header/footer for a three-zone front face:
//   Header: Status pill (interactive) + flip icon
//   Body:   Expandable action text
//   Footer: Assignee initials + due date
//
// Back face provides full edit form for body, status, due date, assignees.
// Review variant makes body read-only and hides delete.

export interface CompactActionCardProps {
  action: Action;
  locale: string;
  coachId: Id;
  coachName: string;
  coacheeId: Id;
  coacheeName: string;
  onStatusChange: (id: Id, newStatus: ItemStatus) => void;
  onDueDateChange: (id: Id, newDueBy: DateTime) => void;
  onAssigneesChange: (id: Id, assigneeIds: Id[]) => void;
  onBodyChange: (id: Id, newBody: string, assigneeIds?: Id[], goalId?: Id) => Promise<void>;
  onDelete?: (id: Id) => void;
  /** "review" makes body read-only and hides delete. Defaults to "current". */
  variant?: "current" | "review";
  /** Source session ID for "view session" link on review cards */
  sourceSessionId?: Id;
  /** Source session date for tooltip on "view session" link */
  sourceSessionDate?: DateTime;
  /** When true, show a brief highlight ring animation */
  highlighted?: boolean;
  /** Session goals available for the goal picker */
  goals?: Goal[];
  /** Called when the user links or unlinks a goal */
  onGoalChange?: (id: Id, goalId: Id | undefined) => void;
  /** When true, card starts in edit mode (used for new actions). */
  initialEditing?: boolean;
  /** Called when the user dismisses an initial-editing card. */
  onDismiss?: () => void;
  className?: string;
}

export function CompactActionCard({
  action,
  locale,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onStatusChange,
  onDueDateChange,
  onAssigneesChange,
  onBodyChange,
  onDelete,
  variant = "current",
  sourceSessionId,
  sourceSessionDate,
  goals,
  onGoalChange,
  highlighted = false,
  initialEditing = false,
  onDismiss,
  className,
}: CompactActionCardProps) {
  const body = action.body ?? "";
  const isReview = variant === "review";

  // Resolve linked goal title for display.
  // Prefer the goals array if provided (session panel); otherwise lazy-fetch
  // the single goal by ID (kanban board / any context without pre-fetched goals).
  const goalFromArray = useMemo(() => {
    if (!action.goal_id || !goals) return undefined;
    return goals.find((g) => g.id === action.goal_id);
  }, [action.goal_id, goals]);

  const shouldFetchGoal = Boolean(action.goal_id) && !goalFromArray;
  const { goal: fetchedGoal } = useGoal(shouldFetchGoal ? action.goal_id! : "");

  const linkedGoalTitle = useMemo(() => {
    if (goalFromArray) return getGoalTitle(goalFromArray);
    if (shouldFetchGoal && fetchedGoal.id) return getGoalTitle(fetchedGoal);
    return undefined;
  }, [goalFromArray, shouldFetchGoal, fetchedGoal]);

  // When no goals prop is provided (e.g. kanban board), lazy-fetch session
  // goals so the edit form's goal picker still works. SWR skips the fetch
  // when the key is null (goals already provided via prop).
  const { goals: sessionGoals } = useGoalsBySession(
    !goals ? action.coaching_session_id : null
  );
  const resolvedGoals = goals ?? (sessionGoals.length > 0 ? sessionGoals : undefined);

  // For new (unsaved) actions, track goal and assignee changes locally
  // because the action doesn't exist in the backend yet.
  const [localGoalId, setLocalGoalId] = useState<Id | undefined>(undefined);
  const [localAssigneeIds, setLocalAssigneeIds] = useState<Id[]>(
    action.assignee_ids ?? []
  );
  const assigneeIds = useMemo(
    () => initialEditing ? localAssigneeIds : (action.assignee_ids ?? []),
    [initialEditing, localAssigneeIds, action.assignee_ids]
  );

  const { allAssignees, resolvedAssignees } = resolveAssignees(
    assigneeIds,
    coachId,
    coachName,
    coacheeId,
    coacheeName
  );

  const handleAssigneeToggle = useCallback(
    (assigneeId: Id) => {
      const updated = assigneeIds.includes(assigneeId)
        ? assigneeIds.filter((id) => id !== assigneeId)
        : [...assigneeIds, assigneeId];
      if (initialEditing) {
        setLocalAssigneeIds(updated);
      } else {
        onAssigneesChange(action.id, updated);
      }
    },
    [assigneeIds, initialEditing, onAssigneesChange, action.id]
  );

  return (
    <BaseCardCompactEditable
      canFlip
      initialEditing={initialEditing}
      onDismiss={onDismiss}
      className={cn(className, highlighted && "ring-2 ring-primary/40 animate-in fade-in duration-500")}
      renderHeader={({ onFlip }) => (
        <ActionHeader
          status={action.status}
          onStatusChange={(newStatus) => onStatusChange(action.id, newStatus)}
          onFlip={onFlip}
        />
      )}
      renderFront={() => (
        <ActionBody body={body} goalTitle={linkedGoalTitle} />
      )}
      renderFooter={() => (
        <ActionFooter
          resolvedAssignees={resolvedAssignees}
          dueBy={action.due_by}
          locale={locale}
        />
      )}
      renderBack={({ onDone, isEditing, onEditStart, onEditEnd }) =>
        isEditing ? (
          <ActionEditForm
            action={action}
            locale={locale}
            initialBody={body}
            allAssignees={allAssignees}
            resolvedAssignees={resolvedAssignees}
            assigneeIds={assigneeIds}
            goals={resolvedGoals}
            selectedGoalId={initialEditing ? localGoalId : action.goal_id}
            onStatusChange={(newStatus) => onStatusChange(action.id, newStatus)}
            onDueDateChange={(newDueBy) => onDueDateChange(action.id, newDueBy)}
            onAssigneeToggle={handleAssigneeToggle}
            onGoalSelect={resolvedGoals ? (goalId) => {
              if (initialEditing) {
                setLocalGoalId(goalId);
              } else {
                onGoalChange?.(action.id, goalId);
              }
            } : undefined}
            onSave={async (newBody, savedAssigneeIds, goalId) => {
              await onBodyChange(action.id, newBody, savedAssigneeIds, goalId);
              if (!initialEditing) onEditEnd();
            }}
            onCancel={onDismiss ? onDone : onEditEnd}
          />
        ) : (
          <ActionBackView
            action={action}
            body={body}
            locale={locale}
            resolvedAssignees={resolvedAssignees}
            goalTitle={linkedGoalTitle}
            onGoalUnlink={
              linkedGoalTitle && onGoalChange
                ? () => onGoalChange(action.id, undefined)
                : undefined
            }
            sourceSessionId={sourceSessionId}
            sourceSessionDate={sourceSessionDate}
            onDone={onDone}
            onEdit={onEditStart}
            onDelete={
              !isReview && onDelete
                ? () => {
                    onDelete(action.id);
                    onDone();
                  }
                : undefined
            }
          />
        )
      }
    />
  );
}

// ── Front face: Header ──────────────────────────────────────────────

function ActionHeader({
  status,
  onStatusChange,
  onFlip,
}: {
  status: ItemStatus;
  onStatusChange: (newStatus: ItemStatus) => void;
  onFlip: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <StatusSelect status={status} onStatusChange={onStatusChange} />
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Action options"
              onClick={(e) => {
                e.stopPropagation();
                onFlip();
              }}
              className="rounded-full p-0.5 text-muted-foreground/30 hover:text-muted-foreground transition-colors"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Edit action details
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// ── Front face: Body ────────────────────────────────────────────────

function ActionBody({ body, goalTitle }: { body: string; goalTitle?: string }) {
  const [expanded, setExpanded] = useState(false);

  if (!body) {
    return (
      <span className="text-[13px] text-muted-foreground/50 italic">
        No description
      </span>
    );
  }

  return (
    <div>
      <div
        className={cn(
          "min-w-0 cursor-pointer prose prose-sm prose-neutral dark:prose-invert max-w-none text-[13px] font-medium [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          !expanded && "max-h-[2.8em] overflow-hidden"
        )}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
      </div>
      {expanded && goalTitle && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                data-testid="goal-pill"
                className="mt-1.5 block rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground truncate"
              >
                {goalTitle}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {goalTitle}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}

// ── Front face: Footer ──────────────────────────────────────────────

function ActionFooter({
  resolvedAssignees,
  dueBy,
  locale,
}: {
  resolvedAssignees: { initials: string; name: string }[];
  dueBy: DateTime;
  locale: string;
}) {
  const formattedDate = dueBy
    .setLocale(locale)
    .toLocaleString(DateTime.DATE_MED);

  return (
    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
      <div className="flex items-center gap-1">
        {resolvedAssignees.map((a) => (
          <TooltipProvider key={a.initials} delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-[11px] font-medium">{a.initials}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {a.name}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              data-testid="action-due-date"
              className="text-[11px] font-bold"
            >
              {formattedDate}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            Due {formattedDate}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

// ── Back face: View mode ────────────────────────────────────────────

function ActionBackView({
  action,
  body,
  locale,
  resolvedAssignees,
  goalTitle,
  onGoalUnlink,
  sourceSessionId,
  sourceSessionDate,
  onDone,
  onEdit,
  onDelete,
}: {
  action: Action;
  body: string;
  locale: string;
  resolvedAssignees: { initials: string; name: string }[];
  goalTitle?: string;
  onGoalUnlink?: () => void;
  sourceSessionId?: Id;
  sourceSessionDate?: DateTime;
  onDone: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const formattedDate = action.due_by
    .setLocale(locale)
    .toLocaleString(DateTime.DATE_MED);

  const formattedSessionDate = sourceSessionDate
    ?.setLocale(locale)
    .toLocaleString(DateTime.DATE_MED);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold">
          Due: {formattedDate}
        </span>
        <button
          type="button"
          onClick={onDone}
          className="text-[12px] font-medium text-primary hover:text-primary/80 transition-colors"
        >
          Done
        </button>
      </div>

      {body ? (
        <div className="text-[13px] font-medium prose prose-sm prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground/50 italic">No description</p>
      )}

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          {resolvedAssignees.map((a) => a.name).join(", ") || "Unassigned"}
        </span>
      </div>

      {goalTitle && (
        <div className="flex items-center gap-1.5">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="min-w-0 block rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground truncate">
                  {goalTitle}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {goalTitle}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {onGoalUnlink && (
            <button
              type="button"
              aria-label="Unlink goal"
              onClick={onGoalUnlink}
              className="rounded-full p-0.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-3">
        <div>
          {sourceSessionId && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                    asChild
                  >
                    <Link href={`/coaching-sessions/${sourceSessionId}?panel=actions&highlight=${action.id}`}>
                      <ArrowUpRight className="!h-3.5 !w-3.5" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {formattedSessionDate
                    ? `View in session from ${formattedSessionDate}`
                    : "View in source session"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-6 gap-1 text-[11px] px-2"
            onClick={onEdit}
          >
            <Pencil className="!h-2.5 !w-2.5" />
            Edit
          </Button>
          {onDelete && (
            <Button
              variant="destructive"
              size="sm"
              className="h-6 gap-1 text-[11px] px-2"
              onClick={onDelete}
            >
              <Trash2 className="!h-2.5 !w-2.5" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Back face: Edit form ────────────────────────────────────────────

function ActionEditForm({
  action,
  locale,
  initialBody,
  allAssignees,
  resolvedAssignees,
  assigneeIds,
  goals,
  selectedGoalId,
  onStatusChange,
  onDueDateChange,
  onAssigneeToggle,
  onGoalSelect,
  onSave,
  onCancel,
}: {
  action: Action;
  locale: string;
  initialBody: string;
  allAssignees: { id: Id; name: string; initials: string }[];
  resolvedAssignees: { id: Id; name: string; initials: string }[];
  assigneeIds: Id[];
  goals?: Goal[];
  selectedGoalId?: Id;
  onStatusChange: (newStatus: ItemStatus) => void;
  onDueDateChange: (newDueBy: DateTime) => void;
  onAssigneeToggle: (assigneeId: Id) => void;
  onGoalSelect?: (goalId: Id | undefined) => void;
  onSave: (body: string, assigneeIds: Id[], goalId?: Id) => Promise<void>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(initialBody);
  const [isSaving, setIsSaving] = useState(false);
  const markdownRef = useRef<TextareaMarkdownRef>(null);
  const textareaWrapRef = useRef<HTMLDivElement>(null);

  // Trap scroll inside the textarea when it has overflow.
  // React's onWheel is passive so preventDefault is ignored. We attach a
  // non-passive handler on a stable wrapper div (won't be recreated by
  // React reconciliation) and manually scroll the textarea.
  useEffect(() => {
    const wrap = textareaWrapRef.current;
    if (!wrap) return;
    function handleWheel(e: WheelEvent) {
      const ta = wrap!.querySelector("textarea");
      if (!ta || ta.scrollHeight <= ta.clientHeight) return;
      e.preventDefault();
      e.stopPropagation();
      ta.scrollTop += e.deltaY;
    }
    wrap.addEventListener("wheel", handleWheel, { passive: false });
    return () => wrap.removeEventListener("wheel", handleWheel);
  }, []);

  const handleSave = useCallback(async () => {
    if (!body.trim()) return;
    setIsSaving(true);
    try {
      await onSave(body.trim(), assigneeIds, selectedGoalId);
    } finally {
      setIsSaving(false);
    }
  }, [body, assigneeIds, selectedGoalId, onSave]);

  const trigger = useCallback(
    (command: string) => markdownRef.current?.trigger(command),
    []
  );

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <div className="flex items-center gap-0.5">
          <MarkdownToolbarButton icon={Bold} label="Bold" onClick={() => trigger("bold")} />
          <MarkdownToolbarButton icon={Italic} label="Italic" onClick={() => trigger("italic")} />
          <MarkdownToolbarButton icon={Strikethrough} label="Strikethrough" onClick={() => trigger("strike-through")} />
          <span className="w-px h-4 bg-border mx-1" />
          <MarkdownToolbarButton icon={List} label="Bullet list" onClick={() => trigger("unordered-list")} />
          <MarkdownToolbarButton icon={ListOrdered} label="Numbered list" onClick={() => trigger("ordered-list")} />
          <span className="w-px h-4 bg-border mx-1" />
          <MarkdownToolbarButton icon={Link2} label="Link" onClick={() => trigger("link")} />
        </div>
        <div ref={textareaWrapRef}>
          <TextareaMarkdown
            ref={markdownRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="w-full min-h-[80px] max-h-[200px] overflow-y-auto overscroll-contain rounded-md border border-border bg-background px-2 py-1.5 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Status</span>
          <StatusSelect
            status={action.status}
            onStatusChange={onStatusChange}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Due date</span>
          <DueDatePicker
            value={action.due_by}
            onChange={onDueDateChange}
            locale={locale}
            variant="button"
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Assignee(s)</span>
          <AssigneePickerPopover
            allAssignees={allAssignees}
            resolvedAssignees={resolvedAssignees}
            assigneeIds={assigneeIds}
            onToggle={onAssigneeToggle}
          />
        </div>
        {goals && onGoalSelect && (
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">Linked goal</span>
            <GoalPickerPopover
              goals={goals}
              selectedGoalId={selectedGoalId}
              onChange={onGoalSelect}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-2 pt-3">
          <Button
            size="sm"
            className="h-6 gap-1 text-[11px] px-2"
            onClick={handleSave}
            disabled={isSaving || !body.trim()}
          >
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-[11px] px-2 text-muted-foreground"
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
      </div>
    </div>
  );
}

// ── Markdown toolbar button ─────────────────────────────────────────

function MarkdownToolbarButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Bold;
  label: string;
  onClick: () => void;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onClick();
            }}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <Icon className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
