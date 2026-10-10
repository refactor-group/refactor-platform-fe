import { PanelSection } from "@/components/ui/coaching-sessions/coaching-session-panel-selector";
import { type Option, Some, None } from "@/types/option";
import { SearchHitType, type SearchHit } from "@/types/search";

const sessionHref = (sessionId: string, panel?: PanelSection): string =>
  panel === undefined
    ? `/coaching-sessions/${sessionId}`
    : `/coaching-sessions/${sessionId}?panel=${panel}`;

/**
 * Resolves the page a search hit should open. `None` when the hit has no
 * reachable location in this app, so the caller can render it inert.
 */
export function searchHitHref(hit: SearchHit): Option<string> {
  switch (hit.type) {
    case SearchHitType.CoachingSession:
      return Some(sessionHref(hit.id));
    case SearchHitType.Goal:
      // Goals have no page of their own; the dashboard's goals card is the
      // fallback when the goal was created outside a session.
      return hit.created_in_session_id.some
        ? Some(sessionHref(hit.created_in_session_id.val, PanelSection.Goals))
        : Some("/dashboard");
    case SearchHitType.Action:
      return hit.coaching_session_id.some
        ? Some(
            `${sessionHref(hit.coaching_session_id.val, PanelSection.Actions)}&highlight=${hit.id}`
          )
        : Some("/actions");
    case SearchHitType.Agreement:
      return hit.coaching_session_id.some
        ? Some(sessionHref(hit.coaching_session_id.val, PanelSection.Agreements))
        : None;
    case SearchHitType.Topic:
      return hit.coaching_session_id.some
        ? Some(sessionHref(hit.coaching_session_id.val))
        : None;
    default: {
      const _exhaustive: never = hit;
      throw new Error(`Unhandled search hit type: ${_exhaustive}`);
    }
  }
}
