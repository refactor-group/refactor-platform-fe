"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import type { DateTime } from "ts-luxon";
import { cn } from "@/components/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PersonAvatar } from "@/components/ui/avatar";
import { PulsingDot, PulsingDotTone } from "@/components/ui/pulsing-dot";
import { CardError } from "@/components/ui/errors/card-error";
import { PanelSection } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";
import { NextSessionCardEmpty } from "@/components/ui/dashboard/next-session-card-empty";
import { NextSessionLabel } from "@/components/ui/dashboard/next-session-label";
import {
  NextSessionGlance,
  GlanceValueKind,
  GLANCE_HEADER_CLASS,
  GLANCE_ROW_CLASS,
  type GlanceRow,
  type GlanceValue,
} from "@/components/ui/dashboard/next-session-glance";
import { useNextSession } from "@/lib/hooks/use-next-session";
import { useActionsDue } from "@/lib/hooks/use-actions-due";
import { useUserTimezone } from "@/lib/hooks/use-user-timezone";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { ActionsDueKind, type ActionsDueSummary } from "@/lib/actions-due";
import { nextSessionHeadline, nextSessionWhen } from "@/lib/next-session-copy";
import { otherParticipantInSession } from "@/lib/participants";
import { initialsOf } from "@/lib/people";
import { sessionStartIn } from "@/lib/session-window";
import { calculateSessionUrgency } from "@/lib/utils/session";
import type { CoachingSession, EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";

interface NextSessionCardProps {
  /** Opens the New session dialog from the empty state. */
  onCreateSession: () => void;
  /** Hands the parent the week refresh so it can revalidate after a series changes. */
  onRefreshNeeded?: (refresh: () => void) => void;
}

enum ShellTone {
  Hero = "hero",
  Plain = "plain",
}

function shellToneClass(tone: ShellTone): string {
  switch (tone) {
    case ShellTone.Hero:
      return "border-brand-border bg-hero-wash";
    case ShellTone.Plain:
      return "shadow-none";
    default: {
      const _exhaustive: never = tone;
      throw new Error(`Unhandled shell tone: ${_exhaustive}`);
    }
  }
}

function NextSessionShell({ tone, children }: { tone: ShellTone; children: ReactNode }) {
  return (
    <Card
      data-testid="next-session-card"
      className={cn("flex min-h-[420px] flex-col p-[22px]", shellToneClass(tone))}
    >
      {children}
    </Card>
  );
}

function PlaceholderBar({ className }: { className: string }) {
  return <span aria-hidden className={cn("block rounded-md bg-fill", className)} />;
}

// Mirrors NextSessionBody's layout and line heights so the card keeps its height when data lands.
function NextSessionCardLoading() {
  return (
    <NextSessionShell tone={ShellTone.Hero}>
      <div aria-busy="true" className="flex flex-1 flex-col">
        <span className="sr-only">Loading your next session</span>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <NextSessionLabel />
            <div className="mt-2.5 text-subhead leading-[1.12]">
              <PlaceholderBar className="h-[1.12em] w-4/5" />
              <PlaceholderBar className="h-[1.12em] w-3/5" />
            </div>
          </div>
          <PlaceholderBar className="h-10 w-10 shrink-0 rounded-full" />
        </div>
        <p className="mt-3 flex items-center gap-2 text-label tabular-nums">
          <PlaceholderBar className="h-[1.4em] w-20" />
        </p>
        <div data-testid="glance-placeholder-header" className={GLANCE_HEADER_CLASS}>
          <PlaceholderBar className="h-[1.4em] w-20" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            data-testid="glance-placeholder-row"
            className={cn(GLANCE_ROW_CLASS, i === 3 && "border-b")}
          >
            <PlaceholderBar className="h-[1.5em] w-28" />
            <PlaceholderBar className="ml-auto h-[1.5em] w-10" />
          </div>
        ))}
        <div className="mt-auto pt-4">
          <PlaceholderBar className="h-10 min-h-11 rounded-full sm:min-h-10" />
        </div>
      </div>
    </NextSessionShell>
  );
}

function NextSessionCardError({ retry }: { retry: () => void }) {
  return (
    <NextSessionShell tone={ShellTone.Plain}>
      <NextSessionLabel />
      <CardError title="Couldn't load your next session" retry={Some(retry)} />
    </NextSessionShell>
  );
}

function actionsDueValue(summary: ActionsDueSummary, loading: boolean, error: boolean): GlanceValue {
  if (loading) return { kind: GlanceValueKind.Text, text: "" };
  if (error) return { kind: GlanceValueKind.Text, text: "Couldn't load" };
  switch (summary.kind) {
    case ActionsDueKind.None:
      return { kind: GlanceValueKind.Text, text: "None" };
    case ActionsDueKind.Count:
      return { kind: GlanceValueKind.Text, text: String(summary.count) };
    case ActionsDueKind.Overdue:
      return { kind: GlanceValueKind.Overdue, text: `${summary.overdue} overdue` };
    default: {
      const _exhaustive: never = summary;
      throw new Error(`Unhandled actions due summary: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function panelHref(sessionId: Id, panel: PanelSection): string {
  return `/coaching-sessions/${sessionId}?panel=${panel}`;
}

// Holds an inert slot unless there is a previous session, so the list stays four rows.
function agreementsRow(loading: boolean, previous: Option<CoachingSession>): GlanceRow {
  const row = { label: "Agreements from last session", value: { kind: GlanceValueKind.None } } as const;
  if (loading || previous.none) return { ...row, href: "#", hidden: true };
  return { ...row, href: panelHref(previous.val.id, PanelSection.Agreements), hidden: false };
}

function glanceRows(
  session: EnrichedCoachingSession,
  summary: ActionsDueSummary,
  actionsLoading: boolean,
  actionsError: boolean,
  previous: Option<CoachingSession>
): GlanceRow[] {
  const topicCount = session.topics.some ? session.topics.val.length : 0;
  const goalCount = session.goals?.length ?? 0;
  const topics: GlanceRow = {
    label: "Topics",
    value: { kind: GlanceValueKind.Text, text: topicCount > 0 ? String(topicCount) : "None yet" },
    href: panelHref(session.id, PanelSection.Topics),
    hidden: false,
  };
  const actions: GlanceRow = {
    label: "Actions due",
    value: actionsDueValue(summary, actionsLoading, actionsError),
    href: `${panelHref(session.id, PanelSection.Actions)}&actions=due`,
    hidden: false,
  };
  const agreements = agreementsRow(actionsLoading, previous);
  const goals: GlanceRow = {
    label: "Goals",
    value: { kind: GlanceValueKind.Text, text: goalCount > 0 ? `${goalCount} active` : "None yet" },
    href: panelHref(session.id, PanelSection.Goals),
    hidden: false,
  };
  return [topics, actions, agreements, goals];
}

function NextSessionBody({
  session,
  viewerId,
  now,
}: {
  session: EnrichedCoachingSession;
  viewerId: Id;
  now: DateTime;
}) {
  const timezone = useUserTimezone();
  const start = sessionStartIn(session.date, timezone);
  const urgency = calculateSessionUrgency(session, now);
  const other = otherParticipantInSession(session, viewerId);
  const headline = nextSessionHeadline(other.some ? Some(other.val.first_name) : None, start, now);
  const when = nextSessionWhen(start, now, urgency);
  const {
    summary,
    previous,
    isLoading: actionsLoading,
    isError: actionsError,
  } = useActionsDue(session, viewerId, now);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <NextSessionLabel />
          <h3 className="mt-2.5 text-subhead leading-[1.12] break-words">{headline}</h3>
        </div>
        {other.some && (
          <PersonAvatar
            userId={other.val.id}
            initials={initialsOf(other.val.first_name, other.val.last_name)}
            size={40}
            className="shrink-0"
          />
        )}
      </div>
      <p
        className={cn(
          "mt-3 flex items-center gap-2 text-label tabular-nums",
          when.hot ? "text-brand" : "text-muted-foreground"
        )}
      >
        {when.hot && <PulsingDot tone={PulsingDotTone.Accent} className="h-1.5 w-1.5" />}
        {when.text}
      </p>
      <NextSessionGlance rows={glanceRows(session, summary, actionsLoading, actionsError, previous)} />
      <div className="mt-auto pt-4">
        <Button asChild className="w-full min-h-11 sm:min-h-10">
          <Link href={`/coaching-sessions/${session.id}`}>Open session</Link>
        </Button>
      </div>
    </>
  );
}

/** The dashboard's hero card: the viewer's next session this week, or an invitation to schedule one. */
export function NextSessionCard({ onCreateSession, onRefreshNeeded }: NextSessionCardProps) {
  const { session, isLoading, isError, refresh, now } = useNextSession();
  const userId = useAuthStore((s) => s.userId);
  const canSchedule = useAuthStore((s) => s.canScheduleSessions);

  useEffect(() => onRefreshNeeded?.(refresh), [onRefreshNeeded, refresh]);

  if (!userId || isLoading) return <NextSessionCardLoading />;
  if (isError) return <NextSessionCardError retry={refresh} />;

  return (
    <NextSessionShell tone={ShellTone.Hero}>
      {session.none ? (
        <NextSessionCardEmpty canSchedule={canSchedule} onCreateSession={onCreateSession} />
      ) : (
        <NextSessionBody session={session.val} viewerId={userId} now={now} />
      )}
    </NextSessionShell>
  );
}
