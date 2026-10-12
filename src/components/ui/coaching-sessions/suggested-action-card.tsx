"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentPropsWithoutRef, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import { Check, Copy, FileText, Lock, Sparkles } from "lucide-react";
import type { DateTime } from "ts-luxon";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { BaseCardCompactEditable } from "@/components/ui/base-card-compact-editable";
import { resolveAssignees } from "@/components/ui/coaching-sessions/action-card-parts";
import { ActionEditForm } from "@/components/ui/coaching-sessions/action-card-compact";
import { cn } from "@/components/lib/utils";
import { mayActOnSuggestion, suggestionDue } from "@/lib/utils/transcript-suggestions";
import { formatTimestamp } from "@/lib/utils/transcript-format-timestamp";
import { useTapTooltip } from "@/lib/hooks/use-tap-tooltip";
import type { Id } from "@/types/general";
import type { Goal } from "@/types/goal";
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
  /** The session's goals; shows the Linked goal row when editing. */
  goals?: Goal[];
  /** Some(edits) accepts with the reviewer's edits; None accepts as suggested. */
  onAccept?: (edits: Option<ActionEdits>) => Promise<void>;
  onDismiss?: () => Promise<void>;
  /** Brings an existing action into view. */
  onShowAction?: (actionId: Id) => void;
  /** Shows the quoted segment in the transcript. */
  onShowInTranscript?: (segmentId: Id) => void;
}

export function SuggestedActionCard(props: SuggestedActionCardProps) {
  const { onAccept } = props;
  return (
    <TooltipProvider delayDuration={300}>
      <div data-testid="suggested-action-card" className="min-w-0">
        <BaseCardCompactEditable
          editOnFlip
          faceClassName="border-dashed border-foreground/30 bg-card shadow-none hover:border-foreground/30"
          renderFront={({ onFlip }) => <SuggestionView {...props} onEdit={onFlip} />}
          renderBack={({ isEditing, onDone }) =>
            // Mounted only while showing, so each edit starts fresh.
            isEditing && onAccept ? (
              <SuggestionEditBack {...props} onAccept={onAccept} onClose={onDone} />
            ) : null
          }
        />
      </div>
    </TooltipProvider>
  );
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
  onShowAction,
  onShowInTranscript,
  onEdit,
}: SuggestedActionCardProps & { onEdit: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const { proposal, quote, segment, duplicate_of: duplicateOf } = suggestion;
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

  const { pending, run } = useInFlight();

  const showAction = duplicateOf.some
    ? () => onShowAction?.(duplicateOf.val.action_id)
    : undefined;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!confirming || e.key !== "Escape" || !e.currentTarget.contains(e.target as Node)) return;
    e.preventDefault();
    setConfirming(false);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2" onKeyDown={handleKeyDown}>
      <div className="flex min-h-6 items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Sparkles size={13} aria-hidden />
            Suggested
          </span>
          {duplicateOf.some && (
            <>
              <span aria-hidden className="text-muted-foreground/50">
                ·
              </span>
              <DuplicateMarker body={duplicateOf.val.body} onClick={showAction} />
            </>
          )}
        </div>
      </div>

      <SuggestionBody body={proposal.body ?? ""} />

      <figure className="flex min-w-0 flex-col gap-1 border-l-2 border-muted-foreground/30 pl-2.5 text-muted-foreground">
        <blockquote className="line-clamp-2 pr-1 text-xs italic leading-snug [overflow-wrap:anywhere]">
          {quote}
        </blockquote>
        <figcaption>
          <button
            type="button"
            title="Show in transcript"
            aria-label={`Show in transcript: ${source}`}
            onClick={() => onShowInTranscript?.(segment.id)}
            className="inline-flex items-center gap-1 self-start text-[11px] font-medium tabular-nums underline decoration-foreground/30 underline-offset-2 max-md:min-h-10"
          >
            <FileText size={11} aria-hidden />
            {source}
          </button>
        </figcaption>
      </figure>

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

      {mayAct &&
        (confirming && duplicateOf.some ? (
          <DuplicateConfirm
            body={duplicateOf.val.body}
            pending={pending}
            onShowAction={showAction}
            onAddAnyway={run(onAccept && (() => onAccept(None)))}
            onKeepExisting={run(onDismiss)}
            onCancel={() => setConfirming(false)}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
            <Button
              size="sm"
              className={ROW_BUTTON}
              disabled={pending}
              onClick={duplicateOf.some ? () => setConfirming(true) : run(onAccept && (() => onAccept(None)))}
            >
              <Check className="!h-3 !w-3" aria-hidden />
              Accept
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={ROW_BUTTON}
              disabled={pending}
              onClick={onAccept ? onEdit : undefined}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(ROW_BUTTON, "text-muted-foreground")}
              disabled={pending}
              onClick={run(onDismiss)}
            >
              Dismiss
            </Button>
          </div>
        ))}

      {!mayAct && (
        <p
          data-testid="suggested-action-lock-note"
          className="flex items-center gap-1.5 border-t border-dashed pt-2 text-[11px] text-muted-foreground"
        >
          <Lock size={11} aria-hidden />
          Only {coachName.split(" ")[0]} can accept or edit this action.
        </p>
      )}
    </div>
  );
}

function SuggestionEditBack({
  suggestion,
  viewerRole,
  locale,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  goals,
  onAccept,
  onDismiss,
  onShowAction,
  onClose,
}: SuggestedActionCardProps & {
  onAccept: (edits: Option<ActionEdits>) => Promise<void>;
  onClose: () => void;
}) {
  const { proposal, duplicate_of: duplicateOf } = suggestion;
  const [picked, setPicked] = useState<Option<DateTime>>(None);
  const [assigneeIds, setAssigneeIds] = useState<Id[]>(proposal.assignee_ids ?? []);
  const [goalId, setGoalId] = useState<Option<Id>>(proposal.goal_id);
  const [confirming, setConfirming] = useState<Option<ActionEdits>>(None);
  const { pending, run } = useInFlight();

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
  const action = {
    ...proposal,
    due_by: Some(picked.some ? picked.val : suggestionDue(suggestion, locale).at),
  };

  const toggleAssignee = (id: Id) =>
    setAssigneeIds((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );

  const accept = async (body: string, ids: Id[]) => {
    const edits: ActionEdits = {
      body,
      // An unspoken date stays unspoken unless the reviewer picks one.
      due_by: picked.some ? picked : proposal.due_by,
      assignee_ids: ids,
      goal_id: goalId,
    };
    if (duplicateOf.some) setConfirming(Some(edits));
    else await onAccept(Some(edits));
  };

  // Ignore Escape from portaled popovers, which bubbles here through React.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape" || !e.currentTarget.contains(e.target as Node)) return;
    e.preventDefault();
    if (confirming.some) setConfirming(None);
    else onClose();
  };

  return (
    <div className="flex flex-col gap-3" onKeyDown={handleKeyDown}>
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Sparkles size={13} aria-hidden />
        Edit suggestion
      </span>
      <ActionEditForm
        action={action}
        locale={locale}
        initialBody={proposal.body ?? ""}
        allAssignees={allAssignees}
        resolvedAssignees={resolvedAssignees}
        assigneeIds={assigneeIds}
        goals={goals}
        selectedGoalId={goalId.some ? goalId.val : undefined}
        onGoalSelect={(id) => setGoalId(id === undefined ? None : Some(id))}
        onDueDateChange={(date) => setPicked(Some(date))}
        onAssigneeToggle={toggleAssignee}
        assigneeDisabledReasons={disabledReasons}
        onSave={accept}
        onCancel={onClose}
        saveLabel="Accept"
        saveIcon={Check}
        buttonClassName="max-md:h-10 max-md:min-w-10"
        fieldsDisabled={confirming.some}
        footerOverride={
          confirming.some && duplicateOf.some ? (
            <DuplicateConfirm
              body={duplicateOf.val.body}
              pending={pending}
              onShowAction={() => onShowAction?.(duplicateOf.val.action_id)}
              onAddAnyway={run(() => onAccept(confirming))}
              onKeepExisting={run(onDismiss)}
              onCancel={() => setConfirming(None)}
            />
          ) : undefined
        }
      />
    </div>
  );
}

function DuplicateMarker({
  body,
  onClick,
}: {
  body: Option<string>;
  onClick?: () => void;
}) {
  const label = body.some
    ? `Possible duplicate of: ${body.val}`
    : "Possible duplicate of an existing action";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground max-md:min-h-10"
    >
      <Copy size={11} aria-hidden />
      Possible duplicate
    </button>
  );
}

const ROW_BUTTON = "h-6 gap-1 text-[11px] px-2 max-md:h-10 max-md:min-w-10";

/** Runs one request at a time; `pending` stays true while it is in flight. */
function useInFlight() {
  const [pending, setPending] = useState(false);
  const run =
    (handler?: () => Promise<unknown>) => async () => {
      if (!handler || pending) return;
      setPending(true);
      try {
        await handler();
      } finally {
        setPending(false);
      }
    };
  return { pending, run };
}

function DuplicateConfirm({
  body,
  pending,
  onShowAction,
  onAddAnyway,
  onKeepExisting,
  onCancel,
}: {
  body: Option<string>;
  pending: boolean;
  onShowAction?: () => void;
  onAddAnyway: () => void;
  onKeepExisting: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // The pressed Accept unmounts as the row opens, so focus moves here for Escape to reach it.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      data-testid="suggested-action-duplicate-confirm"
      className="flex flex-col gap-2 border-t border-dashed pt-2 outline-none"
    >
      <p className="text-[11px] text-muted-foreground [overflow-wrap:anywhere]">
        This looks like an action you already have:{" "}
        <button
          type="button"
          onClick={onShowAction}
          className="text-left italic text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground"
        >
          {body.some ? body.val : "the existing action"}
        </button>
      </p>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" className={ROW_BUTTON} disabled={pending} onClick={onAddAnyway}>
          <Check className="!h-3 !w-3" aria-hidden />
          Add anyway
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={ROW_BUTTON}
          disabled={pending}
          onClick={onKeepExisting}
        >
          Keep existing
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(ROW_BUTTON, "text-muted-foreground")}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
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
  const tap = useTapTooltip();
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

  return (
    <Tooltip {...tap.root}>
      <TooltipTrigger asChild>
        <button
          {...tap.trigger}
          type="button"
          data-testid="suggested-action-due"
          data-due-kind={kind}
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
