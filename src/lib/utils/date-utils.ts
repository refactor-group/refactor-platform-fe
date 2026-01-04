import { DateTime } from "ts-luxon";

/**
 * Date Utility Functions
 * Simple date formatting utilities that don't involve timezone conversions
 */

/**
 * Format a DateTime as a short date string (e.g., "Jan 3, 2026")
 */
export function formatShortDate(date: DateTime): string {
  return date.toFormat("MMM d, yyyy");
}

/**
 * Format a DateTime as a long date string (e.g., "January 3, 2026")
 */
export function formatLongDate(date: DateTime): string {
  return date.toFormat("MMMM d, yyyy");
}

/**
 * Format a DateTime with time (e.g., "Jan 3, 2026 at 2:30 PM")
 */
export function formatDateWithTime(date: DateTime): string {
  return date.toFormat("MMM d, yyyy 'at' h:mm a");
}
