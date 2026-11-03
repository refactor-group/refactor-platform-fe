"use client";

import { useCallback } from "react";
import { ResultAsync } from "neverthrow";
import { DateTime } from "ts-luxon";
import { CoachingSessionSeriesApi } from "@/lib/api/coaching-session-series";
import { nextUnstartedSession } from "@/lib/move-draft";
import { MoveScope } from "@/lib/scheduling";
import { sessionStartIn } from "@/lib/session-window";
import { toast } from "@/lib/toast";
import type { EnrichedCoachingSession } from "@/types/coaching-session";

type OpenMove = (session: EnrichedCoachingSession, scope: MoveScope) => void;

function openNextOfSeries(row: EnrichedCoachingSession, timezone: string, openMove: OpenMove) {
  if (row.coaching_session_series_id.none) return;
  void ResultAsync.fromPromise(
    CoachingSessionSeriesApi.get(row.coaching_session_series_id.val, timezone),
    (error) => error
  ).match(
    (series) => {
      const next = nextUnstartedSession(series.coaching_sessions, DateTime.now());
      if (next.none) {
        toast.error("This series has no upcoming sessions");
        return;
      }
      const { relationship, coach, coachee } = row;
      openMove({ ...next.val, relationship, coach, coachee }, MoveScope.Following);
    },
    (error) => {
      console.error("Failed to load the coaching session series:", error);
      toast.error("Couldn't load the series · Try again");
    }
  );
}

/** Edit series opens this and following on the row's session, or the series' next one when it's past. */
export function useEditSeries(timezone: string, openMove: OpenMove) {
  return useCallback(
    (row: EnrichedCoachingSession) => {
      if (sessionStartIn(row.date, timezone) >= DateTime.now()) openMove(row, MoveScope.Following);
      else openNextOfSeries(row, timezone, openMove);
    },
    [timezone, openMove]
  );
}
