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
      className="inline-flex h-auto min-h-11 items-center p-0 align-baseline text-xs font-medium modal:min-h-0"
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
            className="flex items-start justify-between gap-4 border-t border-hairline py-1.5"
          >
            <span className="line-clamp-2 min-w-0 break-words text-foreground">{session.personName}</span>
            <span className="shrink-0 whitespace-nowrap text-muted-foreground tabular-nums">{busyRange(session)}</span>
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
