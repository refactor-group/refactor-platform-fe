import { Result, ok, err } from "neverthrow";
import { EntityApiError } from "@/types/general";

export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 480;
export const FALLBACK_DURATION_MINUTES = 60;

export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120] as const;

export enum DurationErrorCode {
  ValidationError = "validation_error",
}

export interface DurationErrorBody {
  status_code?: number;
  error: DurationErrorCode.ValidationError;
  message: string;
}

export function validateDurationMinutes(value: number): Result<number, string> {
  if (!Number.isFinite(value)) {
    return err("Duration must be a number.");
  }
  if (!Number.isInteger(value)) {
    return err("Duration must be a whole number of minutes.");
  }
  if (value < MIN_DURATION_MINUTES) {
    return err(`Duration must be at least ${MIN_DURATION_MINUTES} minute.`);
  }
  if (value > MAX_DURATION_MINUTES) {
    return err(`Duration must be at most ${MAX_DURATION_MINUTES} minutes.`);
  }
  return ok(value);
}

export function isDurationValidationError(
  error: unknown
): error is EntityApiError & { data: DurationErrorBody } {
  if (!(error instanceof EntityApiError) || error.status !== 422) {
    return false;
  }
  const data = error.data as Partial<DurationErrorBody> | null | undefined;
  return (
    !!data &&
    typeof data === "object" &&
    data.error === DurationErrorCode.ValidationError &&
    typeof data.message === "string"
  );
}
