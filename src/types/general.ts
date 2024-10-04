import { DateTime } from "ts-luxon";

// A type alias for each entity's Id field
export type Id = string;

// A sorting type that can be used by any of our custom types when stored
// as arrays
export enum SortOrder {
  Ascending = "ascending",
  Descending = "descending",
}

export enum ActionStatus {
  NotStarted = "NotStarted",
  InProgress = "InProgress",
  Completed = "Completed",
  WontDo = "WontDo",
}

export function stringToActionStatus(statusString: string): ActionStatus {
  const status = statusString.trim();

  if (status == "InProgress") {
    return ActionStatus.InProgress;
  } else if (status == "Completed") {
    return ActionStatus.Completed;
  } else if (status == "WontDo") {
    return ActionStatus.WontDo;
  } else {
    return ActionStatus.NotStarted;
  }
}

export function actionStatusToString(actionStatus: ActionStatus): string {
  if (actionStatus == "InProgress") {
    return "In Progress";
  } else if (actionStatus == "Completed") {
    return "Completed";
  } else if (actionStatus == "WontDo") {
    return "Won't Do";
  } else {
    return "Not Started";
  }
}

/// Given a valid ISO formatted date time string (timestampz in Postgresql types),
/// return a valid DateTime object instance.
export function getDateTimeFromString(dateTime: string): DateTime {
  const dt = dateTime.trim();
  if (dt.length == 0) {
    console.warn(
      "Return DateTime.now() since input dateTime string was empty."
    );
    return DateTime.now();
  }

  return DateTime.fromISO(dt);
}
