import axios from "axios";
import { err, ok, type Result } from "neverthrow";
import { None, Some, type Option } from "@/types/option";

/** Why the backend refused a resend; values match the 409 body's `details.reason`. */
export enum ResendInviteRefusal {
  LegacySeries = "legacy_series",
  NoUpcomingSessions = "no_upcoming_sessions",
  SeriesMember = "series_member",
}

export type ResendInviteFailure =
  | { kind: "refused"; reason: ResendInviteRefusal }
  | { kind: "not_delivered" } // 502
  | { kind: "network" } // no response
  | { kind: "unexpected"; status: Option<number> };

const REFUSALS: ReadonlySet<string> = new Set(Object.values(ResendInviteRefusal));

function refusalOf(data: unknown): Option<ResendInviteRefusal> {
  const reason = (data as { details?: { reason?: unknown } } | undefined)?.details?.reason;
  return typeof reason === "string" && REFUSALS.has(reason)
    ? Some(reason as ResendInviteRefusal)
    : None;
}

export function toResendInviteFailure(error: unknown): ResendInviteFailure {
  if (!axios.isAxiosError(error)) return { kind: "unexpected", status: None };
  if (!error.response) return { kind: "network" };
  const { status, data } = error.response;
  if (status === 409) {
    const reason = refusalOf(data);
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
