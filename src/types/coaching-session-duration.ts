import { EntityApiError } from "@/types/general";

export const MIN_DURATION_MINUTES = 1;
export const MAX_DURATION_MINUTES = 480;
export const FALLBACK_DURATION_MINUTES = 60;

export const DURATION_PRESETS = [15, 30, 45, 60, 90, 120] as const;

export enum DurationErrorCode {
  ValidationError = "validation_error",
}

interface DurationErrorBody {
  status_code?: number;
  error?: string;
  message?: string;
}

export function validateDurationMinutes(value: number): string | null {
  if (!Number.isFinite(value)) {
    return "Duration must be a number.";
  }
  if (!Number.isInteger(value)) {
    return "Duration must be a whole number of minutes.";
  }
  if (value < MIN_DURATION_MINUTES) {
    return `Duration must be at least ${MIN_DURATION_MINUTES} minute.`;
  }
  if (value > MAX_DURATION_MINUTES) {
    return `Duration must be at most ${MAX_DURATION_MINUTES} minutes.`;
  }
  return null;
}

export function isDurationValidationError(
  err: unknown
): err is EntityApiError {
  if (!(err instanceof EntityApiError) || err.status !== 422) {
    return false;
  }
  const data = err.data as DurationErrorBody | null | undefined;
  return (
    !!data &&
    typeof data === "object" &&
    data.error === DurationErrorCode.ValidationError
  );
}
