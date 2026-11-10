import type { DateTime } from "ts-luxon";
import { CoachingSessionApi } from "@/lib/api/coaching-sessions";
import { toSessionDate } from "@/lib/session-window";
import type { Id } from "@/types/general";

export function writeSessionMove(id: Id, start: DateTime, minutes: number): Promise<unknown> {
  return CoachingSessionApi.move(id, { date: toSessionDate(start), duration_minutes: minutes });
}
