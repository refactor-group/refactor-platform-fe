"use client";

import type { KeyboardEvent, SyntheticEvent } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { PulsingDot, PulsingDotTone } from "@/components/ui/pulsing-dot";
import { useClickOrDoubleClick } from "@/lib/hooks/use-click-or-double-click";
import { timeOfDay } from "@/lib/session-window";
import {
  CardFooter,
  CardTense,
  cardNoteText,
  type CardNote,
  type CardView,
} from "@/lib/week-grid/card";
import { SessionCardMenu, type OnSessionAction } from "./session-card-menu";

export interface SessionCardHandlers {
  onAction: OnSessionAction;
  onSelect: (view: CardView) => void;
  onOpen: (view: CardView) => void;
  onMove?: (view: CardView) => void;
}

export enum SessionCardLayout {
  Grid = "grid",
  Agenda = "agenda",
}

export interface SessionCardProps extends SessionCardHandlers {
  view: CardView;
  dimmed?: boolean;
  layout?: SessionCardLayout;
}

export function SessionCard({
  view,
  dimmed = false,
  layout = SessionCardLayout.Grid,
  onAction,
  onSelect,
  onOpen,
  onMove,
}: SessionCardProps) {
  const isPast = view.tense === CardTense.Past;
  const isAgenda = layout === SessionCardLayout.Agenda;
  const canMove = !isPast && view.canManage;
  const time = timeOfDay(view.start);
  const clicks = useClickOrDoubleClick(
    () => onSelect(view),
    () => onOpen(view)
  );
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && e.target === e.currentTarget) onOpen(view);
  };

  return (
    <SessionCardMenu view={view} isCompact={isAgenda} onAction={onAction}>
      <div
        data-testid={`session-card-${view.session.id}`}
        data-tense={view.tense}
        data-dimmed={String(dimmed)}
        tabIndex={0}
        aria-label={`${time}, ${view.name}`}
        onClick={clicks.onClick}
        onDoubleClick={clicks.onDoubleClick}
        onKeyDown={onKeyDown}
        className={cn(
          "flex flex-col gap-1.5 rounded-xl p-[11px] outline-none",
          layout === SessionCardLayout.Grid && "min-h-[104px]",
          !isPast && view.canManage && "cursor-pointer",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isPast ? "bg-well" : "bg-card shadow-card",
          dimmed && "opacity-[.28]"
        )}
      >
        <span
          className={cn(
            "text-xs tabular-nums",
            isPast ? "text-faint" : "text-muted-foreground"
          )}
        >
          {time}
        </span>
        <span
          className={cn(
            "truncate text-[13px] font-semibold",
            isPast ? "text-muted-foreground" : "text-foreground"
          )}
        >
          {view.name}
        </span>
        <CardNoteLine note={view.note} />
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <CardFooterLine footer={view.footer} sessionId={view.session.id} />
          {isAgenda && (
            <div className="ml-auto flex items-center gap-2">
              {canMove && onMove && <CardButton label="Move" onClick={() => onMove(view)} />}
              <CardButton label="Open session" onClick={() => onOpen(view)} />
            </div>
          )}
        </div>
      </div>
    </SessionCardMenu>
  );
}

function stopPropagation(e: SyntheticEvent) {
  e.stopPropagation();
}

function CardButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="text-[13px]"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={stopPropagation}
      onKeyDown={stopPropagation}
    >
      {label}
    </Button>
  );
}

function CardNoteLine({ note }: { note: CardNote }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-tiny tabular-nums",
        note.kind === "noTopics" ? "text-warning-text" : "text-muted-foreground"
      )}
    >
      {note.kind === "relative" && note.pulse && (
        <PulsingDot tone={PulsingDotTone.Accent} className="h-1.5 w-1.5" />
      )}
      {cardNoteText(note)}
    </span>
  );
}

function CardFooterLine({ footer, sessionId }: { footer: CardFooter; sessionId: string }) {
  switch (footer) {
    case CardFooter.Ready:
      return (
        <span className="flex items-center gap-1 text-tiny font-medium text-positive">
          <Check className="h-3 w-3" aria-hidden />
          Ready
        </span>
      );
    case CardFooter.Prepare:
      return (
        <Link
          href={`/coaching-sessions/${sessionId}`}
          onClick={stopPropagation}
          onKeyDown={stopPropagation}
          className="inline-flex h-[26px] items-center gap-1 rounded-full bg-fill px-2.5 text-tiny font-medium text-foreground transition-colors duration-150 hover:bg-fill-hover"
        >
          Prepare
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      );
    case CardFooter.Done:
      return <span className="text-tiny font-medium text-faint">Done</span>;
    default: {
      const _exhaustive: never = footer;
      throw new Error(`Unhandled card footer: ${_exhaustive}`);
    }
  }
}
