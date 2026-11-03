"use client";

import type { DateTime } from "ts-luxon";
import { Button } from "@/components/ui/button";
import type { BusyClash, BusySession } from "@/lib/scheduling";
import {
  busyHeader,
  busyRange,
  insteadLabel,
  nothingElseLine,
  overlapLine,
} from "@/lib/scheduling-copy";
import type { Option } from "@/types/option";

interface BusyNoteProps {
  day: DateTime;
  sessions: BusySession[];
  clash: Option<BusyClash>;
  onUseInstead: (start: DateTime) => void;
}

function ClashPill({ clash, onUseInstead }: { clash: BusyClash; onUseInstead: (start: DateTime) => void }) {
  return (
    <p className="-mx-3 -my-1.5 rounded-[12px] border bg-well px-3 py-1.5 leading-[1.5] text-foreground font-medium tabular-nums">
      {overlapLine(clash.session)}
      {clash.instead.some && (
        <>
          {" · "}
          <InsteadButton start={clash.instead.val} onUseInstead={onUseInstead} />
        </>
      )}
    </p>
  );
}

function InsteadButton({ start, onUseInstead }: { start: DateTime; onUseInstead: (start: DateTime) => void }) {
  return (
    <Button
      type="button"
      variant="link"
      size={null}
      onClick={() => onUseInstead(start)}
      className="h-auto p-0 align-baseline text-xs font-medium"
    >
      {insteadLabel(start)}
    </Button>
  );
}

function BusyList({ day, sessions }: { day: DateTime; sessions: BusySession[] }) {
  return (
    <div>
      <p className="text-muted-foreground">{busyHeader(day)}</p>
      <ul className="mt-1.5">
        {sessions.map((session) => (
          <li
            key={session.id}
            className="flex items-center justify-between gap-4 border-t border-hairline py-1.5"
          >
            <span className="truncate text-foreground">{session.personName}</span>
            <span className="shrink-0 text-muted-foreground tabular-nums">{busyRange(session)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BusyNote({ day, sessions, clash, onUseInstead }: BusyNoteProps) {
  return (
    <div className="text-xs">
      {clash.some ? (
        <ClashPill clash={clash.val} onUseInstead={onUseInstead} />
      ) : sessions.length === 0 ? (
        <p className="text-muted-foreground">{nothingElseLine(day)}</p>
      ) : (
        <BusyList day={day} sessions={sessions} />
      )}
    </div>
  );
}
