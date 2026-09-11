/**
 * Small time helpers. The whole app speaks "minutes from local midnight"
 * (a float) internally, and only converts to strings at the very edge.
 */

export const MINUTES_PER_DAY = 1440;

/** Wrap any minute value into the [0, 1440) range. */
export function wrapMinutes(minutes: number): number {
  const m = minutes % MINUTES_PER_DAY;
  return m < 0 ? m + MINUTES_PER_DAY : m;
}

/** Minutes from midnight for a Date, in the machine's local zone. */
export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60 + date.getMilliseconds() / 60000;
}

/** Parse "HH:MM" (24h) into minutes from midnight. Returns null if unparseable. */
export function parseClock(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^\s*(\d{1,2})\s*[:.]\s*(\d{2})\s*$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return null;
  return hours * 60 + mins;
}

export type Rounding = 'nearest' | 'up' | 'down';

export function roundMinutes(minutes: number, mode: Rounding = 'nearest'): number {
  switch (mode) {
    case 'up':
      return Math.ceil(minutes - 1e-9);
    case 'down':
      return Math.floor(minutes + 1e-9);
    default:
      return Math.round(minutes);
  }
}

export interface ClockFormatOptions {
  /** 12-hour clock without an am/pm suffix, the way masjid boards print it. */
  hour12?: boolean;
  showSeconds?: boolean;
  showMeridiem?: boolean;
  padHour?: boolean;
}

/** Format minutes-from-midnight as a clock string. */
export function formatClock(minutes: number, options: ClockFormatOptions = {}): string {
  const { hour12 = true, showSeconds = false, showMeridiem = false, padHour = false } = options;
  if (!Number.isFinite(minutes)) return '--:--';

  const total = wrapMinutes(minutes);
  let hours = Math.floor(total / 60);
  const mins = Math.floor(total % 60);
  const secs = Math.floor((total * 60) % 60);
  const meridiem = hours < 12 ? 'AM' : 'PM';

  if (hour12) {
    hours = hours % 12;
    if (hours === 0) hours = 12;
  }

  const hourText = padHour ? String(hours).padStart(2, '0') : String(hours);
  let text = `${hourText}:${String(mins).padStart(2, '0')}`;
  if (showSeconds) text += `:${String(secs).padStart(2, '0')}`;
  if (showMeridiem) text += ` ${meridiem}`;
  return text;
}

/** Format a duration in seconds as H:MM:SS (hours dropped when zero). */
export function formatDuration(totalSeconds: number, alwaysShowHours = false): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clamped / 3600);
  const mins = Math.floor((clamped % 3600) / 60);
  const secs = clamped % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return hours > 0 || alwaysShowHours ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Midnight of the given date, local zone. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Whole days between two dates, ignoring the time of day. */
export function daysBetween(from: Date, to: Date): number {
  const a = startOfDay(from).getTime();
  const b = startOfDay(to).getTime();
  return Math.round((b - a) / 86400000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/** ISO "YYYY-MM-DD" in the local zone (Date#toISOString would shift the day). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Parse "YYYY-MM-DD" as a local-midnight Date. Returns null if unparseable. */
export function fromISODate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function formatGregorianDate(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/** The machine's UTC offset for a given date, in hours (east positive). */
export function localUtcOffsetHours(date: Date): number {
  return -date.getTimezoneOffset() / 60;
}
