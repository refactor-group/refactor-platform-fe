import { DateTime } from "ts-luxon";
import { None, Some } from "@/types/option";
import { DueSource, type ActionSuggestion } from "@/types/transcript-suggestion";
import { createMockAction } from "../test-utils";

/**
 * Creates a complete, pending ActionSuggestion for tests.
 *
 * @example
 * const suggestion = createMockActionSuggestion({ id: "sug-2", quote: "I'll send it" })
 */
export function createMockActionSuggestion(
  overrides?: Partial<ActionSuggestion>
): ActionSuggestion {
  const now = DateTime.now();

  return {
    id: "sug-1",
    coaching_session_id: "session-1",
    proposal: { ...createMockAction(), due_phrase: None },
    quote: "I'll update my resume before next session.",
    segment: { id: "seg-1", start_ms: 0, speaker_role: None, speaker_label: "Guest 1" },
    duplicate_of: None,
    default_due: { at: now.plus({ days: 7 }), source: Some(DueSource.NextSession) },
    undated_reason: None,
    created_at: now,
    resolved_by: None,
    resolved_at: None,
    ...overrides,
  };
}
