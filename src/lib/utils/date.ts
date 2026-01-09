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

/**
 * Format a DateTime as weekday and date (e.g., "Sunday, January 4")
 */
export function formatWeekdayDate(date: DateTime): string {
  return date.toFormat("EEEE, MMMM d");
}

/**
 * Returns a DateTime representing one year ago from now
 */
export function getOneYearAgo(): DateTime {
  return DateTime.now().minus({ years: 1 });
}

/**
 * Returns a DateTime representing one year from now
 */
export function getOneYearFromNow(): DateTime {
  return DateTime.now().plus({ years: 1 });
}
