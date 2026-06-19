import { type Option } from "@/types/option";
import { CoachingSessionTopic } from "@/types/coaching-session-topic";
import { Goal } from "@/types/goal";

/**
 * Default placeholder shown when no title can be derived. It is the *default*
 * for the fallback parameter below, never a baked-in return value — any surface
 * that wants a different static title (e.g. "Untitled session") passes its own.
 */
export const COACHING_SESSION_TITLE_PLACEHOLDER = "Coaching Session";

/**
 * Minimal shape needed to derive a coaching session's display title. Both
 * CoachingSession and EnrichedCoachingSession satisfy it structurally, so any
 * surface that lists or previews sessions can pass its session straight in.
 *
 * `display_title` is the backend's authoritative, server-composed title (present
 * on the list/enriched reads, absent on the single-session read). `topics`/
 * `goals` feed the client-side fallback when `display_title` isn't available —
 * a caller that hasn't fetched them still gets a sensible result.
 */
export type CoachingSessionTitleSource = {
  title: Option<string>;
  display_title?: Option<string>;
  topics?: readonly Pick<CoachingSessionTopic, "body">[];
  goals?: readonly Pick<Goal, "title">[];
};

/**
 * Client-side display title for a coaching session, in fallback order: the
 * human-set title when present, else the first topic (drag-and-drop display
 * order), else the first linked goal's title, else `fallback`.
 *
 * This is the fallback path used on the single-session page and whenever the
 * backend's `display_title` isn't on the read; list/preview surfaces prefer
 * `display_title` (see `CoachingSessionTitleText`).
 */
export function coachingSessionTitle(
  session: CoachingSessionTitleSource,
  fallback: string = COACHING_SESSION_TITLE_PLACEHOLDER
): string {
  if (session.title.some) return session.title.val;
  return session.topics?.[0]?.body || session.goals?.[0]?.title || fallback;
}
