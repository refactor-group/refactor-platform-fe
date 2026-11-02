"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { DateTime } from "ts-luxon";
import { ChevronRight } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { StatusGlyph } from "@/components/ui/status/status-glyph";
import { StatusMenu } from "@/components/ui/status/status-menu";
import { StatusMetaLine } from "@/components/ui/status/status-meta-line";
import { StatusPill } from "@/components/ui/status/status-pill";
import { ItemStatus, actionStatusToString } from "@/types/general";
import type { Option } from "@/types/option";

interface ActionStatusRowProps {
  title: string;
  status: ItemStatus;
  dueBy: Option<DateTime>;
  statusChangedAt: DateTime;
  /** Where the row goes: the action in its session. */
  href: string;
  locale: string;
  /** When given, the glyph and pill open the status menu; otherwise they only show the status. */
  onStatusChange?: (status: ItemStatus) => void;
  className?: string;
}

/**
 * The design system's compact action row: glyph, title over its meta line,
 * pill and chevron. No assignee; the surrounding card names the person.
 */
export function ActionStatusRow({
  title,
  status,
  dueBy,
  statusChangedAt,
  href,
  locale,
  onStatusChange,
  className,
}: ActionStatusRowProps) {
  const closed = status === ItemStatus.Completed || status === ItemStatus.WontDo;

  return (
    <div
      className={cn(
        "relative flex items-center gap-3 rounded-input px-3 py-3 transition-colors hover:bg-well",
        className
      )}
    >
      <StatusTarget status={status} onStatusChange={onStatusChange}>
        <StatusGlyph status={status} decorative={Boolean(onStatusChange)} className="shrink-0" />
      </StatusTarget>
      <div className="min-w-0 flex-1">
        {/* Stretched over the row so the whole row opens the action. */}
        <Link
          href={href}
          className={cn(
            "block truncate text-item font-medium leading-snug after:absolute after:inset-0 after:rounded-input focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring",
            closed && "text-muted-foreground"
          )}
        >
          {title}
        </Link>
        <StatusMetaLine
          status={status}
          dueBy={dueBy}
          statusChangedAt={statusChangedAt}
          locale={locale}
          className="mt-0.5 block"
        />
      </div>
      <StatusTarget status={status} onStatusChange={onStatusChange} pointerOnly>
        <StatusPill status={status} className="shrink-0" />
      </StatusTarget>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-faint" aria-hidden />
    </div>
  );
}

/** Wraps the glyph or pill in a status-menu button when the status can be set. */
function StatusTarget({
  status,
  onStatusChange,
  pointerOnly = false,
  children,
}: {
  status: ItemStatus;
  onStatusChange?: (status: ItemStatus) => void;
  /** A second target for the same menu: clickable, but skipped by keyboard and screen readers. */
  pointerOnly?: boolean;
  children: ReactNode;
}) {
  if (!onStatusChange) return <>{children}</>;
  return (
    <StatusMenu status={status} onStatusChange={onStatusChange} align="end">
      <button
        type="button"
        aria-label={pointerOnly ? undefined : `Status: ${actionStatusToString(status)}`}
        aria-hidden={pointerOnly || undefined}
        tabIndex={pointerOnly ? -1 : undefined}
        // Above the stretched link, so it opens the menu rather than the action.
        className="relative z-10 inline-flex shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </button>
    </StatusMenu>
  );
}
