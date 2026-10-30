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

function isOverdue(dueBy: DateTime, now: DateTime): boolean {
  return dueBy.setZone(now.zone).startOf("day") < now.startOf("day");
}

function openMeta(dueBy: Option<DateTime>, now: DateTime): StatusMeta {
  if (dueBy.none) return { kind: "none" };
  return isOverdue(dueBy.val, now)
    ? { kind: "overdue", dueBy: dueBy.val }
    : { kind: "due", dueBy: dueBy.val };
}

export function statusMeta(input: StatusMetaInput, now: DateTime): StatusMeta {
  switch (input.status) {
    case ItemStatus.NotStarted:
    case ItemStatus.InProgress:
      return openMeta(input.dueBy, now);
    case ItemStatus.OnHold:
      return { kind: "paused", dueBy: input.dueBy };
    case ItemStatus.Completed:
      return { kind: "done", at: input.statusChangedAt };
    case ItemStatus.WontDo:
      return { kind: "closed", at: input.statusChangedAt };
    default: {
      const _exhaustive: never = input.status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}

const shortDate = (dt: DateTime): string => dt.toFormat("MMM d");

export function formatStatusMeta(meta: StatusMeta): Option<string> {
  switch (meta.kind) {
    case "none":
      return None;
    case "due":
    case "overdue":
      return Some(`Due ${shortDate(meta.dueBy)}`);
    case "paused":
      return Some(
        meta.dueBy.some ? `Paused · was due ${shortDate(meta.dueBy.val)}` : "Paused"
      );
    case "done":
      return Some(`Done ${shortDate(meta.at)}`);
    case "closed":
      return Some(`Closed ${shortDate(meta.at)}`);
    default: {
      const _exhaustive: never = meta;
      throw new Error(`Unhandled status meta: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
