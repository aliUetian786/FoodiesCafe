/**
 * Human-friendly order timestamps in Pakistan time, e.g. "15 Nov, 7:38 PM".
 * Strings that are not ISO dates (e.g. "Just now", "10 mins ago") are returned unchanged.
 */
const formatter = new Intl.DateTimeFormat('en-PK', {
  timeZone: 'Asia/Karachi',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

export function formatOrderTime(value?: string | number | Date | null): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}T/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return formatter.format(d);
}
