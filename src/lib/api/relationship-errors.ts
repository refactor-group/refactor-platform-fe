import { conflictReasonOf } from "@/types/entity-api-error";

/** A pair holds at most one relationship per organization, except coaching each other. */
export function pairAlreadyRelatedMessage(error: unknown, first: string, second: string): string | null {
  const reason = conflictReasonOf(error);
  return reason.some && reason.val === "pair_already_related"
    ? `${first} and ${second} already have a relationship`
    : null;
}
