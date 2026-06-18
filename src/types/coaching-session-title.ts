import { type Option } from "@/types/option";
import { CoachingSessionTopic } from "@/types/coaching-session-topic";
import { Goal } from "@/types/goal";

/**
 * Minimal shape needed to derive a coaching session's display title. Both
 * CoachingSession and EnrichedCoachingSession satisfy it structurally, so any
 * surface that lists or previews sessions can pass its session straight in.
 * `topics`/`goals` are optional — a caller that hasn't fetched them still gets
 * a sensible fallback.
 */
export type CoachingSessionTitleSource = {
  title: Option<string>;
  topics?: readonly Pick<CoachingSessionTopic, "body">[];
  goals?: readonly Pick<Goal, "title">[];
};

/**
 * Display title for a coaching session, in fallback order: the human-set title
 * when present, else the first topic (drag-and-drop display order), else the
 * first linked goal's title, else the literal "Coaching Session".
 */
export function coachingSessionTitle(session: CoachingSessionTitleSource): string {
  if (session.title.some) return session.title.val;
  return (
    session.topics?.[0]?.body ||
    session.goals?.[0]?.title ||
    "Coaching Session"
  );
}
