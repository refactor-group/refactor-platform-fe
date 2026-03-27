"use client";

import { cn } from "@/components/lib/utils";
import { useTextClamp } from "@/lib/hooks/use-text-clamp";

/**
 * A clamped text region that smoothly expands to reveal full content on click.
 *
 * Used by both CompactGoalCard (title + body) and CompactAgreementCard (body).
 * The clamped summary is always visible; clicking it slides open an overflow
 * section below with a max-height + opacity transition.
 *
 * @param text - The text shown in the clamped summary region
 * @param overflowText - The text shown in the expanded overflow section.
 *   Defaults to `text` if not provided. Pass a different value when the
 *   summary and overflow are distinct (e.g. goal title vs goal body).
 * @param hasOverflow - Force the overflow section to be expandable even
 *   when the summary text isn't clipped. Useful when `overflowText` differs
 *   from `text` (e.g. goal card always has expandable body).
 */
export interface ExpandableContentProps {
  text: string;
  className?: string;
  overflowText?: string;
  hasOverflow?: boolean;
}

export function ExpandableContent({
  text,
  className,
  overflowText,
  hasOverflow = false,
}: ExpandableContentProps) {
  const { ref, expanded, isClipped, toggle } = useTextClamp(text);
  const hasSeparateOverflow = Boolean(overflowText);
  const canExpand = isClipped || hasOverflow;

  return (
    <div
      className={cn("min-w-0", canExpand && "cursor-pointer")}
      onClick={canExpand ? toggle : undefined}
    >
      <span
        ref={ref}
        className={cn(
          // When there's no separate overflow text, remove the clamp on expand
          // to reveal the full text in place. When there IS separate overflow
          // text (e.g. goal body), keep the clamp and show the overflow below.
          !expanded || hasSeparateOverflow ? "line-clamp-2" : "",
          className
        )}
      >
        {text}
      </span>

      {hasSeparateOverflow && canExpand && (
        <div
          className={cn(
            "overflow-hidden transition-[max-height,opacity] duration-300 ease-in-out",
            expanded ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
          )}
        >
          <p className="text-[12px] leading-relaxed whitespace-pre-wrap border-t border-border/30 pt-2">
            {overflowText}
          </p>
        </div>
      )}
    </div>
  );
}
