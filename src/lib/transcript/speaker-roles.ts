import { ALL_SPEAKERS } from "@/lib/hooks/use-speaker-filter";
import { None, Some, type Option } from "@/types/option";
import type { Speaker, SpeakerRole } from "@/types/transcription";

/**
 * What the download endpoint can be asked for, given the panel's current
 * speaker selection.
 *
 * The panel filters on raw diarization labels; the endpoint filters on the
 * closed coach/coachee enum. The last two variants are the gap between them.
 */
export type DownloadScope =
  | { kind: "all" }
  | { kind: "role"; role: SpeakerRole; label: string }
  | { kind: "unmapped"; label: string }
  | { kind: "speakers-unavailable" };

/**
 * Maps the panel's selected filter value onto a download scope.
 *
 * "All" stays downloadable even without the speakers list, because it needs no
 * query param. A specific label cannot be translated without it.
 */
export function downloadScopeFor(
  selectedValue: string,
  speakers: readonly Speaker[],
  speakersLoaded: boolean
): DownloadScope {
  if (selectedValue === ALL_SPEAKERS) return { kind: "all" };
  if (!speakersLoaded) return { kind: "speakers-unavailable" };

  // Statement rather than a ternary on `match?.role.some` so the Option
  // discriminant narrows `role` for the `.val` read.
  const match = speakers.find((speaker) => speaker.label === selectedValue);
  if (match && match.role.some) {
    return { kind: "role", role: match.role.val, label: match.label };
  }
  return { kind: "unmapped", label: selectedValue };
}

/**
 * Why this scope cannot be downloaded, or None when it can.
 *
 * Both blocked variants share one message: the distinction matters to us, but
 * the user's next move is the same either way.
 */
export function blockedReasonFor(scope: DownloadScope): Option<string> {
  switch (scope.kind) {
    case "unmapped":
    case "speakers-unavailable":
      return Some("Switch to All to download");
    case "all":
    case "role":
      return None;
  }
}

/**
 * The download action's label, used for both the tooltip and the accessible
 * name. Names the speaker when the panel is filtered to one, so the control
 * says what it will actually produce.
 */
export function downloadLabelFor(scope: DownloadScope): string {
  return scope.kind === "role"
    ? `Download ${scope.label}'s transcript`
    : "Download transcript";
}
