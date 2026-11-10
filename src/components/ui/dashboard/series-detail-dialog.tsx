"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DateTime } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { PersonHeader } from "@/components/ui/person-header";
import { Pill } from "@/components/ui/pill";
import { Spinner } from "@/components/ui/spinner";
import { StepDialog, StepDialogHeight, StepDialogVariant } from "@/components/ui/step-dialog";
import type { MenuPerson } from "@/components/ui/join-session/types";
import { useCoachingSessionSeries } from "@/lib/api/coaching-session-series";
import { relativeDayText } from "@/lib/scheduling-copy";
import { sessionStartIn } from "@/lib/session-window";
import { type CoachingSession, isPastSession } from "@/types/coaching-session";
import {
  type CoachingSessionSeries,
  seriesEndText,
  seriesRepeatsText,
} from "@/types/coaching-session-series";
import { None, type Option } from "@/types/option";

export interface SeriesDetailDialogProps {
  series: Option<CoachingSessionSeries>;
  person: Option<MenuPerson>;
  userTimezone: string;
  onClose: () => void;
}

const PAGE_SIZE = 10;

enum SessionRowStatus {
  Previous = "previous",
  Soonest = "soonest",
  Later = "later",
}

interface SessionRow {
  session: CoachingSession;
  status: SessionRowStatus;
}

type SessionsLoad =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "loaded"; rows: SessionRow[] };

interface Fact {
  label: string;
  value: string;
}

// ─── Pure formatting ─────────────────────────────────────────────────

/** "Tue, Nov 10 · 4:30 PM", with ", 2027" after the date when it isn't this year. */
function sessionRowText(start: DateTime, now: DateTime): string {
  const year = start.year === now.setZone(start.zone).year ? "" : start.toFormat(", yyyy");
  return `${start.toFormat("ccc, LLL d")}${year} · ${start.toFormat("h:mm a")}`;
}

/** Past sessions are previous; the first one after them is the soonest. */
function sessionRows(sessions: CoachingSession[]): SessionRow[] {
  const past = sessions.map((session) => isPastSession(session));
  const soonestIndex = past.indexOf(false);
  return sessions.map((session, i) => ({
    session,
    status: past[i] ? SessionRowStatus.Previous : i === soonestIndex ? SessionRowStatus.Soonest : SessionRowStatus.Later,
  }));
}

function sessionCountsText(rows: SessionRow[]): string {
  const previous = rows.filter((row) => row.status === SessionRowStatus.Previous).length;
  return `${rows.length - previous} upcoming · ${previous} previous`;
}

function sessionsLoad(
  sessions: CoachingSession[],
  { isLoading, isError }: { isLoading: boolean; isError: boolean }
): SessionsLoad {
  if (isLoading) return { kind: "loading" };
  if (isError) return { kind: "error" };
  return { kind: "loaded", rows: sessionRows(sessions) };
}

function seriesFacts(series: CoachingSessionSeries, load: SessionsLoad): Fact[] {
  const facts = [
    { label: "Repeats", value: seriesRepeatsText(series.rule) },
    { label: "Ends", value: seriesEndText(series.rule) },
  ];
  return load.kind === "loaded" && load.rows.length > 0
    ? [...facts, { label: "Sessions", value: sessionCountsText(load.rows) }]
    : facts;
}

// ─── Rail ────────────────────────────────────────────────────────────

function SeriesRailHeader({ person, facts }: { person: Option<MenuPerson>; facts: Fact[] }) {
  return (
    <div className="space-y-4">
      {person.some && (
        <PersonHeader
          userId={person.val.userId}
          initials={person.val.initials}
          fullName={person.val.fullName}
          detail={None}
        />
      )}
      <dl className="-mx-2">
        {facts.map((fact) => (
          <div key={fact.label} className="p-2.5">
            <dt className="text-xs font-medium text-muted-foreground">{fact.label}</dt>
            <dd className="text-item font-medium tabular-nums text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ─── Pane ────────────────────────────────────────────────────────────

function RowStatusLabel({ status, start, now }: { status: SessionRowStatus; start: DateTime; now: DateTime }) {
  switch (status) {
    case SessionRowStatus.Previous:
      return <span className="text-xs text-muted-foreground">Previous</span>;
    case SessionRowStatus.Soonest:
      return <Pill className="bg-brand-tint text-brand-strong">{relativeDayText(start, now)}</Pill>;
    case SessionRowStatus.Later:
      return null;
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled SessionRowStatus: ${_exhaustive}`);
    }
  }
}

function SessionRowLink({ row, timezone, now }: { row: SessionRow; timezone: string; now: DateTime }) {
  const start = sessionStartIn(row.session.date, timezone);
  return (
    <Link
      href={`/coaching-sessions/${row.session.id}`}
      className="flex min-h-11 items-center gap-3 px-4 outline-none transition-colors duration-150 hover:bg-well focus-visible:bg-fill"
    >
      <span
        className={cn(
          "flex-1 text-item font-medium tabular-nums",
          row.status === SessionRowStatus.Previous ? "text-muted-foreground" : "text-foreground"
        )}
      >
        {sessionRowText(start, now)}
      </span>
      <RowStatusLabel status={row.status} start={start} now={now} />
      <ChevronRight aria-hidden className="h-4 w-4 text-faint" />
    </Link>
  );
}

function SessionList({ rows, timezone }: { rows: SessionRow[]; timezone: string }) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const visible = rows.slice(0, visibleCount);
  const remaining = rows.length - visible.length;
  const now = DateTime.now();
  return (
    <>
      <ul className="divide-y divide-hairline overflow-hidden rounded-xl border bg-card">
        {visible.map((row) => (
          <li key={row.session.id}>
            <SessionRowLink row={row} timezone={timezone} now={now} />
          </li>
        ))}
      </ul>
      {remaining > 0 && (
        <div className="flex justify-center pt-3">
          <Button variant="tertiary" size="sm" onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
            View {Math.min(remaining, PAGE_SIZE)} more
          </Button>
        </div>
      )}
    </>
  );
}

function SessionsBody({ load, timezone }: { load: SessionsLoad; timezone: string }) {
  switch (load.kind) {
    case "loading":
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner aria-hidden /> Loading sessions…
        </p>
      );
    case "error":
      return <p className="text-sm text-destructive">Couldn&apos;t load this series&apos; sessions.</p>;
    case "loaded":
      return load.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">This series has no sessions.</p>
      ) : (
        <SessionList rows={load.rows} timezone={timezone} />
      );
    default: {
      const _exhaustive: never = load;
      throw new Error(`Unhandled SessionsLoad: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

// ─── Dialog ──────────────────────────────────────────────────────────

export function SeriesDetailDialog({ series, ...props }: SeriesDetailDialogProps) {
  if (series.none) return null;
  return <SeriesDetailView key={series.val.id} series={series.val} {...props} />;
}

/** Mounted only with a loaded series, so the fetch always gets a real id. */
function SeriesDetailView({
  series,
  person,
  userTimezone,
  onClose,
}: Omit<SeriesDetailDialogProps, "series"> & { series: CoachingSessionSeries }) {
  const { series: detail, isLoading, isError } = useCoachingSessionSeries(series.id, userTimezone);
  const load = sessionsLoad(detail.coaching_sessions, { isLoading, isError });
  return (
    <StepDialog
      open
      onClose={onClose}
      title="Recurring series"
      height={StepDialogHeight.Standard}
      variant={StepDialogVariant.Single}
      railHeader={<SeriesRailHeader person={person} facts={seriesFacts(series, load)} />}
      steps={[]}
      stepTitle="Sessions"
      lead={{ kind: "none" }}
      position={{ index: 1, total: 1 }}
      onPrev={None}
      onNext={None}
    >
      <SessionsBody load={load} timezone={userTimezone} />
    </StepDialog>
  );
}
