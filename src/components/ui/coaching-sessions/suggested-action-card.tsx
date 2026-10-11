"use client";

import { useState } from "react";
import type { ComponentPropsWithoutRef, MouseEvent, PointerEvent, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { Check, FileText, Info, Lock, Quote, Sparkles, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { resolveAssignees } from "@/components/ui/coaching-sessions/action-card-parts";
import { cn } from "@/components/lib/utils";
import { mayActOnSuggestion, suggestionDue } from "@/lib/utils/transcript-suggestions";
import { formatTimestamp } from "@/lib/utils/transcript-format-timestamp";
import type { Id } from "@/types/general";
import { None } from "@/types/option";
import type { RelationshipRole } from "@/types/relationship-role";
import type { ActionSuggestion } from "@/types/transcript-suggestion";

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
}

export function SuggestedActionCard({
  suggestion,
  viewerRole,
  locale,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
}: SuggestedActionCardProps) {
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
              >
                <Info className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="Accept: add as action">
                <Check className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="Dismiss suggestion">
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
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground max-md:size-10",
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
