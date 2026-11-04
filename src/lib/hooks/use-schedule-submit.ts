"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ResultAsync, okAsync } from "neverthrow";
import { useSWRConfig } from "swr";
import type { DateTime } from "ts-luxon";
import {
  type OtherMove,
  otherMoveFailedMessage,
  scheduledMessage,
} from "@/components/ui/dashboard/session-change-message";
import { CoachingSessionApi } from "@/lib/api/coaching-sessions";
import { CoachingSessionSeriesApi } from "@/lib/api/coaching-session-series";
import { SessionWrite, sessionWriteFailure } from "@/lib/api/coaching-session-errors";
import { revalidateEndpointCaches } from "@/lib/hooks/use-sse-cache-invalidation";
import { seriesPayload, sessionPayload } from "@/lib/schedule-draft";
import type { RepeatChoice } from "@/lib/scheduling";
import { toSessionDate } from "@/lib/session-window";
import { toast } from "@/lib/toast";
import { siteConfig } from "@/site.config";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Id } from "@/types/general";
import { type Option, None, Some } from "@/types/option";
import type { Provider } from "@/types/provider";
import type { Weekday } from "@/types/recurrence";

/** Everything a submit needs, chosen and valid. */
export interface SchedulePlan {
  relationshipId: Id;
  personName: string;
  start: DateTime;
  minutes: number;
  provider: Option<Provider>;
  repeat: RepeatChoice;
  byWeekdays: Weekday[];
  timezone: string;
  move: Option<{ session: EnrichedCoachingSession; personName: string; start: DateTime }>;
}

type MoveOutcome =
  | { kind: "none" }
  | { kind: "moved"; otherMove: OtherMove }
  | { kind: "failed"; personName: string };

function createWrite(plan: SchedulePlan): ResultAsync<unknown, unknown> {
  const { repeat } = plan;
  const write: Promise<unknown> =
    repeat.kind === "repeat"
      ? CoachingSessionSeriesApi.create(
          seriesPayload({ ...plan, frequency: repeat.frequency, end: repeat.end }),
          plan.timezone
        )
      : CoachingSessionApi.create(sessionPayload(plan));
  return ResultAsync.fromPromise(write, (error) => error);
}

function moveWrite(plan: SchedulePlan): ResultAsync<MoveOutcome, never> {
  if (plan.move.none) return okAsync({ kind: "none" });
  const { session, personName, start } = plan.move.val;
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

function confirmScheduled(plan: SchedulePlan, moved: MoveOutcome) {
  toast.success(
    scheduledMessage({
      personName: plan.personName,
      start: plan.start,
      minutes: plan.minutes,
      repeat: plan.repeat,
      otherMove: moved.kind === "moved" ? Some(moved.otherMove) : None,
    })
  );
  if (moved.kind === "failed") toast.error(otherMoveFailedMessage(moved.personName));
}

export interface ScheduleSubmit {
  submitting: boolean;
  submit: (plan: SchedulePlan) => void;
}

export function useScheduleSubmit(onClose: () => void): ScheduleSubmit {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);

  const onFailed = (plan: SchedulePlan, error: unknown) => {
    const write = plan.repeat.kind === "repeat" ? SessionWrite.CreateSeries : SessionWrite.Create;
    const failure = sessionWriteFailure(error, write);
    switch (failure.kind) {
      case "reconnect":
        toast.error(failure.message);
        router.push("/settings/integrations");
        onClose();
        break;
      case "toast":
        toast.error(failure.message);
        console.error("Failed to schedule coaching session:", error);
        break;
      case "unexpected":
        console.error("Failed to schedule coaching session:", error);
        break;
      default: {
        const _exhaustive: never = failure;
        throw new Error(`Unhandled session write failure: ${JSON.stringify(_exhaustive)}`);
      }
    }
  };

  const submit = (plan: SchedulePlan) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    void createWrite(plan)
      .andThen(() => moveWrite(plan))
      .match(
        (moved) => {
          void revalidateEndpointCaches(mutate, siteConfig.env.backendServiceURL, "/coaching_sessions");
          confirmScheduled(plan, moved);
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
