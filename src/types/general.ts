import { DateTime } from "ts-luxon";

// Re-export EntityApiError for backward compatibility
export { EntityApiError } from "./entity-api-error";

// A type alias for each entity's Id field
export type Id = string;

/** A generic id + label pair for use in select/dropdown components */
export interface SelectOption {
  id: Id;
  label: string;
}


export enum ItemStatus {
  NotStarted = "NotStarted",
  InProgress = "InProgress",
  Completed = "Completed",
  WontDo = "WontDo",
}

export function stringToActionStatus(statusString: string): ItemStatus {
  const status = statusString.trim();

  if (status == "InProgress") {
    return ItemStatus.InProgress;
  } else if (status == "Completed") {
    return ItemStatus.Completed;
  } else if (status == "WontDo") {
    return ItemStatus.WontDo;
  } else {
    return ItemStatus.NotStarted;
  }
}

export function actionStatusToString(actionStatus: ItemStatus): string {
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
  return dt.trim().length > 0 ? DateTime.fromISO(dt) : DateTime.now();
}

// Type-safe transformation function with runtime validation that ensures
// that raw ISO date time stamps are transformed into valid ts-luxon DateTime
// instances.
export const transformEntityDates = (data: any): any => {
  // Return early for non-objects
  if (typeof data !== "object" || data === null) return data;

  // Create a new object with transformed dates
  const transformed: Record<string, any> = { ...data };

  // Helper function for safe date conversion
  const convertDate = (field: string) => {
    if (typeof transformed[field] === "string") {
      const dt = DateTime.fromISO(transformed[field]);
      transformed[field] = dt.isValid ? dt : transformed[field];
    }
  };

  // Convert known date + time fields
  convertDate("created_at");
  convertDate("updated_at");
  convertDate("due_by");
  convertDate("status_changed_at");
  convertDate("completed_at");

  return transformed;
};
