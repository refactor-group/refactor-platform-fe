import type { DateTime } from "ts-luxon";
import { ItemStatus } from "@/types/general";
import { type Option, Some, None } from "@/types/option";

export type StatusMeta =
  | { kind: "none" }
  | { kind: "due"; dueBy: DateTime }
  | { kind: "overdue"; dueBy: DateTime }
  | { kind: "paused"; dueBy: Option<DateTime> }
  | { kind: "done"; at: DateTime }
  | { kind: "closed"; at: DateTime };

export interface StatusMetaInput {
  status: ItemStatus;
  dueBy: Option<DateTime>;
  statusChangedAt: DateTime;
}

export const OVERDUE_META_CLASS = "font-medium text-warning-text";
const PAUSED_META_CLASS = "text-on-hold-text";
const PLAIN_META_CLASS = "text-muted-foreground";

function openMeta(dueBy: Option<DateTime>, now: DateTime): StatusMeta {
  if (dueBy.none) return { kind: "none" };
  return dueBy.val.startOf("day") < now.startOf("day")
    ? { kind: "overdue", dueBy: dueBy.val }
    : { kind: "due", dueBy: dueBy.val };
}

/** Dates come back in `now`'s zone, so pass now in the user's profile zone. */
export function statusMeta(input: StatusMetaInput, now: DateTime): StatusMeta {
  const dueBy = input.dueBy.some ? Some(input.dueBy.val.setZone(now.zone)) : None;
  const changedAt = input.statusChangedAt.setZone(now.zone);
  switch (input.status) {
    case ItemStatus.NotStarted:
    case ItemStatus.InProgress:
      return openMeta(dueBy, now);
    case ItemStatus.OnHold:
      return { kind: "paused", dueBy };
    case ItemStatus.Completed:
      return { kind: "done", at: changedAt };
    case ItemStatus.WontDo:
      return { kind: "closed", at: changedAt };
    default: {
      const _exhaustive: never = input.status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}

const shortDate = (dt: DateTime, locale: string): string => dt.setLocale(locale).toFormat("MMM d");

/** The meta line's text, with month names in the given locale. */
export function formatStatusMeta(meta: StatusMeta, locale: string): Option<string> {
  switch (meta.kind) {
    case "none":
      return None;
    case "due":
    case "overdue":
      return Some(`Due ${shortDate(meta.dueBy, locale)}`);
    case "paused":
      return Some(
        meta.dueBy.some ? `Paused · was due ${shortDate(meta.dueBy.val, locale)}` : "Paused"
      );
    case "done":
      return Some(`Done ${shortDate(meta.at, locale)}`);
    case "closed":
      return Some(`Closed ${shortDate(meta.at, locale)}`);
    default: {
      const _exhaustive: never = meta;
      throw new Error(`Unhandled status meta: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/** Overdue reads amber, paused takes the on-hold tone, the rest stay muted. */
export function statusMetaClass(meta: StatusMeta): string {
  switch (meta.kind) {
    case "overdue":
      return OVERDUE_META_CLASS;
    case "paused":
      return PAUSED_META_CLASS;
    case "none":
    case "due":
    case "done":
    case "closed":
      return PLAIN_META_CLASS;
    default: {
      const _exhaustive: never = meta;
      throw new Error(`Unhandled status meta: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
