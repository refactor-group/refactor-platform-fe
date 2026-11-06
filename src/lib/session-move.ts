import type { DateTime } from "ts-luxon";
import { CoachingSessionApi } from "@/lib/api/coaching-sessions";
import { toSessionDate } from "@/lib/session-window";
import type { CoachingSession } from "@/types/coaching-session";

export function writeSessionMove(session: CoachingSession, start: DateTime, minutes: number): Promise<unknown> {
  return CoachingSessionApi.update(session.id, {
    ...session,
    date: toSessionDate(start),
    duration_minutes: minutes,
  });
}
