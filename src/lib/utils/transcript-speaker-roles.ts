import { ALL_SPEAKERS } from "@/lib/hooks/use-speaker-filter";
import { None, Some, type Option } from "@/types/option";
import type { SpeakerRole, TranscriptSegment } from "@/types/transcription";

/**
 * What the download endpoint can be asked for, given the panel's selection.
 * The panel filters on labels, the endpoint on a closed enum; `unmapped` is
 * the gap between them (a guest has no role).
 */
export type DownloadScope =
  | { kind: "all" }
  | { kind: "role"; role: SpeakerRole; label: string }
  | { kind: "unmapped"; label: string };

export function downloadScopeFor(
  selectedValue: string,
  segments: readonly TranscriptSegment[]
): DownloadScope {
  if (selectedValue === ALL_SPEAKERS) return { kind: "all" };

  const match = segments.find(
    (segment) =>
      segment.speaker_label === selectedValue && segment.speaker_role.some
  );
  if (match && match.speaker_role.some) {
    return { kind: "role", role: match.speaker_role.val, label: selectedValue };
  }
  return { kind: "unmapped", label: selectedValue };
}

/** Why this scope cannot be downloaded, or None when it can. */
export function blockedReasonFor(scope: DownloadScope): Option<string> {
  switch (scope.kind) {
    case "unmapped":
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
