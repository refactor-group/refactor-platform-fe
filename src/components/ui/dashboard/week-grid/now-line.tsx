import type { ReactNode } from "react";
import type { DateTime } from "ts-luxon";
import { timeOfDay } from "@/lib/session-window";
import type { GridCard } from "@/lib/week-grid/card";
import { nowLineIndex } from "@/lib/week-grid/week";
import type { Option } from "@/types/option";

// Two pixels tall, so the time overhangs into the gaps instead of pushing cards down.
function NowLine({ now }: { now: DateTime }) {
  const time = timeOfDay(now);
  return (
    <div role="separator" aria-label={`Now, ${time}`} className="flex h-0.5 items-center gap-1">
      <span className="size-1.5 shrink-0 rounded-full bg-brand" />
      <span className="h-px flex-1 bg-brand" />
      <span className="shrink-0 text-[10.5px] font-medium leading-none tabular-nums text-brand">{time}</span>
    </div>
  );
}

/** Slots the now line among a day's rendered cards, or above its empty state. */
export function withNowLine(nodes: ReactNode[], cards: GridCard[], now: Option<DateTime>): ReactNode[] {
  if (now.none) return nodes;
  for (const [live, { elapsed }] of cards.entries()) {
    if (elapsed.some) return nodes.map((node, i) => (i === live ? withNowDot(node, elapsed.val, now.val) : node));
  }
  const at = nowLineIndex(cards, (c) => c.start, now.val);
  return [...nodes.slice(0, at), <NowLine key="now-line" now={now.val} />, ...nodes.slice(at)];
}

// A session under way shows only the line's dot, on its left edge where the card's fill ends.
function withNowDot(node: ReactNode, elapsed: number, now: DateTime): ReactNode {
  return (
    <div key="now-line" className="relative">
      {node}
      <span
        role="separator"
        aria-label={`Now, ${timeOfDay(now)}`}
        className="pointer-events-none absolute left-0 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand"
        style={{ top: `${elapsed * 100}%` }}
      />
    </div>
  );
}
