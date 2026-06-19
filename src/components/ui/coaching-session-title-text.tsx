import { unwrapOr } from "@/types/option";
import {
  coachingSessionTitle,
  COACHING_SESSION_TITLE_PLACEHOLDER,
  type CoachingSessionTitleSource,
} from "@/types/coaching-session-title";

interface CoachingSessionTitleTextProps {
  session: CoachingSessionTitleSource;
  className?: string;
  /**
   * Shown when no title can be derived. Defaults to "Coaching Session" so
   * existing surfaces are unchanged; pass a different value for a custom static
   * title (e.g. "Untitled session").
   */
  fallbackTitle?: string;
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
  hideWhenRedundantWithGoals = false,
}: CoachingSessionTitleTextProps) {
  const title =
    session.display_title !== undefined
      ? unwrapOr(session.display_title, fallbackTitle)
      : coachingSessionTitle(session, fallbackTitle);

  if (
    hideWhenRedundantWithGoals &&
    (session.goals ?? []).some((goal) => goal.title === title)
  ) {
    return null;
  }

  return <p className={className}>{title}</p>;
}
