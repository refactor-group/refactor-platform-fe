import { ALL_SPEAKERS } from "@/lib/hooks/use-speaker-filter";
import { None, Some, type Option } from "@/types/option";
import type { Speaker, SpeakerRole } from "@/types/transcription";

/**
 * What the download endpoint can be asked for, given the panel's selection.
 * The panel filters on raw labels, the endpoint on a closed enum; the last two
 * variants are the gap between them.
 */
export type DownloadScope =
  | { kind: "all" }
  | { kind: "role"; role: SpeakerRole; label: string }
  | { kind: "unmapped"; label: string }
  | { kind: "speakers-unavailable" };

/** "All" survives a missing speakers list; a specific label cannot. */
export function downloadScopeFor(
  selectedValue: string,
  speakers: readonly Speaker[],
  speakersLoaded: boolean
): DownloadScope {
  if (selectedValue === ALL_SPEAKERS) return { kind: "all" };
  if (!speakersLoaded) return { kind: "speakers-unavailable" };

  // Statement, not a ternary: the Option discriminant only narrows this way.
  const match = speakers.find((speaker) => speaker.label === selectedValue);
  if (match && match.role.some) {
    return { kind: "role", role: match.role.val, label: match.label };
  }
  return { kind: "unmapped", label: selectedValue };
}

/** Why this scope cannot be downloaded, or None when it can. */
export function blockedReasonFor(scope: DownloadScope): Option<string> {
  switch (scope.kind) {
    // Both blocked variants share one message: the user's next move is the same.
    case "unmapped":
    case "speakers-unavailable":
      return Some("Switch to All to download");
    case "all":
    case "role":
      return None;
    default: {
      const _exhaustive: never = scope;
      throw new Error(`Unhandled download scope: ${_exhaustive}`);
    }
  }
}

/** Names the speaker when filtered, so the control says what it will produce. */
export function downloadLabelFor(scope: DownloadScope): string {
  return scope.kind === "role"
    ? `Download ${scope.label}'s transcript`
    : "Download transcript";
}
