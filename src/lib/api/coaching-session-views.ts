// Interacts with the coaching-session "views" read-receipt endpoint
// (CoachingSessionViews contract). A per-(user, session) last-viewed marker;
// the FE derives "unread since I last viewed" from it.

import { siteConfig } from "@/site.config";
import { Id } from "@/types/general";
import { DateTime } from "ts-luxon";
import { type Option, Some, None } from "@/types/option";
import { sessionGuard } from "@/lib/auth/session-guard";
import { ApiResponse } from "./entity-api";

const COACHING_SESSIONS_BASEURL: string = `${siteConfig.env.backendServiceURL}/coaching_sessions`;

/**
 * Result of marking a session viewed.
 * - `previousLastViewedAt`: the caller's marker as it was BEFORE this call
 *   (None on first view) — the anchor for "new since I last viewed this."
 * - `lastViewedAt`: the freshly-advanced marker (now).
 */
export interface MarkSessionViewed {
  previousLastViewedAt: Option<DateTime>;
  lastViewedAt: DateTime;
}

interface MarkSessionViewedWire {
  previous_last_viewed_at: string | null;
  last_viewed_at: string;
}

const toDateTimeOption = (value: unknown): Option<DateTime> => {
  if (typeof value === "string") {
    const dt = DateTime.fromISO(value);
    if (dt.isValid) return Some(dt);
  }
  return None;
};

export const CoachingSessionViewApi = {
  /**
   * `POST /coaching_sessions/{id}/view` (no body). Idempotent upsert of the
   * caller's marker to now(); returns the prior value atomically.
   *
   * Call on a DELIBERATE open, exactly once per open — the returned
   * `previousLastViewedAt` is the anchor unread renders against, and this call
   * advances the marker, so a double-fire would wipe the anchor.
   */
  markViewed: async (coachingSessionId: Id): Promise<MarkSessionViewed> => {
    const res = await sessionGuard.post<ApiResponse<MarkSessionViewedWire>>(
      `${COACHING_SESSIONS_BASEURL}/${coachingSessionId}/view`
    );
    const data = res.data.data;
    const last = toDateTimeOption(data.last_viewed_at);
    return {
      previousLastViewedAt: toDateTimeOption(data.previous_last_viewed_at),
      lastViewedAt: last.some ? last.val : DateTime.now(),
    };
  },
};
