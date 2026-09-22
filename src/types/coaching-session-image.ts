import { DateTime } from "ts-luxon";
import { Id } from "@/types/general";
import { type Option, Some, None } from "@/types/option";

export const ACCEPTED_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type AcceptedImageMimeType = (typeof ACCEPTED_IMAGE_MIME_TYPES)[number];

// This must always reflect the Rust struct on the backend.
export interface CoachingSessionImage {
  id: Id;
  coaching_session_id: Id;
  mime_type: string;
  byte_size: number;
  // Backend cannot always determine dimensions; absent is a real state.
  width: Option<number>;
  height: Option<number>;
  created_at: DateTime;
}

const toDateTime = (value: unknown): DateTime => {
  if (typeof value === "string") {
    const dt = DateTime.fromISO(value);
    if (dt.isValid) return dt;
  }
  return DateTime.now();
};

const toDimension = (value: unknown): Option<number> =>
  typeof value === "number" && Number.isFinite(value) ? Some(value) : None;

const requireString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`CoachingSessionImage payload is missing ${field}`);
  }
  return value;
};

// Build the FE object explicitly from known fields so wire-only fields never
// leak onto the FE type. Throws rather than narrowing a malformed response
// silently, same reasoning as the parsers in types/transcription.ts.
export function parseCoachingSessionImage(raw: unknown): CoachingSessionImage {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("CoachingSessionImage payload is not an object");
  }
  const data = raw as Record<string, unknown>;
  if (typeof data.byte_size !== "number" || !Number.isFinite(data.byte_size)) {
    throw new Error("CoachingSessionImage payload is missing byte_size");
  }
  return {
    id: requireString(data.id, "id"),
    coaching_session_id: requireString(
      data.coaching_session_id,
      "coaching_session_id"
    ),
    mime_type: requireString(data.mime_type, "mime_type"),
    byte_size: data.byte_size,
    width: toDimension(data.width),
    height: toDimension(data.height),
    created_at: toDateTime(data.created_at),
  };
}
