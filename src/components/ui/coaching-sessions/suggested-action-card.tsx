"use client";

import { useCallback, useRef, useState } from "react";
import type {
  ComponentPropsWithoutRef,
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import TextareaMarkdown from "textarea-markdown-editor";
import type { TextareaMarkdownRef } from "textarea-markdown-editor";
import {
  Bold,
  Check,
  FileText,
  Info,
  Italic,
  Link2,
  List,
  ListOrdered,
  Lock,
  Quote,
  Sparkles,
  Strikethrough,
  X,
} from "lucide-react";
import type { DateTime } from "ts-luxon";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AssigneePickerPopover,
  DueDatePicker,
  resolveAssignees,
} from "@/components/ui/coaching-sessions/action-card-parts";
import { MarkdownToolbarButton } from "@/components/ui/coaching-sessions/action-card-compact";
import { cn } from "@/components/lib/utils";
import { mayActOnSuggestion, suggestionDue } from "@/lib/utils/transcript-suggestions";
import { formatTimestamp } from "@/lib/utils/transcript-format-timestamp";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";
import { RelationshipRole } from "@/types/relationship-role";
import type { ActionEdits, ActionSuggestion } from "@/types/transcript-suggestion";

const markdownComponents = {
  a: ({ href, children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
      {children}
    </a>
  ),
};

export interface SuggestedActionCardProps {
  suggestion: ActionSuggestion;
  viewerRole: RelationshipRole;
  locale: string;
  coachId: Id;
  coachName: string;
  coacheeId: Id;
  coacheeName: string;
  onAccept?: () => Promise<void>;
  onDismiss?: () => Promise<void>;
  /** Resolves true when the edits were saved. */
  onSave?: (edits: ActionEdits) => Promise<boolean>;
}

export function SuggestedActionCard(props: SuggestedActionCardProps) {
  const [editing, setEditing] = useState(false);
  const { onSave } = props;

  if (editing && onSave) {
    return (
      <TooltipProvider delayDuration={300}>
        <div
          data-testid="suggested-action-card"
          className="relative flex min-w-0 flex-col gap-2 rounded-lg border border-dashed border-foreground/30 bg-card p-3 animate-in fade-in zoom-in-95"
        >
          <SuggestionEditForm {...props} onSave={onSave} onClose={() => setEditing(false)} />
        </div>
      </TooltipProvider>
    );
  }
  return <SuggestionView {...props} onEdit={() => setEditing(true)} />;
}

function SuggestionView({
  suggestion,
  viewerRole,
  locale,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onAccept,
  onDismiss,
  onSave,
  onEdit,
}: SuggestedActionCardProps & { onEdit: () => void }) {
  const [pending, setPending] = useState(false);
  const { proposal, quote, segment } = suggestion;
  const assigneeIds = proposal.assignee_ids ?? [];
  const mayAct = mayActOnSuggestion(
    viewerRole,
    { coachId, coacheeId },
    assigneeIds,
    None
  );
  const { resolvedAssignees } = resolveAssignees(
    assigneeIds,
    coachId,
    coachName,
    coacheeId,
    coacheeName
  );
  const source = `${segment.speaker_label} · ${formatTimestamp(segment.start_ms)}`;

  const run = (handler?: () => Promise<void>) => async () => {
    if (!handler || pending) return;
    setPending(true);
    try {
      await handler();
    } finally {
      setPending(false);
    }
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        data-testid="suggested-action-card"
        className="relative flex min-w-0 flex-col gap-2 rounded-lg border border-dashed border-foreground/30 bg-card p-3"
      >
        <div className="flex min-h-6 items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Sparkles size={13} aria-hidden />
            Suggested
          </span>
          {mayAct && (
            <div className="flex items-center gap-0.5">
              <IconButton
                label="Edit before accepting"
                className="text-muted-foreground/30 hover:text-muted-foreground"
                disabled={pending}
                onClick={onSave ? onEdit : undefined}
              >
                <Info className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                label="Accept: add as action"
                disabled={pending}
                onClick={run(onAccept)}
              >
                <Check className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                label="Dismiss suggestion"
                disabled={pending}
                onClick={run(onDismiss)}
              >
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          )}
        </div>

        <SuggestionBody body={proposal.body ?? ""} />

        <div className="flex min-w-0 gap-2 text-muted-foreground">
          <Quote size={12} className="mt-0.5 shrink-0 opacity-70" aria-hidden />
          <div className="flex min-w-0 flex-col gap-1">
            <p className="line-clamp-2 text-xs italic leading-snug [overflow-wrap:anywhere]">
              “{quote}”
            </p>
            <button
              type="button"
              title="Show in transcript"
              aria-label={`Show in transcript: ${source}`}
              className="inline-flex items-center gap-1 self-start text-[11px] font-medium tabular-nums underline decoration-foreground/30 underline-offset-2 max-md:min-h-10"
            >
              <FileText size={11} aria-hidden />
              {source}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1 max-md:min-h-10">
            {resolvedAssignees.length === 0 ? (
              <span className="italic text-muted-foreground/70">Unassigned</span>
            ) : (
              resolvedAssignees.map((a) => (
                <Tooltip key={a.id}>
                  <TooltipTrigger asChild>
                    <span className="font-medium">{a.initials}</span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {a.name}
                  </TooltipContent>
                </Tooltip>
              ))
            )}
          </div>
          <SuggestionDueLabel suggestion={suggestion} locale={locale} />
        </div>

        {!mayAct && (
          <p
            data-testid="suggested-action-lock-note"
            className="flex items-center gap-1.5 border-t border-dashed pt-2 text-[11px] text-muted-foreground"
          >
            <Lock size={11} aria-hidden />
            Only {coachName.split(" ")[0]} can accept or edit it.
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}

function IconButton({
  label,
  className,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50 max-md:size-10",
        className
      )}
    >
      {children}
    </button>
  );
}

function SuggestionBody({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div
      data-testid="suggested-action-body"
      data-expanded={expanded ? "true" : "false"}
      className={cn(
        "min-w-0 cursor-pointer prose prose-sm prose-neutral dark:prose-invert max-w-none text-[13px] font-medium leading-[1.55] [overflow-wrap:anywhere] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        !expanded && "max-h-[2.8em] overflow-hidden"
      )}
      onClick={() => setExpanded((prev) => !prev)}
    >
      <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
    </div>
  );
}

function SuggestionDueLabel({
  suggestion,
  locale,
}: {
  suggestion: ActionSuggestion;
  locale: string;
}) {
  const [open, setOpen] = useState(false);
  const due = suggestionDue(suggestion, locale);
  const kind = due.spoken ? "spoken" : "default";
  const weight = due.spoken ? "font-bold" : "font-normal";

  if (due.tooltip.none) {
    return (
      <span
        data-testid="suggested-action-due"
        data-due-kind={kind}
        className={cn("tabular-nums max-md:flex max-md:min-h-10 max-md:items-center", weight)}
      >
        {due.label}
      </span>
    );
  }

  // Radix closes on pointerdown and click; take both over so a tap toggles.
  const keepOpen = (e: PointerEvent) => e.preventDefault();
  const toggle = (e: MouseEvent) => {
    e.preventDefault();
    setOpen((prev) => !prev);
  };

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          data-testid="suggested-action-due"
          data-due-kind={kind}
          onPointerDown={keepOpen}
          onClick={toggle}
          className={cn(
            "cursor-help tabular-nums underline decoration-dotted decoration-muted-foreground/50 underline-offset-[3px] max-md:min-h-10",
            weight
          )}
        >
          {due.label}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64 text-xs">
        {due.tooltip.val}
      </TooltipContent>
    </Tooltip>
  );
}

function SuggestionEditForm({
  suggestion,
  viewerRole,
  locale,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onSave,
  onClose,
}: SuggestedActionCardProps & {
  onSave: (edits: ActionEdits) => Promise<boolean>;
  onClose: () => void;
}) {
  const { proposal } = suggestion;
  const [body, setBody] = useState(proposal.body ?? "");
  const [picked, setPicked] = useState<Option<DateTime>>(None);
  const [assigneeIds, setAssigneeIds] = useState<Id[]>(proposal.assignee_ids ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const markdownRef = useRef<TextareaMarkdownRef>(null);

  const { allAssignees, resolvedAssignees } = resolveAssignees(
    assigneeIds,
    coachId,
    coachName,
    coacheeId,
    coacheeName
  );
  const disabledReasons =
    viewerRole === RelationshipRole.Coachee
      ? { [coachId]: "Only your coach can assign an action to themselves." }
      : {};
  const dueValue = picked.some ? picked.val : suggestionDue(suggestion, locale).at;

  const toggleAssignee = (id: Id) =>
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );

  const trigger = useCallback(
    (command: string) => markdownRef.current?.trigger(command),
    []
  );

  const handleSave = async () => {
    const trimmed = body.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    try {
      const saved = await onSave({
        body: trimmed,
        // An unspoken date stays unspoken unless the reviewer picks one.
        due_by: picked.some ? picked : proposal.due_by,
        assignee_ids: assigneeIds,
      });
      if (saved) onClose();
    } finally {
      setIsSaving(false);
    }
  };

  // Ignore Escape from portaled popovers, which bubbles here through React.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape" || !e.currentTarget.contains(e.target as Node)) return;
    e.preventDefault();
    onClose();
  };

  return (
    <div className="flex flex-col gap-3" onKeyDown={handleKeyDown}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Sparkles size={13} aria-hidden />
        Edit suggestion
      </span>

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
        <TextareaMarkdown
          ref={markdownRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full min-h-[80px] max-h-[200px] overflow-y-auto overscroll-contain rounded-md border border-border bg-background px-2 py-1.5 text-[13px] resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          autoFocus
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">Due date</span>
          <DueDatePicker
            value={dueValue}
            onChange={(date) => setPicked(Some(date))}
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
            onToggle={toggleAssignee}
            disabledReasons={disabledReasons}
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 pt-3">
        <Button
          size="sm"
          className="h-6 gap-1 text-[11px] px-2 max-md:h-10"
          onClick={handleSave}
          disabled={isSaving || !body.trim()}
        >
          Save
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 gap-1 text-[11px] px-2 text-muted-foreground max-md:h-10"
          onClick={onClose}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
