"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronUp } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { OVERDUE_META_CLASS } from "@/components/ui/status/status-meta";

export enum GlanceValueKind {
  Text = "text",
  Overdue = "overdue",
  /** Chevron only. */
  None = "none",
}

export type GlanceValue =
  | { kind: GlanceValueKind.Text; text: string }
  | { kind: GlanceValueKind.Overdue; text: string }
  | { kind: GlanceValueKind.None };

export interface GlanceRow {
  label: string;
  value: GlanceValue;
  href: string;
}

function GlanceRowValue({ value }: { value: GlanceValue }) {
  switch (value.kind) {
    case GlanceValueKind.Text:
      return <span className="ml-auto tabular-nums text-muted-foreground">{value.text}</span>;
    case GlanceValueKind.Overdue:
      return <span className={cn("ml-auto tabular-nums", OVERDUE_META_CLASS)}>{value.text}</span>;
    case GlanceValueKind.None:
      return null;
    default: {
      const _exhaustive: never = value;
      throw new Error(`Unhandled glance value: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function GlanceRowLink({ row, last }: { row: GlanceRow; last: boolean }) {
  return (
    <li>
      <Link
        href={row.href}
        className={cn(
          "flex items-center gap-2.5 border-t py-2.5 text-[13px] text-foreground min-h-11 sm:min-h-0",
          last && "border-b"
        )}
      >
        {row.label}
        <GlanceRowValue value={row.value} />
        <ChevronRight
          className={cn("h-[13px] w-[13px] text-faint", row.value.kind === GlanceValueKind.None && "ml-auto")}
          aria-hidden
        />
      </Link>
    </li>
  );
}

/** Collapsible "At a glance" list for the Next session card. Opens on every mount. */
export function NextSessionGlance({ rows }: { rows: GlanceRow[] }) {
  const [open, setOpen] = useState(true);
  const listId = useId();

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="mt-6 flex w-full items-center justify-between border-t py-3 text-item font-semibold min-h-11 sm:min-h-0"
      >
        At a glance
        <ChevronUp className={cn("h-3.5 w-3.5 text-faint", !open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <ul id={listId}>
          {rows.map((row, i) => (
            <GlanceRowLink key={row.label} row={row} last={i === rows.length - 1} />
          ))}
        </ul>
      )}
    </div>
  );
}
