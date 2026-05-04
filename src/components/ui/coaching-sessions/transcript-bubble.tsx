"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/lib/utils";
import { formatTimestamp } from "@/lib/transcript/format-timestamp";
import type { BubbleGrouping } from "@/lib/transcript/group-bubbles";
import type { TranscriptSegment } from "@/types/transcription";

/**
 * Visual alignment in the transcript pane. Coach maps to `right`
 * (iMessage "me" side); coachee maps to `left` ("them" side).
 */
export type BubbleAlignment = "left" | "right";

/**
 * Bubble color theme. `primary` uses the iOS blue fill for the coach
 * ("outgoing"); `secondary` is the light/bordered variant for the
 * coachee ("incoming").
 */
export type BubbleVariant = "primary" | "secondary";

interface TranscriptBubbleProps {
  segment: TranscriptSegment;
  grouping: BubbleGrouping;
  alignment: BubbleAlignment;
  variant: BubbleVariant;
  /** Display name for the header; defaults to the raw speaker_label. */
  speakerDisplayName?: string;
  /** When true, force-render the header even if the grouping says collapse. */
  forceHeader?: boolean;
  /** Render-prop for injecting highlighted text (search mode); renders `text` directly otherwise. */
  renderText?: (text: string) => React.ReactNode;
}

/**
 * iMessage-style bubble for a single transcript segment.
 *
 * The bubble only owns its own clipboard feedback (`Copied` tick). All
 * layout decisions — grouping, alignment, variant — are inputs; the
 * parent orchestrator derives them from the overall transcript.
 */
export function TranscriptBubble({
  segment,
  grouping,
  alignment,
  variant,
  speakerDisplayName,
  forceHeader = false,
  renderText,
}: TranscriptBubbleProps) {
  const showHeader = forceHeader || grouping.isFirstOfGroup;
  const isRightAligned = alignment === "right";

  return (
    <div
      className={cn(
        "group flex flex-col",
        isRightAligned ? "items-end" : "items-start",
        showHeader ? "mt-4 first:mt-0" : "mt-0.5"
      )}
    >
      {showHeader && (
        <BubbleHeader
          segment={segment}
          alignment={alignment}
          speakerDisplayName={speakerDisplayName}
        />
      )}
      <BubbleBody
        segment={segment}
        grouping={grouping}
        alignment={alignment}
        variant={variant}
        renderText={renderText}
      />
    </div>
  );
}

interface BubbleHeaderProps {
  segment: TranscriptSegment;
  alignment: BubbleAlignment;
  speakerDisplayName?: string;
}

function BubbleHeader({ segment, alignment, speakerDisplayName }: BubbleHeaderProps) {
  const isRightAligned = alignment === "right";
  return (
    <div
      className={cn(
        "flex items-baseline gap-2 mb-1 px-1",
        isRightAligned ? "flex-row-reverse" : "flex-row"
      )}
    >
      <span className="text-[11px] font-semibold text-foreground/80">
        {speakerDisplayName ?? segment.speaker_label}
      </span>
      <span className="text-[10px] tabular-nums text-muted-foreground/70">
        {formatTimestamp(segment.start_ms)}
      </span>
      <CopyButton text={segment.text} />
    </div>
  );
}

interface BubbleBodyProps {
  segment: TranscriptSegment;
  grouping: BubbleGrouping;
  alignment: BubbleAlignment;
  variant: BubbleVariant;
  renderText?: (text: string) => React.ReactNode;
}

function BubbleBody({
  segment,
  grouping,
  alignment,
  variant,
  renderText,
}: BubbleBodyProps) {
  const isRightAligned = alignment === "right";
  return (
    <div
      data-testid="transcript-bubble-body"
      className={cn(
        "max-w-[80%] px-3.5 py-2 text-[15px] leading-[1.35] selection:bg-yellow-200 dark:selection:bg-yellow-500/30",
        variantClasses(variant),
        grouping.isLastOfGroup && tailCornerClass(isRightAligned)
      )}
    >
      {renderText ? renderText(segment.text) : segment.text}
    </div>
  );
}

function variantClasses(variant: BubbleVariant): string {
  if (variant === "primary") {
    return "bg-[#007AFF] text-white rounded-[18px]";
  }
  return "bg-white dark:bg-zinc-800 text-foreground rounded-[18px] border border-zinc-200 dark:border-zinc-700";
}

function tailCornerClass(isRightAligned: boolean): string {
  return isRightAligned ? "rounded-br-[6px]" : "rounded-bl-[6px]";
}

const COPY_FEEDBACK_MS = 1200;

interface CopyButtonProps {
  text: string;
}

function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const ok = await writeToClipboard(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    }
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-5 w-5 rounded text-muted-foreground/50 hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={handleCopy}
      aria-label={copied ? "Copied" : "Copy message"}
      title={copied ? "Copied" : "Copy message"}
    >
      {copied ? (
        <Check className="!h-3 !w-3" aria-hidden="true" />
      ) : (
        <Copy className="!h-3 !w-3" aria-hidden="true" />
      )}
      <span className="sr-only" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </Button>
  );
}

async function writeToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.clipboard) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
