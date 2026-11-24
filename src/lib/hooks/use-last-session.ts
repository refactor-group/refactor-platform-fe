import type { DateTime } from "ts-luxon";
import { nearestEachQuery, useNearestEachCoachingSessions } from "@/lib/api/coaching-sessions";
import { useAuthStore } from "@/lib/providers/auth-store-provider";
import { useViewerRelationshipIds } from "@/lib/hooks/use-viewer-relationship-ids";
import { utcInstant } from "@/lib/session-window";
import type { FilterPerson } from "@/lib/week-grid/filter";
import { lastSessionBefore } from "@/lib/week-grid/week";
import type { EnrichedCoachingSession } from "@/types/coaching-session";
import type { Option } from "@/types/option";

// The previous answer stays up while the next hour's or person's loads, so the link doesn't blink.
const KEEP_WHILE_LOADING = { keepPreviousData: true };

/**
 * The viewer's latest session with `person`, or with anyone, that started before
 * this hour. The hour keeps the fetch key steady; a session started since then
 * counts from the next hour.
 */
export function useLastSession(person: Option<FilterPerson>, now: DateTime): Option<EnrichedCoachingSession> {
  const userId = useAuthStore((s) => s.userId);
  const viewer = useViewerRelationshipIds();
  const relationshipIds = person.some ? person.val.relationshipIds : viewer.relationshipIds;
  const around = now.startOf("hour");

  const { sessions } = useNearestEachCoachingSessions(
    nearestEachQuery(userId, relationshipIds, utcInstant(around)),
    KEEP_WHILE_LOADING
  );
  // Kept data may be from a wider or other scope; only this scope's relationships count.
  const inScope = sessions.filter((s) => relationshipIds.includes(s.coaching_relationship_id));
  return lastSessionBefore(inScope, around);
}
