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
import {
  NextSessionGlance,
  GlanceValueKind,
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
import { Some, type Option } from "@/types/option";

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
    <Card className={cn("flex min-h-[420px] flex-col p-[22px]", shellToneClass(tone))}>
      {children}
    </Card>
  );
}

function NextSessionLabel() {
  return <p className="text-label font-medium text-ink-2">Next session</p>;
}

function NextSessionCardLoading() {
  return (
    <NextSessionShell tone={ShellTone.Hero}>
      <div aria-busy="true" className="flex flex-1 flex-col">
        <span className="sr-only">Loading your next session</span>
        <div className="h-3 w-24 rounded-md bg-fill" />
        <div className="mt-3 h-7 w-4/5 rounded-md bg-fill" />
        <div className="mt-1.5 h-7 w-3/5 rounded-md bg-fill" />
        <div className="mt-4 h-3 w-20 rounded-md bg-fill" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="mt-6 h-3.5 w-full rounded-md bg-fill" />
        ))}
        <div className="mt-auto h-10 rounded-full bg-fill" />
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

function actionsDueValue(summary: ActionsDueSummary, loading: boolean): GlanceValue {
  if (loading) return { kind: GlanceValueKind.Text, text: "" };
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

function glanceRows(
  session: EnrichedCoachingSession,
  summary: ActionsDueSummary,
  actionsLoading: boolean,
  previous: Option<CoachingSession>
): GlanceRow[] {
  const topicCount = session.topics.some ? session.topics.val.length : 0;
  const goalCount = session.goals?.length ?? 0;
  const topics: GlanceRow = {
    label: "Topics",
    value: { kind: GlanceValueKind.Text, text: topicCount > 0 ? String(topicCount) : "None yet" },
    href: panelHref(session.id, PanelSection.Topics),
  };
  const actions: GlanceRow = {
    label: "Actions due",
    value: actionsDueValue(summary, actionsLoading),
    href: `${panelHref(session.id, PanelSection.Actions)}&actions=due`,
  };
  const agreements: GlanceRow[] = previous.some
    ? [
        {
          label: "Agreements from last session",
          value: { kind: GlanceValueKind.None },
          href: panelHref(previous.val.id, PanelSection.Agreements),
        },
      ]
    : [];
  const goals: GlanceRow = {
    label: "Goals",
    value: { kind: GlanceValueKind.Text, text: goalCount > 0 ? `${goalCount} active` : "None yet" },
    href: panelHref(session.id, PanelSection.Goals),
  };
  return [topics, actions, ...agreements, goals];
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
  const firstName = other.some ? other.val.first_name : "";
  const headline = nextSessionHeadline(firstName, start, now);
  const when = nextSessionWhen(start, now, urgency);
  const { summary, previous, isLoading: actionsLoading } = useActionsDue(session, viewerId, now);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <NextSessionLabel />
          <h3 className="mt-2.5 text-headline leading-[1.12] break-words">{headline}</h3>
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
      <NextSessionGlance rows={glanceRows(session, summary, actionsLoading, previous)} />
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
