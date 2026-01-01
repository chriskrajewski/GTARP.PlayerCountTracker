/**
 * Timezone Utilities Test
 * 
 * Tests for timezone conversion and formatting functions
 */

import {
  formatToLocalTimezone,
  getUserTimezoneOffset,
  getUserTimezoneName,
  formatTimeAgo,
  formatDateWithTimezone,
  formatDateForExport,
  convertUTCToLocal
} from '@/lib/timezone-utils';

describe('Timezone Utilities', () => {
  // Test date: 2024-01-15T10:30:00Z
  const testDate = new Date('2024-01-15T10:30:00Z');
  const testDateString = '2024-01-15T10:30:00Z';

  describe('formatToLocalTimezone', () => {
    it('should format date in full format', () => {
      const result = formatToLocalTimezone(testDate, 'full');
      expect(result).toBeTruthy();
      expect(result).not.toBe('Invalid date');
    });

    it('should format date in date-only format', () => {
      const result = formatToLocalTimezone(testDate, 'date');
      expect(result).toBeTruthy();
      expect(result).not.toBe('Invalid date');
    });

    it('should format date in time-only format', () => {
      const result = formatToLocalTimezone(testDate, 'time');
      expect(result).toBeTruthy();
      expect(result).not.toBe('Invalid date');
    });

    it('should format date in short format', () => {
      const result = formatToLocalTimezone(testDate, 'short');
      expect(result).toBeTruthy();
      expect(result).not.toBe('Invalid date');
    });

    it('should handle string input', () => {
      const result = formatToLocalTimezone(testDateString, 'full');
      expect(result).toBeTruthy();
      expect(result).not.toBe('Invalid date');
    });

    it('should handle invalid dates gracefully', () => {
      const result = formatToLocalTimezone('invalid-date', 'full');
      expect(result).toBe('Invalid date');
    });
  });

  describe('getUserTimezoneOffset', () => {
    it('should return a valid timezone offset string', () => {
      const result = getUserTimezoneOffset();
      expect(result).toBeTruthy();
      expect(result).toMatch(/^UTC[+-]\d+/);
    });
  });

  describe('getUserTimezoneName', () => {
    it('should return a valid timezone name', () => {
      const result = getUserTimezoneName();
      expect(result).toBeTruthy();
      expect(result).not.toBe('Unknown');
    });
  });

  describe('formatTimeAgo', () => {
    it('should format recent times as "Just now"', () => {
      const now = new Date();
      const result = formatTimeAgo(now);
      expect(result).toBe('Just now');
    });

    it('should format times in minutes', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const result = formatTimeAgo(fiveMinutesAgo);
      expect(result).toMatch(/^\d+m ago$/);
    });

    it('should format times in hours', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const result = formatTimeAgo(twoHoursAgo);
      expect(result).toMatch(/^\d+h ago$/);
    });

    it('should format times in days', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const result = formatTimeAgo(threeDaysAgo);
      expect(result).toMatch(/^\d+d ago$/);
    });

    it('should handle string input', () => {
      const result = formatTimeAgo(testDateString);
      expect(result).toBeTruthy();
    });
  });

  describe('formatDateWithTimezone', () => {
    it('should format date without timezone info', () => {
      const result = formatDateWithTimezone(testDate, false);
      expect(result).toBeTruthy();
      expect(result).not.toBe('Invalid date');
    });

    it('should format date with timezone info', () => {
      const result = formatDateWithTimezone(testDate, true);
      expect(result).toBeTruthy();
      expect(result).not.toBe('Invalid date');
      expect(result).toMatch(/UTC[+-]/);
    });
  });

  describe('formatDateForExport', () => {
    it('should format date as ISO string', () => {
      const result = formatDateForExport(testDate);
      expect(result).toBeTruthy();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('should handle string input', () => {
      const result = formatDateForExport(testDateString);
      expect(result).toBeTruthy();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('convertUTCToLocal', () => {
    it('should convert UTC to local time', () => {
      const result = convertUTCToLocal(testDateString);
      expect(result).toBeTruthy();
      expect(result).not.toBe('Invalid date');
    });

    it('should handle invalid input gracefully', () => {
      const result = convertUTCToLocal('invalid-date');
      expect(result).toBe('Invalid date');
    });
  });
});
