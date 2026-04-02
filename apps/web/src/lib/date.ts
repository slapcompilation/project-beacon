// Layer: Floor — shared date formatting utility
// Reads the user's preferred date format from user prefs and formats consistently.

import { format, parseISO, isValid } from 'date-fns'

/** date-fns token → human label */
export const DATE_FORMATS: { value: string; label: string; example: string }[] = [
  { value: 'dd/MM/yyyy',   label: 'DD/MM/YYYY',   example: '23/03/2026' },
  { value: 'MM/dd/yyyy',   label: 'MM/DD/YYYY',   example: '03/23/2026' },
  { value: 'yyyy-MM-dd',   label: 'YYYY-MM-DD',   example: '2026-03-23' },
  { value: 'dd.MM.yyyy',   label: 'DD.MM.YYYY',   example: '23.03.2026' },
  { value: 'd MMM yyyy',   label: 'D MMM YYYY',   example: '23 Mar 2026' },
  { value: 'MMM d, yyyy',  label: 'MMM D, YYYY',  example: 'Mar 23, 2026' },
  { value: 'MMMM d, yyyy', label: 'MMMM D, YYYY', example: 'March 23, 2026' },
  { value: 'yyyy/MM/dd',   label: 'YYYY/MM/DD',   example: '2026/03/23' },
]

export const DEFAULT_DATE_FORMAT = 'dd/MM/yyyy'

/**
 * Returns the number of whole days between today (midnight) and a date string.
 * Negative = already past.
 */
export function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86400000)
}

/**
 * Format a date string or Date object using the given format token.
 * Returns '' if the input is not a valid date.
 */
export function formatDate(
  date: string | Date | null | undefined,
  fmt: string = DEFAULT_DATE_FORMAT,
): string {
  if (!date) return ''
  const d = typeof date === 'string' ? parseISO(date) : date
  if (!isValid(d)) return ''
  return format(d, fmt)
}
