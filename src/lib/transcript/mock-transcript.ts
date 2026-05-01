import type { TranscriptSegment } from "@/types/transcription";

/**
 * Realistic mock transcript for Phase 1 — matches the shape of data
 * returned by the real backend (refactor-platform-rs PR #254):
 *   - `speaker_label` is a raw AssemblyAI label (`Speaker A`, `Speaker B`)
 *     with no user-identity mapping
 *   - `start_ms` / `end_ms` are millisecond offsets into the recording
 *   - `created_at` is a DateTime
 *
 * Phase 2 swaps this fixture for `useTranscriptionSegments(...)` at the
 * page level; the panel itself is data-driven and doesn't care where
 * the segments came from.
 */

const NOW = "2026-03-17T15:30:00.000Z";

export const MOCK_TRANSCRIPT_SEGMENTS: readonly TranscriptSegment[] = [
  segment("1", "Speaker A", 0, 5_000, "Hey Bob, great to see you. How's the cohort going this week?"),
  segment(
    "2",
    "Speaker B",
    7_000,
    22_000,
    "Going well — cohort two is wrapping up their capstones, and I've been watching the retention metrics daily. Week-three drop-off is still the thing I want to move."
  ),
  segment(
    "3",
    "Speaker A",
    23_000,
    30_000,
    "Let's stay on that for a minute. What have you tried, and what have you ruled out?"
  ),
  segment(
    "4",
    "Speaker B",
    31_000,
    57_000,
    "I tried a mid-week check-in email and a Slack nudge. The email bumped it a little, the Slack nudge did almost nothing. I'm starting to think the issue is the pacing — week three has the hardest project and no scaffolding."
  ),
  segment(
    "5",
    "Speaker A",
    58_000,
    71_000,
    "Interesting. So you're moving from 'reach out more' toward 'change the work itself.' What would changing the work look like?"
  ),
  segment(
    "6",
    "Speaker B",
    72_000,
    88_000,
    "Maybe breaking week three into two smaller deliverables with a checkpoint in between. Or pairing people up that week specifically."
  ),
  segment("7", "Speaker A", 89_000, 93_000, "Which of those feels lower-risk to try first?"),
  segment(
    "8",
    "Speaker B",
    94_000,
    105_000,
    "Pairing — it doesn't change the curriculum, just the format. I could run it with the next cohort."
  ),
  segment(
    "9",
    "Speaker A",
    106_000,
    114_000,
    "Good. Let's make that concrete — what would you need to set up before cohort three's week three hits?"
  ),
  segment(
    "10",
    "Speaker B",
    114_000,
    134_000,
    "A pairing sign-up form by Monday, and I want to message the cohort on Friday so they know it's coming. I'll also need to decide whether pairings are self-selected or assigned."
  ),
  segment("11", "Speaker A", 134_000, 139_000, "What's the argument for each?"),
];

function segment(
  id: string,
  speaker: string,
  startMs: number,
  endMs: number,
  text: string
): TranscriptSegment {
  return {
    id,
    transcription_id: "mock-transcription-1",
    speaker_label: speaker,
    text,
    start_ms: startMs,
    end_ms: endMs,
    created_at: NOW,
  };
}
