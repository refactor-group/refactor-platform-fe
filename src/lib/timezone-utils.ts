import { DateTime } from "ts-luxon";

// Memoized timezone list to avoid recomputing on every call
let cachedTimezones: Array<{ value: string; label: string }> | null = null;

/**
 * Get region prefix from a timezone (e.g., "America" from "America/New_York")
 */
function getTimezoneRegion(timezone: string): string {
  return timezone.split('/')[0];
}

/**
 * Get intelligently filtered timezones based on user's browser region
 */
export function getTimezones(): Array<{ value: string; label: string }> {
  // Return cached result if already computed
  if (cachedTimezones) {
    return cachedTimezones;
  }

  try {
    // Use the modern Intl.supportedValuesOf API
    if ('supportedValuesOf' in Intl) {
      const allTimezones = Intl.supportedValuesOf('timeZone');
      const browserTimezone = getBrowserTimezone();
      const userRegion = getTimezoneRegion(browserTimezone);
      
      // Filter timezones to user's region first, then add a few major global cities
      const regionalTimezones = allTimezones.filter(tz => tz.startsWith(`${userRegion}/`));
      
      // Add major global timezones that users commonly need
      const majorGlobalTimezones = [
        'UTC',
        'America/New_York',
        'America/Chicago', 
        'America/Denver',
        'America/Los_Angeles',
        'Europe/London',
        'Europe/Paris',
        'Europe/Berlin',
        'Asia/Tokyo',
        'Asia/Shanghai',
        'Asia/Kolkata',
        'Australia/Sydney'
      ].filter(tz => !regionalTimezones.includes(tz));
      
      // Combine regional timezones with major global ones
      const filteredTimezones = [...regionalTimezones, ...majorGlobalTimezones];
      
      // Pre-compute current time for efficiency
      const now = DateTime.now();
      
      cachedTimezones = filteredTimezones
        .sort()
        .map(tz => ({
          value: tz,
          label: formatTimezoneLabel(tz, now)
        }));
      
      return cachedTimezones;
    }
  } catch (error) {
    console.warn('Intl.supportedValuesOf not available, using browser timezone only:', error);
  }

  // Fallback if API not available
  const fallback = [{ value: getBrowserTimezone(), label: formatTimezoneLabel(getBrowserTimezone()) }];
  cachedTimezones = fallback;
  return fallback;
}

/**
 * Format timezone string into a human-readable label
 */
function formatTimezoneLabel(timezone: string, baseTime?: DateTime): string {
  try {
    const now = baseTime ? baseTime.setZone(timezone) : DateTime.now().setZone(timezone);
    const offset = now.toFormat('ZZ');
    const city = timezone.split('/').pop()?.replace(/_/g, ' ') || timezone;
    return `${city} (${offset})`;
  } catch {
    return timezone;
  }
}

/**
 * Format a date string in the user's timezone
 * Assumes the input dateString is in UTC and converts it to the user's timezone
 */
export function formatDateInUserTimezone(
  dateString: string,
  timezone: string,
  format?: string
): string {
  try {
    // Parse as UTC first, then convert to user timezone
    const dt = DateTime.fromISO(dateString, { zone: 'utc' });
    if (!dt.isValid) {
      // Try parsing as a generic date and assume UTC
      const fallbackDt = DateTime.fromJSDate(new Date(dateString)).toUTC();
      if (!fallbackDt.isValid) {
        return dateString;
      }
      return fallbackDt.setZone(timezone).toLocaleString(
        format ? undefined : DateTime.DATETIME_FULL
      );
    }
    
    const zonedDt = dt.setZone(timezone);
    if (format) {
      return zonedDt.toFormat(format);
    }
    return zonedDt.toLocaleString(DateTime.DATETIME_FULL);
  } catch (error) {
    console.warn(`Failed to format date ${dateString} in timezone ${timezone}:`, error);
    return dateString;
  }
}

/**
 * Format a date string in the user's timezone with a shorter format
 */
export function formatDateInUserTimezoneShort(
  dateString: string,
  timezone: string
): string {
  try {
    // Parse as UTC first, then convert to user timezone
    const dt = DateTime.fromISO(dateString, { zone: 'utc' });
    if (!dt.isValid) {
      // Try parsing as a generic date and assume UTC
      const fallbackDt = DateTime.fromJSDate(new Date(dateString)).toUTC();
      if (!fallbackDt.isValid) {
        return dateString;
      }
      return fallbackDt.setZone(timezone).toFormat("MMM d, yyyy h:mm a");
    }
    
    return dt.setZone(timezone).toFormat("MMM d, yyyy h:mm a");
  } catch (error) {
    console.warn(`Failed to format date ${dateString} in timezone ${timezone}:`, error);
    return dateString;
  }
}

/**
 * Format a date string in the user's timezone with timezone abbreviation
 */
export function formatDateInUserTimezoneWithTZ(
  dateString: string,
  timezone: string
): string {
  try {
    // Parse as UTC first, then convert to user timezone
    const dt = DateTime.fromISO(dateString, { zone: 'utc' });
    if (!dt.isValid) {
      // Try parsing as a generic date and assume UTC
      const fallbackDt = DateTime.fromJSDate(new Date(dateString)).toUTC();
      if (!fallbackDt.isValid) {
        return dateString;
      }
      return fallbackDt.setZone(timezone).toFormat("MMM d, yyyy h:mm a ZZZZ");
    }
    
    return dt.setZone(timezone).toFormat("MMM d, yyyy h:mm a ZZZZ");
  } catch (error) {
    console.warn(`Failed to format date ${dateString} in timezone ${timezone}:`, error);
    return dateString;
  }
}

/**
 * Format a date string in the user's timezone with medium format
 */
export function formatDateInUserTimezoneMedium(
  dateString: string,
  timezone: string
): string {
  try {
    const dt = DateTime.fromISO(dateString, { zone: 'utc' });
    if (!dt.isValid) {
      const fallbackDt = DateTime.fromJSDate(new Date(dateString)).toUTC();
      if (!fallbackDt.isValid) {
        return dateString;
      }
      return fallbackDt.setZone(timezone).toLocaleString(DateTime.DATETIME_MED);
    }
    
    return dt.setZone(timezone).toLocaleString(DateTime.DATETIME_MED);
  } catch (error) {
    console.warn(`Failed to format date ${dateString} in timezone ${timezone}:`, error);
    return dateString;
  }
}

/**
 * Get the user's browser timezone as a fallback
 */
export function getBrowserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.warn("Failed to get browser timezone:", error);
    return "UTC";
  }
}

/**
 * Validate if a timezone string is valid
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    DateTime.now().setZone(timezone);
    return true;
  } catch {
    return false;
  }
}