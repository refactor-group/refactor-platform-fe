import { DateTime } from "ts-luxon";
import type { Id } from "@/types/general";
import { None, Some, type Option } from "@/types/option";
import { RelationshipRole } from "@/types/relationship-role";
import { DueSource, type ActionSuggestion } from "@/types/transcript-suggestion";

/**
 * Mirrors the backend rule: the coachee may not act on a coach-only
 * suggestion, nor add or remove the coach as an assignee.
 */
export function mayActOnSuggestion(
  viewer: RelationshipRole,
  people: { coachId: Id; coacheeId: Id },
  stored: Id[],
  requested: Option<Id[]>
): boolean {
  if (viewer === RelationshipRole.Coach) return true;
  const coachStored = stored.includes(people.coachId);
  const coachOnly = coachStored && !stored.includes(people.coacheeId);
  const movesCoach = requested.some && requested.val.includes(people.coachId) !== coachStored;
  return !coachOnly && !movesCoach;
}

export interface SuggestionDue {
  at: DateTime;
  /** True when the due date was spoken in the session. */
  spoken: boolean;
  label: string;
  tooltip: Option<string>;
}

function defaultTail(source: DueSource): string {
  switch (source) {
    case DueSource.NextSession:
      return "Defaults to your next session";
    case DueSource.SevenDays:
      return "Defaults to a week from today";
    default: {
      const _exhaustive: never = source;
      throw new Error(`Unhandled due source: ${_exhaustive}`);
    }
  }
}

export function suggestionDue(s: ActionSuggestion, locale: string): SuggestionDue {
  const { due_by, due_phrase } = s.proposal;
  const at = due_by.some ? due_by.val : s.default_due.at;
  const label = at.setLocale(locale).toLocaleString(DateTime.DATE_MED);

  if (due_by.some) {
    return {
      at,
      spoken: true,
      label,
      tooltip: due_phrase.some ? Some(`Due ${label} · from “${due_phrase.val}”`) : None,
    };
  }

  const head = due_phrase.some
    ? `Heard “${due_phrase.val}”, but no date was set. `
    : "No date mentioned. ";
  return { at, spoken: false, label, tooltip: Some(head + defaultTail(s.default_due.source)) };
}
