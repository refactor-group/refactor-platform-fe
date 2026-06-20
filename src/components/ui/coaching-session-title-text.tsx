import {
  coachingSessionTitle,
  COACHING_SESSION_TITLE_PLACEHOLDER,
  type CoachingSessionTitleSource,
} from "@/types/coaching-session-title";

interface CoachingSessionTitleTextProps {
  session: CoachingSessionTitleSource;
  className?: string;
  /**
   * Shown when no title can be derived. Defaults to "Untitled" so
   * existing surfaces are unchanged; pass a different value for a custom static
   * title (e.g. "Untitled session").
   */
  fallbackTitle?: string;
  /**
   * Render nothing when no title can be derived (title/topic/goal all absent),
   * instead of showing the fallback. Useful in list rows already identified by
   * other fields (participant name + date), where a generic placeholder line is
   * pure noise.
   */
  hideWhenFallback?: boolean;
  /**
   * Render nothing when the derived title would merely echo one of the
   * session's goals already shown nearby — keeps surfaces that also render the
   * goal list (e.g. the upcoming-session card, the right-side preview panel)
   * from showing the same line twice.
   */
  hideWhenRedundantWithGoals?: boolean;
}

/**
 * Presentational, data-in renderer for a coaching session's display title.
 * It owns the markup, not the fetching. When the backend's authoritative
 * `display_title` is on the read it is rendered verbatim; otherwise the shared
 * client-side `coachingSessionTitle` rule derives one. Either way the
 * `fallbackTitle` covers the "nothing to show" case.
 */
export function CoachingSessionTitleText({
  session,
  className,
  fallbackTitle = COACHING_SESSION_TITLE_PLACEHOLDER,
  hideWhenFallback = false,
  hideWhenRedundantWithGoals = false,
}: CoachingSessionTitleTextProps) {
  // The derived title, or null when nothing (title/topic/goal) yields one.
  // Prefer the backend's authoritative display_title; else the client rule
  // (an empty-string fallback collapses "nothing derived" to null).
  const derived: string | null =
    session.display_title !== undefined
      ? session.display_title.some
        ? session.display_title.val
        : null
      : coachingSessionTitle(session, "") || null;

  if (hideWhenFallback && derived === null) return null;

  const title = derived ?? fallbackTitle;

  if (
    hideWhenRedundantWithGoals &&
    (session.goals ?? []).some((goal) => goal.title === title)
  ) {
    return null;
  }

  return <p className={className}>{title}</p>;
}
