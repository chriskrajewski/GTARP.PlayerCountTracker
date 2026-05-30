/**
 * Pure presentation helpers for Insights / Wrapped reports (R5).
 *
 * These are intentionally dependency-free and side-effect-free so they can be
 * shared by the server-rendered Wrapped pages AND the `opengraph-image.tsx`
 * route (which runs in a constrained runtime). All month/day parsing is done in
 * UTC to match how `lib/insights.ts` derives the metrics (UTC calendar bounds).
 */

import { isValidMonth } from './insights';

/**
 * Format a `'YYYY-MM'` month key as a human label, e.g. `'2024-01'` ->
 * `'January 2024'`. Returns the raw input unchanged for a malformed month.
 */
export function formatMonthLabel(month: string): string {
  if (!isValidMonth(month)) return month;
  const [year, monthNum] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNum - 1, 1));
  return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Format a `'YYYY-MM-DD'` day key as a human label, e.g. `'2024-01-15'` ->
 * `'January 15, 2024'`. Returns the raw input unchanged for a malformed day.
 */
export function formatDayLabel(day: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  const [year, monthNum, dayNum] = day.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNum - 1, dayNum));
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Format an integer-ish number with thousands separators (e.g. `12345` -> `'12,345'`). */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

/**
 * Format an absolute month-over-month growth value with an explicit sign, e.g.
 * `1234 -> '+1,234'`, `-500 -> '-500'`, `0 -> '+0'`.
 */
export function formatGrowth(growth: number): string {
  const sign = growth >= 0 ? '+' : '';
  return `${sign}${formatNumber(growth)}`;
}
