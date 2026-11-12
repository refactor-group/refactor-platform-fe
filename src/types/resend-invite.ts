import axios from "axios";
import { err, ok, type Result } from "neverthrow";
import { None, Some, type Option } from "@/types/option";
import { conflictReasonOf } from "@/types/entity-api-error";
import { notAMemberRefusalOf, type NotAMemberRefusal } from "@/types/membership";

/** Why the backend refused a resend; values match the 409 body's `details.reason`. */
export enum ResendInviteRefusal {
  LegacySeries = "legacy_series",
  NoUpcomingSessions = "no_upcoming_sessions",
  SeriesMember = "series_member",
}

export type ResendInviteFailure =
  | { kind: "refused"; reason: ResendInviteRefusal }
  | { kind: "not_a_member"; refusal: NotAMemberRefusal }
  | { kind: "not_delivered" } // 502
  | { kind: "network" } // no response
  | { kind: "unexpected"; status: Option<number> };

const REFUSALS: ReadonlySet<string> = new Set(Object.values(ResendInviteRefusal));

function refusalOf(error: unknown): Option<ResendInviteRefusal> {
  const reason = conflictReasonOf(error);
  return reason.some && REFUSALS.has(reason.val) ? Some(reason.val as ResendInviteRefusal) : None;
}

export function toResendInviteFailure(error: unknown): ResendInviteFailure {
  if (!axios.isAxiosError(error)) return { kind: "unexpected", status: None };
  if (!error.response) return { kind: "network" };
  const { status } = error.response;
  if (status === 409) {
    const notAMember = notAMemberRefusalOf(error);
    if (notAMember.some) return { kind: "not_a_member", refusal: notAMember.val };
    const reason = refusalOf(error);
    return reason.some
      ? { kind: "refused", reason: reason.val }
      : { kind: "unexpected", status: Some(409) };
  }
  if (status === 502) return { kind: "not_delivered" };
  return { kind: "unexpected", status: Some(status) };
}

export async function attemptResend(
  call: () => Promise<unknown>
): Promise<Result<void, ResendInviteFailure>> {
  try {
    await call();
    return ok(undefined);
  } catch (error) {
    return err(toResendInviteFailure(error));
  }
}
