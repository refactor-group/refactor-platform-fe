"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ResultAsync, okAsync } from "neverthrow";
import { useSWRConfig } from "swr";
import type { DateTime } from "ts-luxon";
import {
  type OtherMove,
  otherMoveFailedMessage,
  rescheduledMessage,
  scheduledMessage,
} from "@/components/ui/dashboard/session-change-message";
import { CoachingSessionApi } from "@/lib/api/coaching-sessions";
import { CoachingSessionSeriesApi } from "@/lib/api/coaching-session-series";
import { SessionWrite, sessionWriteFailure } from "@/lib/api/coaching-session-errors";
import { revalidateEndpointCaches } from "@/lib/hooks/use-sse-cache-invalidation";
import { followingPayload } from "@/lib/move-draft";
import { seriesPayload, sessionPayload } from "@/lib/schedule-draft";
import type { RepeatChoice } from "@/lib/scheduling";
import { toSessionDate } from "@/lib/session-window";
import { toast } from "@/lib/toast";
import { siteConfig } from "@/site.config";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import type { Provider } from "@/types/provider";
import type { Frequency, RecurrenceEnd, Weekday } from "@/types/recurrence";

interface OtherSessionMove {
  session: EnrichedCoachingSession;
  personName: string;
  start: DateTime;
}

interface MovePlan {
  session: EnrichedCoachingSession;
  personName: string;
  start: DateTime;
  minutes: number;
  moveOther: Option<OtherSessionMove>;
}

/** Everything a submit needs, chosen and valid. */
export type SessionPlan =
  | {
      kind: "schedule";
      relationshipId: Id;
      personName: string;
      start: DateTime;
      minutes: number;
      provider: Option<Provider>;
      repeat: RepeatChoice;
      byWeekdays: Weekday[];
      timezone: string;
      moveOther: Option<OtherSessionMove>;
    }
  | ({ kind: "move" } & MovePlan)
  | ({
      kind: "following";
      seriesId: Id;
      frequency: Frequency;
      byWeekdays: Weekday[];
      end: RecurrenceEnd;
      timezone: string;
    } & MovePlan);

type MoveOutcome =
  | { kind: "none" }
  | { kind: "moved"; otherMove: OtherMove }
  | { kind: "failed"; personName: string };

function firstWrite(plan: SessionPlan): Promise<unknown> {
  switch (plan.kind) {
    case "schedule": {
      const { repeat } = plan;
      return repeat.kind === "repeat"
        ? CoachingSessionSeriesApi.create(
            seriesPayload({ ...plan, frequency: repeat.frequency, end: repeat.end }),
            plan.timezone
          )
        : CoachingSessionApi.create(sessionPayload(plan));
    }
    case "move":
      return CoachingSessionApi.update(plan.session.id, {
        ...plan.session,
        date: toSessionDate(plan.start),
        duration_minutes: plan.minutes,
      });
    case "following":
      return CoachingSessionSeriesApi.reschedule(
        plan.seriesId,
        followingPayload({ ...plan, sessionId: plan.session.id }),
        plan.timezone
      );
    default: {
      const _exhaustive: never = plan;
      throw new Error(`Unhandled session plan: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function writeKind(plan: SessionPlan): SessionWrite {
  switch (plan.kind) {
    case "schedule":
      return plan.repeat.kind === "repeat" ? SessionWrite.CreateSeries : SessionWrite.Create;
    case "move":
      return SessionWrite.Update;
    case "following":
      return SessionWrite.RescheduleSeries;
    default: {
      const _exhaustive: never = plan;
      throw new Error(`Unhandled session plan: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function moveOtherWrite(plan: SessionPlan): ResultAsync<MoveOutcome, never> {
  if (plan.moveOther.none) return okAsync({ kind: "none" });
  const { session, personName, start } = plan.moveOther.val;
  return ResultAsync.fromPromise(
    CoachingSessionApi.update(session.id, { ...session, date: toSessionDate(start) }),
    (error) => error
  )
    .map((): MoveOutcome => ({ kind: "moved", otherMove: { personName, start } }))
    .orElse((error) => {
      console.error("Failed to move the overlapping coaching session:", error);
      return okAsync<MoveOutcome, never>({ kind: "failed", personName });
    });
}

function successMessage(plan: SessionPlan, otherMove: Option<OtherMove>): string {
  const { personName, start } = plan;
  switch (plan.kind) {
    case "schedule":
      return scheduledMessage({ personName, start, minutes: plan.minutes, repeat: plan.repeat, otherMove });
    case "move":
    case "following":
      return rescheduledMessage({ personName, start, following: plan.kind === "following", otherMove });
    default: {
      const _exhaustive: never = plan;
      throw new Error(`Unhandled session plan: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

function confirmWritten(plan: SessionPlan, moved: MoveOutcome) {
  toast.success(successMessage(plan, moved.kind === "moved" ? Some(moved.otherMove) : None));
  if (moved.kind === "failed") toast.error(otherMoveFailedMessage(moved.personName));
}

export interface ScheduleSubmit {
  submitting: boolean;
  submit: (plan: SessionPlan) => void;
}

export function useScheduleSubmit(onClose: () => void): ScheduleSubmit {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const onFailed = (plan: SessionPlan, error: unknown) => {
    const failure = sessionWriteFailure(error, writeKind(plan));
    const logMessage = `Failed to ${plan.kind === "schedule" ? "schedule" : "reschedule"} coaching session:`;
    switch (failure.kind) {
      case "reconnect":
        toast.error(failure.message);
        router.push("/settings/integrations");
        onClose();
        break;
      case "toast":
        toast.error(failure.message);
        console.error(logMessage, error);
        break;
      case "unexpected":
        console.error(logMessage, error);
        break;
      default: {
        const _exhaustive: never = failure;
        throw new Error(`Unhandled session write failure: ${JSON.stringify(_exhaustive)}`);
      }
    }
  };

  const submit = (plan: SessionPlan) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    void ResultAsync.fromPromise(firstWrite(plan), (error) => error)
      .andThen(() => moveOtherWrite(plan))
      .match(
        (moved) => {
          void revalidateEndpointCaches(mutate, siteConfig.env.backendServiceURL, "/coaching_sessions");
          // A reschedule can split the series under a new id.
          if (plan.kind === "following") {
            void revalidateEndpointCaches(mutate, siteConfig.env.backendServiceURL, "/coaching_session_series");
          }
          confirmWritten(plan, moved);
          onClose();
        },
        (error) => {
          inFlight.current = false;
          setSubmitting(false);
          onFailed(plan, error);
        }
      );
  };

  return { submitting, submit };
}
