import type { Id } from "@/types/general";

export type AvatarTone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const TONE_COUNT = 8;

function fnv1a(input: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** Deterministic: the same id always yields the same tone. */
export function avatarToneFor(id: Id): AvatarTone {
  return ((fnv1a(id) % TONE_COUNT) + 1) as AvatarTone;
}

/** Literal Tailwind classes per tone (must be full literal strings so Tailwind keeps them). */
export const AVATAR_TONE_CLASSES: Record<AvatarTone, string> = {
  1: "bg-avatar-1 text-avatar-1-foreground",
  2: "bg-avatar-2 text-avatar-2-foreground",
  3: "bg-avatar-3 text-avatar-3-foreground",
  4: "bg-avatar-4 text-avatar-4-foreground",
  5: "bg-avatar-5 text-avatar-5-foreground",
  6: "bg-avatar-6 text-avatar-6-foreground",
  7: "bg-avatar-7 text-avatar-7-foreground",
  8: "bg-avatar-8 text-avatar-8-foreground",
};
