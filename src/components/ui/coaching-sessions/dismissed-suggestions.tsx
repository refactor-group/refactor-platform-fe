"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Lock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { mayActOnSuggestion } from "@/lib/utils/transcript-suggestions";
import { formatTimestamp } from "@/lib/utils/transcript-format-timestamp";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";
import { RelationshipRole } from "@/types/relationship-role";
import type { ActionSuggestion } from "@/types/transcript-suggestion";

export interface DismissedSuggestionsProps {
  suggestions: ActionSuggestion[];
  viewerRole: RelationshipRole;
  locale: string;
  coachId: Id;
  coachName: string;
  coacheeId: Id;
  coacheeName: string;
  /** Resolves true when the suggestion was restored. */
  onRestore?: (s: ActionSuggestion) => Promise<boolean>;
  /** Shows the quoted segment in the transcript. */
  onShowInTranscript?: (segmentId: Id) => void;
}

type RowProps = Omit<DismissedSuggestionsProps, "suggestions"> & {
  suggestion: ActionSuggestion;
};

const firstName = (name: string) => name.split(" ")[0];

export function DismissedSuggestions({ suggestions, ...rowProps }: DismissedSuggestionsProps) {
  const [open, setOpen] = useState(false);
  if (suggestions.length === 0) return null;

  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-4 flex flex-col gap-3">
      <CollapsibleTrigger className="flex items-center gap-1.5 self-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground max-md:min-h-10">
        <Chevron className="h-3.5 w-3.5" aria-hidden />
        Dismissed ({suggestions.length})
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-3">
        {suggestions.map((suggestion) => (
          <DismissedRow key={suggestion.id} suggestion={suggestion} {...rowProps} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function DismissedRow({
  suggestion,
  viewerRole,
  locale,
  coachId,
  coachName,
  coacheeId,
  coacheeName,
  onRestore,
  onShowInTranscript,
}: RowProps) {
  const [pending, setPending] = useState(false);
  const { proposal, quote, segment, resolved_by: resolvedBy, resolved_at: resolvedAt } = suggestion;
  const mayRestore = mayActOnSuggestion(
    viewerRole,
    { coachId, coacheeId },
    proposal.assignee_ids ?? [],
    None
  );

  const nameOf = (id: Id): Option<string> => {
    if (id === coachId) {
      return Some(viewerRole === RelationshipRole.Coach ? "you" : firstName(coachName));
    }
    if (id === coacheeId) {
      return Some(viewerRole === RelationshipRole.Coachee ? "you" : firstName(coacheeName));
    }
    return None;
  };
  const who = resolvedBy.some ? nameOf(resolvedBy.val) : None;
  const date = resolvedAt.some ? ` · ${resolvedAt.val.setLocale(locale).toFormat("LLL d")}` : "";
  const dismissedLabel = `${who.some ? `Dismissed by ${who.val}` : "Dismissed"}${date}`;
  const source = `${segment.speaker_label} · ${formatTimestamp(segment.start_ms)}`;

  const restore = async () => {
    if (!onRestore || pending) return;
    setPending(true);
    try {
      await onRestore(suggestion);
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      data-testid="dismissed-suggestion"
      className="flex min-w-0 flex-col gap-2 rounded-lg border bg-muted/30 p-3"
    >
      <p className="line-clamp-2 text-[13px] leading-[1.55] text-muted-foreground line-through [overflow-wrap:anywhere]">
        {proposal.body ?? ""}
      </p>
      <div className="flex min-w-0 flex-col gap-1 text-muted-foreground max-md:hidden">
        <p className="line-clamp-2 pr-1 text-xs italic leading-snug [overflow-wrap:anywhere]">
          “{quote}”
        </p>
        <button
          type="button"
          title="Show in transcript"
          aria-label={`Show in transcript: ${source}`}
          onClick={() => onShowInTranscript?.(segment.id)}
          className="inline-flex items-center gap-1 self-start text-[11px] font-medium tabular-nums underline decoration-foreground/30 underline-offset-2"
        >
          <FileText size={11} aria-hidden />
          {source}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span>{dismissedLabel}</span>
        {mayRestore ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 gap-1 text-[11px] px-2 max-md:h-10"
            disabled={pending || !onRestore}
            onClick={restore}
          >
            <RotateCcw className="!h-3 !w-3" aria-hidden />
            Restore
          </Button>
        ) : (
          <span className="flex items-center gap-1.5">
            <Lock size={11} aria-hidden />
            Only {firstName(coachName)} can restore it
          </span>
        )}
      </div>
    </div>
  );
}
