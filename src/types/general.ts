import { DateTime } from "ts-luxon";
import { AxiosError, AxiosResponse } from "axios";
import axios from "axios";

// A type alias for each entity's Id field
export type Id = string;

/**
 * Enhanced error type for Entity API operations that preserves axios error information
 * while providing a more user-friendly interface for error handling.
 */
export class EntityApiError extends Error {
  public readonly method: string;
  public readonly url: string;
  public readonly status?: number;
  public readonly statusText?: string;
  public readonly response?: AxiosResponse;
  public readonly request?: any;
  public readonly data?: any;
  public readonly originalError: AxiosError | Error;

  constructor(
    method: string,
    url: string,
    originalError: AxiosError | Error,
    message?: string
  ) {
    // Create a descriptive error message
    const errorMessage =
      message || EntityApiError.createErrorMessage(method, url, originalError);
    super(errorMessage);

    this.name = "EntityApiError";
    this.method = method.toUpperCase();
    this.url = url;
    this.originalError = originalError;

    // Extract axios-specific properties if available
    if (
      originalError &&
      "isAxiosError" in originalError &&
      originalError.isAxiosError
    ) {
      const axiosError = originalError as AxiosError;
      this.status = axiosError.response?.status;
      this.statusText = axiosError.response?.statusText;
      this.response = axiosError.response;
      this.request = axiosError.request;
      this.data = axiosError.response?.data;
    }
  }

  /**
   * Creates a user-friendly error message from the original error
   */
  private static createErrorMessage(
    method: string,
    url: string,
    error: AxiosError | Error
  ): string {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const statusText = error.response?.statusText;
      const serverMessage = error.response?.data?.message;

      if (serverMessage) {
        return `${method.toUpperCase()} ${url} failed: ${serverMessage}`;
      } else if (status && statusText) {
        return `${method.toUpperCase()} ${url} failed: ${status} ${statusText}`;
      } else {
        return `${method.toUpperCase()} ${url} failed: ${error.message}`;
      }
    } else {
      return `${method.toUpperCase()} ${url} failed: ${error.message}`;
    }
  }

  /**
   * Returns true if this error represents a client error (4xx status codes)
   */
  public isClientError(): boolean {
    return this.status !== undefined && this.status >= 400 && this.status < 500;
  }

  /**
   * Returns true if this error represents a server error (5xx status codes)
   */
  public isServerError(): boolean {
    return this.status !== undefined && this.status >= 500;
  }

  /**
   * Returns true if this error represents a network error (no response received)
   */
  public isNetworkError(): boolean {
    return this.status === undefined && "isAxiosError" in this.originalError;
  }
}

// A sorting type that can be used by any of our custom types when stored
// as arrays
export enum SortOrder {
  Ascending = "ascending",
  Descending = "descending",
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

  return transformed;
};
