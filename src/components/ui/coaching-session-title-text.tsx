import { cn } from "@/components/lib/utils";
import {
  coachingSessionTitle,
  type CoachingSessionTitleSource,
} from "@/types/coaching-session-title";

interface CoachingSessionTitleTextProps {
  session: CoachingSessionTitleSource;
  className?: string;
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
 * It owns the markup, not the fetching — callers pass whatever session data
 * they already have and the shared `coachingSessionTitle` rule does the rest.
 */
export function CoachingSessionTitleText({
  session,
  className,
  hideWhenRedundantWithGoals = false,
}: CoachingSessionTitleTextProps) {
  const title = coachingSessionTitle(session);

  if (
    hideWhenRedundantWithGoals &&
    (session.goals ?? []).some((goal) => goal.title === title)
  ) {
    return null;
  }

  return <p className={className}>{title}</p>;
}
