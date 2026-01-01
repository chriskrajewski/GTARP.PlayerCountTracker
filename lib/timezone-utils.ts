/**
 * Timezone Utilities
 * 
 * Provides utilities for converting and formatting dates/times
 * in the user's local timezone throughout the admin panel.
 */

/**
 * Format a date/time string to the user's local timezone
 * @param dateString - ISO string or Date object
 * @param format - Format string (default: 'MMM dd, yyyy HH:mm:ss')
 * @returns Formatted date string in user's local timezone
 */
export function formatToLocalTimezone(
  dateString: string | Date,
  format: 'full' | 'date' | 'time' | 'short' = 'full'
): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    
    if (isNaN(date.getTime())) {
      return 'Invalid date';
    }

    const options: Intl.DateTimeFormatOptions = {};

    switch (format) {
      case 'full':
        options.year = 'numeric';
        options.month = 'short';
        options.day = '2-digit';
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
        break;
      case 'date':
        options.year = 'numeric';
        options.month = 'short';
        options.day = '2-digit';
        break;
      case 'time':
        options.hour = '2-digit';
        options.minute = '2-digit';
        options.second = '2-digit';
        break;
      case 'short':
        options.year = 'numeric';
        options.month = 'short';
        options.day = '2-digit';
        options.hour = '2-digit';
        options.minute = '2-digit';
        break;
    }

    return new Intl.DateTimeFormat('en-US', options).format(date);
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid date';
  }
}

/**
 * Get the user's timezone offset
 * @returns Timezone offset string (e.g., "UTC-5" or "UTC+1")
 */
export function getUserTimezoneOffset(): string {
  const date = new Date();
  const offset = -date.getTimezoneOffset();
  const hours = Math.floor(Math.abs(offset) / 60);
  const minutes = Math.abs(offset) % 60;
  const sign = offset >= 0 ? '+' : '-';
  
  return `UTC${sign}${hours}${minutes > 0 ? `:${minutes.toString().padStart(2, '0')}` : ''}`;
}

/**
 * Get the user's timezone name
 * @returns Timezone name (e.g., "America/New_York")
 */
export function getUserTimezoneName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error('Error getting timezone name:', error);
    return 'Unknown';
  }
}

/**
 * Format time ago string with timezone awareness
 * @param timestamp - ISO string or Date object
 * @returns Time ago string (e.g., "5m ago", "2h ago")
 */
export function formatTimeAgo(timestamp: string | Date): string {
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return formatToLocalTimezone(date, 'date');
  } catch (error) {
    console.error('Error formatting time ago:', error);
    return 'Unknown';
  }
}

/**
 * Format a date for display with timezone indicator
 * @param dateString - ISO string or Date object
 * @param includeTimezone - Whether to include timezone info
 * @returns Formatted date string with optional timezone
 */
export function formatDateWithTimezone(
  dateString: string | Date,
  includeTimezone: boolean = false
): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const formatted = formatToLocalTimezone(date, 'full');
    
    if (includeTimezone) {
      const tz = getUserTimezoneOffset();
      return `${formatted} ${tz}`;
    }
    
    return formatted;
  } catch (error) {
    console.error('Error formatting date with timezone:', error);
    return 'Invalid date';
  }
}

/**
 * Format a date for CSV export with timezone awareness
 * @param dateString - ISO string or Date object
 * @returns ISO string in user's local timezone
 */
export function formatDateForExport(dateString: string | Date): string {
  try {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toISOString();
  } catch (error) {
    console.error('Error formatting date for export:', error);
    return '';
  }
}

/**
 * Convert UTC time to local time string
 * @param utcString - UTC ISO string
 * @returns Local time string
 */
export function convertUTCToLocal(utcString: string): string {
  try {
    const date = new Date(utcString);
    return formatToLocalTimezone(date, 'full');
  } catch (error) {
    console.error('Error converting UTC to local:', error);
    return 'Invalid date';
  }
}
