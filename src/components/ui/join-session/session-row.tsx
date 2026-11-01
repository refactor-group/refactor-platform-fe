import { ChevronRight } from "lucide-react";
import type { DateTime } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import { PersonAvatar } from "@/components/ui/avatar";
import type { MenuPerson, MenuSession } from "@/components/ui/join-session/types";
import { listDate, timeOfDay } from "@/lib/session-window";
import type { Id } from "@/types/general";

type SessionRowProps =
  | {
      variant: "list";
      session: MenuSession;
      isCurrent: boolean;
      now: DateTime;
      onSelect: (id: Id) => void;
    }
  | {
      variant: "today";
      session: MenuSession;
      person: MenuPerson;
      onSelect: (id: Id) => void;
    };

const ROW_BASE =
  "flex w-full items-center gap-2.5 rounded-input text-left transition-colors duration-150 focus-visible:outline-none focus-visible:bg-fill";

function RowChevron() {
  return (
    <ChevronRight
      aria-hidden
      data-slot="row-chevron"
      className="h-[13px] w-[13px] shrink-0 text-faint"
    />
  );
}

function CurrentChip() {
  return (
    <span className="rounded-full border border-brand-border bg-card px-[7px] py-0.5 text-tiny text-brand">
      Current
    </span>
  );
}

function LiveDot() {
  return (
    <span
      aria-hidden
      className="h-1.5 w-1.5 rounded-full bg-primary animate-live-pulse"
    />
  );
}

function ListSubline({ session, isFuture }: { session: MenuSession; isFuture: boolean }) {
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 text-xs",
        session.liveness === "none" ? "text-muted-foreground" : "text-brand"
      )}
    >
      {session.liveness === "live" && <LiveDot />}
      {isFuture ? "Upcoming" : "Previous"}
    </span>
  );
}

interface ListRowProps {
  session: MenuSession;
  isCurrent: boolean;
  now: DateTime;
  onSelect: (id: Id) => void;
}

function ListRow({ session, isCurrent, now, onSelect }: ListRowProps) {
  const isFuture = session.start.toMillis() >= now.toMillis();
  return (
    <button
      type="button"
      aria-current={isCurrent ? "true" : undefined}
      onClick={() => onSelect(session.id)}
      className={cn(
        ROW_BASE,
        "min-h-11 px-2.5 py-[5px] hover:bg-well",
        isFuture && "opacity-75",
        isCurrent && "bg-brand-tint"
      )}
    >
      <span className="w-[92px] shrink-0 text-label tabular-nums text-muted-foreground">
        {listDate(session.start)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-item font-medium">{session.title}</span>
        <ListSubline session={session} isFuture={isFuture} />
      </span>
      {isCurrent ? <CurrentChip /> : <RowChevron />}
    </button>
  );
}

interface TodayRowProps {
  session: MenuSession;
  person: MenuPerson;
  onSelect: (id: Id) => void;
}

function TodayRow({ session, person, onSelect }: TodayRowProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(session.id)}
      className={cn(
        ROW_BASE,
        "min-h-12 px-2.5 py-1.5",
        session.liveness === "live" ? "bg-card" : "hover:bg-card/90"
      )}
    >
      <PersonAvatar userId={person.userId} initials={person.initials} size={28} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="text-item font-medium">{person.fullName}</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            Today · {timeOfDay(session.start)}
          </span>
        </span>
        <span className="block truncate text-label text-ink-2">{session.title}</span>
      </span>
      <RowChevron />
    </button>
  );
}

export function SessionRow(props: SessionRowProps) {
  switch (props.variant) {
    case "list":
      return (
        <ListRow
          session={props.session}
          isCurrent={props.isCurrent}
          now={props.now}
          onSelect={props.onSelect}
        />
      );
    case "today":
      return (
        <TodayRow session={props.session} person={props.person} onSelect={props.onSelect} />
      );
    default: {
      const _exhaustive: never = props;
      throw new Error(`Unhandled session row variant: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
