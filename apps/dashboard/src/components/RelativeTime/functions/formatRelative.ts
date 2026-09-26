const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;
const WEEK = DAY * 7;
const MONTH = DAY * 30;
const YEAR = DAY * 365;

/**
 * Picks the largest unit that still describes the gap, then lets `Intl` say it
 * in the active language. Hand-rolled "X ago" strings are how a dashboard ends
 * up with English plurals inside an Arabic sentence.
 */
export function formatRelative(date: Date, language: string): string {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absolute = Math.abs(seconds);

  const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });

  if (absolute < MINUTE) return formatter.format(Math.round(seconds), 'second');
  if (absolute < HOUR)
    return formatter.format(Math.round(seconds / MINUTE), 'minute');
  if (absolute < DAY) return formatter.format(Math.round(seconds / HOUR), 'hour');
  if (absolute < WEEK) return formatter.format(Math.round(seconds / DAY), 'day');
  if (absolute < MONTH)
    return formatter.format(Math.round(seconds / WEEK), 'week');
  if (absolute < YEAR)
    return formatter.format(Math.round(seconds / MONTH), 'month');

  return formatter.format(Math.round(seconds / YEAR), 'year');
}
