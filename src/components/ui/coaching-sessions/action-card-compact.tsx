"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import TextareaMarkdown from "textarea-markdown-editor";
import type { TextareaMarkdownRef } from "textarea-markdown-editor";
import { ArrowUpRight, Bold, Italic, Link2, List, ListOrdered, Pencil, Strikethrough, Trash2 } from "lucide-react";
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
  AssigneeAvatars,
  DueDatePicker,
  AssigneePickerPopover,
  resolveAssignees,
  type AssigneeInfo,
} from "@/components/ui/coaching-sessions/action-card-parts";
import { ActionStatusControl } from "@/components/ui/status/action-status-control";
import {
  CARD_BUTTON,
  CARD_DONE,
  CARD_FACE,
  CARD_TEXTAREA,
  CARD_TITLE,
  CardDetailsButton,
  FIELD_LABEL,
} from "@/components/ui/card-field";
import { StatusMetaLine } from "@/components/ui/status/status-meta-line";
import { GoalPickerPopover } from "@/components/ui/goal-picker-popover";
import { GoalPill } from "@/components/ui/goal-pill";
import type { Action } from "@/types/action";
import type { Goal } from "@/types/goal";
import { useLinkedGoalDisplay } from "@/lib/hooks/use-linked-goal-display";
import { ItemStatus, Id } from "@/types/general";
import { type Option, Some, None } from "@/types/option";
import type { NoteField } from "@/types/note-selection";
import { useFieldPrefill } from "@/lib/hooks/use-field-prefill";
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
// The design system's "full card" layout, on BaseCardCompactEditable:
//   Header: Status control (glyph + pill + caret) + details button
//   Body:   Expandable action text, muted once closed
//   Footer: Assignee avatars + status meta line
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
  onBodyChange: (id: Id, newBody: string, assigneeIds?: Id[], goalId?: Id, dueBy?: DateTime) => Promise<void>;
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
  /** Notes selection appended into the edit body on nonce change. */
  bodyAppend?: Option<NoteField>;
  /** Called when the user dismisses an initial-editing card. */
  onDismiss?: () => void;
  className?: string;
}

// A highlighted card pulses once (unless the user prefers reduced motion).
const HIGHLIGHT_CARD = "motion-safe:animate-highlight-pulse";
// Brand-accent ring echoing the indigo transcript bubble; keeps over 3:1 contrast in both themes, the tint only supports it.
const HIGHLIGHT_FACE =
  "ring-2 ring-brand animate-highlight-tint [--highlight-tint:hsl(var(--brand)/0.1)] dark:[--highlight-tint:hsl(var(--brand)/0.2)]";

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
  bodyAppend = None,
  onDismiss,
  className,
}: CompactActionCardProps) {
  const body = action.body ?? "";
  const isReview = variant === "review";

  const { linkedGoalId, linkedGoalTitle, resolvedGoals } = useLinkedGoalDisplay(action, goals);

  // For new (unsaved) actions, track goal, assignee, and due-date changes
  // locally because the action doesn't exist in the backend yet.
  const [localGoalId, setLocalGoalId] = useState<Id | undefined>(undefined);
  const [localAssigneeIds, setLocalAssigneeIds] = useState<Id[]>(
    action.assignee_ids ?? []
  );
  const [localDueBy, setLocalDueBy] = useState<DateTime>(
    action.due_by.some ? action.due_by.val : DateTime.now().plus({ days: 7 })
  );
  const displayedAction = useMemo(
    () => (initialEditing ? { ...action, due_by: Some(localDueBy) } : action),
    [initialEditing, action, localDueBy]
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
      className={cn(className, highlighted && HIGHLIGHT_CARD)}
      faceClassName={cn(CARD_FACE, highlighted && HIGHLIGHT_FACE)}
      renderHeader={({ onFlip }) => (
        <ActionHeader
          status={action.status}
          onStatusChange={(newStatus) => onStatusChange(action.id, newStatus)}
          onFlip={onFlip}
        />
      )}
      renderFront={() => (
        <ActionBody body={body} goalTitle={linkedGoalTitle} closed={isClosed(action.status)} />
      )}
      renderFooter={() => (
        <ActionFooter resolvedAssignees={resolvedAssignees} action={action} locale={locale} />
      )}
      renderBack={({ onDone, isEditing, onEditStart, onEditEnd }) =>
        isEditing ? (
          <ActionEditForm
            action={displayedAction}
            locale={locale}
            initialBody={body}
            bodyAppend={bodyAppend}
            allAssignees={allAssignees}
            resolvedAssignees={resolvedAssignees}
            assigneeIds={assigneeIds}
            goals={resolvedGoals}
            selectedGoalId={initialEditing ? localGoalId : linkedGoalId}
            onStatusChange={(newStatus) => onStatusChange(action.id, newStatus)}
            onDueDateChange={(newDueBy) => {
              if (initialEditing) {
                setLocalDueBy(newDueBy);
              } else {
                onDueDateChange(action.id, newDueBy);
              }
            }}
            onAssigneeToggle={handleAssigneeToggle}
            onGoalSelect={resolvedGoals ? (goalId) => {
              if (initialEditing) {
                setLocalGoalId(goalId);
              } else {
                onGoalChange?.(action.id, goalId);
              }
            } : undefined}
            onSave={async (newBody, savedAssigneeIds, goalId) => {
              await onBodyChange(
                action.id,
                newBody,
                savedAssigneeIds,
                goalId,
                initialEditing ? localDueBy : undefined
              );
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
      <ActionStatusControl status={status} onStatusChange={onStatusChange} />
      <CardDetailsButton label="Action options" tooltip="Edit action details" onClick={onFlip} />
    </div>
  );
}

// ── Front face: Body ────────────────────────────────────────────────

/** Completed and Won't do actions read as closed: muted, never struck through. */
function isClosed(status: ItemStatus): boolean {
  return status === ItemStatus.Completed || status === ItemStatus.WontDo;
}

function ActionBody({
  body,
  goalTitle,
  closed,
}: {
  body: string;
  goalTitle?: string;
  closed: boolean;
}) {
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
          "min-w-0 cursor-pointer prose prose-sm prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          CARD_TITLE,
          !expanded && "max-h-[2.8em] overflow-hidden",
          closed && "text-muted-foreground prose-p:text-muted-foreground"
        )}
        onClick={() => setExpanded((prev) => !prev)}
      >
        <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
      </div>
      {expanded && goalTitle && (
        <GoalPill title={goalTitle} className="mt-1.5" />
      )}
    </div>
  );
}

// ── Front face: Footer ──────────────────────────────────────────────

function ActionFooter({
  resolvedAssignees,
  action,
  locale,
}: {
  resolvedAssignees: AssigneeInfo[];
  action: Action;
  locale: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <AssigneeAvatars assignees={resolvedAssignees} />
      <StatusMetaLine
        status={action.status}
        dueBy={action.due_by}
        statusChangedAt={action.status_changed_at}
        locale={locale}
      />
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
  resolvedAssignees: AssigneeInfo[];
  goalTitle?: string;
  onGoalUnlink?: () => void;
  sourceSessionId?: Id;
  sourceSessionDate?: DateTime;
  onDone: () => void;
  onEdit: () => void;
  onDelete?: () => void;
}) {
  const formattedSessionDate = sourceSessionDate
    ?.setLocale(locale)
    .toLocaleString(DateTime.DATE_MED);

  return (
    <div className="space-y-3">
      <div className="flex min-h-7 items-center justify-between gap-2">
        <StatusMetaLine
          status={action.status}
          dueBy={action.due_by}
          statusChangedAt={action.status_changed_at}
          locale={locale}
        />
        <button
          type="button"
          onClick={onDone}
          className={cn("ml-auto", CARD_DONE)}
        >
          Done
        </button>
      </div>

      {body ? (
        <div
          className={cn(
            "prose prose-sm prose-neutral dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
            CARD_TITLE,
            isClosed(action.status) && "text-muted-foreground prose-p:text-muted-foreground"
          )}
        >
          <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
        </div>
      ) : (
        <p className="text-sm italic text-muted-foreground/60">No description</p>
      )}

      <div className="flex items-center gap-2">
        {resolvedAssignees.length > 0 && <AssigneeAvatars assignees={resolvedAssignees} named={false} />}
        <span className="text-xs text-muted-foreground">
          {resolvedAssignees.map((a) => a.name).join(", ") || "Unassigned"}
        </span>
      </div>

      {goalTitle && (
        <GoalPill title={goalTitle} onUnlink={onGoalUnlink} />
      )}

      <div className="flex items-center justify-between pt-3">
        <div>
          {sourceSessionId && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-menu"
                    className="text-muted-foreground hover:text-foreground"
                    asChild
                  >
                    <Link href={`/coaching-sessions/${sourceSessionId}?panel=actions&highlight=${action.id}`}>
                      <ArrowUpRight aria-hidden />
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
          <Button variant="secondary" size="sm" className={CARD_BUTTON} onClick={onEdit}>
            <Pencil className="!h-3 !w-3" aria-hidden />
            Edit
          </Button>
          {onDelete && (
            <Button variant="destructive" size="sm" className={CARD_BUTTON} onClick={onDelete}>
              <Trash2 className="!h-3 !w-3" aria-hidden />
              Delete
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Back face: Edit form ────────────────────────────────────────────

export interface ActionEditFormProps {
  action: Action;
  locale: string;
  initialBody: string;
  bodyAppend?: Option<NoteField>;
  allAssignees: { id: Id; name: string; initials: string }[];
  resolvedAssignees: { id: Id; name: string; initials: string }[];
  assigneeIds: Id[];
  goals?: Goal[];
  selectedGoalId?: Id;
  /** Shows the Status row when provided. */
  onStatusChange?: (newStatus: ItemStatus) => void;
  onDueDateChange: (newDueBy: DateTime) => void;
  onAssigneeToggle: (assigneeId: Id) => void;
  onGoalSelect?: (goalId: Id | undefined) => void;
  onSave: (body: string, assigneeIds: Id[], goalId?: Id) => Promise<void>;
  onCancel: () => void;
  /** Assignees that can't be picked, with the reason shown for each. */
  assigneeDisabledReasons?: Partial<Record<Id, string>>;
  saveLabel?: string;
  saveIcon?: typeof Bold;
  /** Extra classes for the Save and Cancel buttons. */
  buttonClassName?: string;
  /** Rendered in place of the Save and Cancel row when set. */
  footerOverride?: ReactNode;
  /** Makes the body, due date and assignees read-only. */
  fieldsDisabled?: boolean;
}

export function ActionEditForm({
  action,
  locale,
  initialBody,
  bodyAppend = None,
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
  assigneeDisabledReasons,
  saveLabel = "Save",
  saveIcon: SaveIcon,
  buttonClassName,
  footerOverride,
  fieldsDisabled = false,
}: ActionEditFormProps) {
  const [body, setBody] = useState(initialBody);
  const [isSaving, setIsSaving] = useState(false);
  const markdownRef = useRef<TextareaMarkdownRef>(null);
  const textareaWrapRef = useRef<HTMLDivElement>(null);

  // Append the notes selection once per nonce (an empty body is just filled).
  useFieldPrefill(bodyAppend, (text) =>
    setBody((prev) => (prev.trim() ? `${prev}\n\n${text}` : text))
  );

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
          <MarkdownToolbarButton icon={Bold} label="Bold" onClick={() => trigger("bold")} disabled={fieldsDisabled} />
          <MarkdownToolbarButton icon={Italic} label="Italic" onClick={() => trigger("italic")} disabled={fieldsDisabled} />
          <MarkdownToolbarButton icon={Strikethrough} label="Strikethrough" onClick={() => trigger("strike-through")} disabled={fieldsDisabled} />
          <span className="w-px h-4 bg-border mx-1" />
          <MarkdownToolbarButton icon={List} label="Bullet list" onClick={() => trigger("unordered-list")} disabled={fieldsDisabled} />
          <MarkdownToolbarButton icon={ListOrdered} label="Numbered list" onClick={() => trigger("ordered-list")} disabled={fieldsDisabled} />
          <span className="w-px h-4 bg-border mx-1" />
          <MarkdownToolbarButton icon={Link2} label="Link" onClick={() => trigger("link")} disabled={fieldsDisabled} />
        </div>
        <div ref={textareaWrapRef}>
          <TextareaMarkdown
            ref={markdownRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            readOnly={fieldsDisabled}
            className={cn(CARD_TEXTAREA, "min-h-[80px] max-h-[200px] overflow-y-auto overscroll-contain")}
            autoFocus
          />
        </div>
      </div>

      <div className="space-y-2">
        {onStatusChange && (
          <div className="flex items-center justify-between">
            <span className={FIELD_LABEL}>Status</span>
            <ActionStatusControl
              status={action.status}
              onStatusChange={onStatusChange}
            />
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className={FIELD_LABEL}>Due date</span>
          <DueDatePicker
            value={
              action.due_by.some
                ? action.due_by.val
                : DateTime.now().plus({ days: 7 })
            }
            onChange={onDueDateChange}
            locale={locale}
            variant="button"
            disabled={fieldsDisabled}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className={FIELD_LABEL}>Assignee(s)</span>
          <AssigneePickerPopover
            allAssignees={allAssignees}
            resolvedAssignees={resolvedAssignees}
            assigneeIds={assigneeIds}
            onToggle={onAssigneeToggle}
            disabledReasons={assigneeDisabledReasons}
            disabled={fieldsDisabled}
          />
        </div>
        {goals && onGoalSelect && (
          <div className="flex items-center justify-between">
            <span className={FIELD_LABEL}>Linked goal</span>
            <GoalPickerPopover
              goals={goals}
              selectedGoalId={selectedGoalId}
              onChange={onGoalSelect}
              disabled={fieldsDisabled}
            />
          </div>
        )}
      </div>

      {footerOverride ?? (
        <div className="flex items-center justify-end gap-2 pt-3">
          <Button
            size="sm"
            className={cn(CARD_BUTTON, buttonClassName)}
            onClick={handleSave}
            disabled={isSaving || !body.trim()}
          >
            {SaveIcon && <SaveIcon className="!h-3 !w-3" aria-hidden />}
            {saveLabel}
          </Button>
          <Button
            variant="tertiary"
            size="sm"
            className={cn(CARD_BUTTON, buttonClassName)}
            onClick={onCancel}
            disabled={isSaving}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Markdown toolbar button ─────────────────────────────────────────

export function MarkdownToolbarButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: typeof Bold;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-menu"
            aria-label={label}
            disabled={disabled}
            onClick={(e) => {
              e.preventDefault();
              onClick();
            }}
          >
            <Icon aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
