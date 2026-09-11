/**
 * Tabular (arithmetical) Hijri calendar conversion, offline.
 *
 * The tabular calendar can run a day or two either side of local moon sighting,
 * which is why `adjustmentDays` exists — the masjid sets it once from the admin
 * panel to match whatever their sighting committee announced.
 */

export interface HijriDate {
  year: number;
  /** 1-12. */
  month: number;
  /** 1-30. */
  day: number;
  monthName: string;
  monthNameArabic: string;
  /** Day of the week in the Islamic naming, e.g. "Yawm al-Jumu'ah". */
  weekdayName: string;
  weekdayNameArabic: string;
}

export const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  "Rabi' ul Awwal",
  "Rabi' ul Aakhir",
  'Jumada al Ula',
  'Jumada al Aakhirah',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhul Qa'dah",
  'Dhul Hijjah',
] as const;

export const HIJRI_MONTHS_ARABIC = [
  'مُحَرَّم',
  'صَفَر',
  'رَبيع الأوّل',
  'رَبيع الآخر',
  'جُمادى الأولى',
  'جُمادى الآخرة',
  'رَجَب',
  'شَعْبان',
  'رَمَضان',
  'شَوّال',
  'ذو القعدة',
  'ذو الحجة',
] as const;

/** Indexed by JavaScript's getDay(): 0 = Sunday. */
export const ISLAMIC_WEEKDAYS = [
  "Yawm al-Ahad",
  "Yawm al-Ithnayn",
  "Yawm ath-Thulatha",
  "Yawm al-Arbi'a",
  "Yawm al-Khamis",
  "Yawm al-Jumu'ah",
  "Yawm as-Sabt",
] as const;

export const ISLAMIC_WEEKDAYS_ARABIC = [
  'يوم الأحد',
  'يوم الإثنين',
  'يوم الثلاثاء',
  'يوم الأربعاء',
  'يوم الخميس',
  'يوم الجمعة',
  'يوم السبت',
] as const;

/**
 * Integer division as the published calendar algorithms define it: truncated
 * toward zero, not floored. The difference only shows up on negative operands —
 * `(month - 14) / 12` for any month before March — but there it is a two-day
 * error in the resulting Julian Day, so it matters.
 */
const int = (n: number) => Math.trunc(n);

/** Chronological Julian Day Number for a Gregorian civil date. */
export function gregorianToJDN(year: number, month: number, day: number): number {
  const isGregorian =
    year > 1582 ||
    (year === 1582 && month > 10) ||
    (year === 1582 && month === 10 && day > 14);

  if (isGregorian) {
    return (
      int((1461 * (year + 4800 + int((month - 14) / 12))) / 4) +
      int((367 * (month - 2 - 12 * int((month - 14) / 12))) / 12) -
      int((3 * int((year + 4900 + int((month - 14) / 12)) / 100)) / 4) +
      day -
      32075
    );
  }
  return (
    367 * year -
    int((7 * (year + 5001 + int((month - 9) / 7))) / 4) +
    int((275 * month) / 9) +
    day +
    1729777
  );
}

/** Convert a Julian Day Number to a tabular Hijri year/month/day. */
export function jdnToHijri(jdn: number): { year: number; month: number; day: number } {
  let l = jdn - 1948440 + 10632;
  const n = int((l - 1) / 10631);
  l = l - 10631 * n + 354;
  const j =
    int((10985 - l) / 5316) * int((50 * l) / 17719) + int(l / 5670) * int((43 * l) / 15238);
  l =
    l -
    int((30 - j) / 15) * int((17719 * j) / 50) -
    int(j / 16) * int((15238 * j) / 43) +
    29;
  const month = int((24 * l) / 709);
  const day = l - int((709 * month) / 24);
  const year = 30 * n + j - 30;
  return { year, month, day };
}

/** Convert a tabular Hijri date back to a Julian Day Number. */
export function hijriToJDN(year: number, month: number, day: number): number {
  return (
    day +
    Math.ceil(29.5 * (month - 1)) +
    (year - 1) * 354 +
    int((3 + 11 * year) / 30) +
    1948440 -
    1
  );
}

/**
 * Hijri date for a Gregorian date.
 *
 * @param adjustmentDays  Shifts the result by whole days. Negative pulls the
 *                        Hijri date earlier; positive pushes it later.
 * @param maghribPassed   The Islamic day starts at maghrib, so after sunset the
 *                        board should already show tomorrow's Hijri date.
 */
export function toHijri(date: Date, adjustmentDays = 0, maghribPassed = false): HijriDate {
  const jdn =
    gregorianToJDN(date.getFullYear(), date.getMonth() + 1, date.getDate()) +
    adjustmentDays +
    (maghribPassed ? 1 : 0);
  const { year, month, day } = jdnToHijri(jdn);
  const monthIndex = Math.min(Math.max(month - 1, 0), 11);

  // After maghrib the Islamic weekday has also rolled over.
  const weekdayIndex = (date.getDay() + (maghribPassed ? 1 : 0)) % 7;

  return {
    year,
    month,
    day,
    monthName: HIJRI_MONTHS[monthIndex],
    monthNameArabic: HIJRI_MONTHS_ARABIC[monthIndex],
    weekdayName: ISLAMIC_WEEKDAYS[weekdayIndex],
    weekdayNameArabic: ISLAMIC_WEEKDAYS_ARABIC[weekdayIndex],
  };
}

export function formatHijri(hijri: HijriDate): string {
  return `${hijri.day} ${hijri.monthName} ${hijri.year}`;
}

// --- notable days --------------------------------------------------------------

export interface IslamicOccasion {
  name: string;
  /** Hijri month (1-12). */
  month: number;
  /** Hijri day. */
  day: number;
  note?: string;
}

export const ISLAMIC_OCCASIONS: IslamicOccasion[] = [
  { name: 'Islamic New Year', month: 1, day: 1, note: '1 Muharram' },
  { name: 'Day of Ashura', month: 1, day: 10, note: 'Fasting is greatly encouraged' },
  { name: "Mawlid un-Nabi ﷺ", month: 3, day: 12 },
  { name: "Lailatul Mi'raj", month: 7, day: 27 },
  { name: "Lailatul Bara'ah", month: 8, day: 15, note: 'The 15th night of Shaʿban' },
  { name: 'First Day of Ramadan', month: 9, day: 1, note: 'Taraweeh begins the night before' },
  { name: 'Lailatul Qadr (sought)', month: 9, day: 27, note: 'Seek it in the odd nights of the last ten' },
  { name: 'Eid ul Fitr', month: 10, day: 1 },
  { name: 'Day of Arafah', month: 12, day: 9, note: 'Fasting expiates two years of sins' },
  { name: 'Eid ul Adha', month: 12, day: 10 },
];

export interface UpcomingOccasion extends IslamicOccasion {
  gregorianDate: Date;
  daysAway: number;
}

/**
 * The next occurrences of the notable Islamic days, soonest first.
 * Uses tabular conversion, so treat the dates as approximate — as every masjid
 * notice does — pending moon sighting.
 */
export function upcomingOccasions(from: Date, adjustmentDays = 0, limit = 4): UpcomingOccasion[] {
  const todayJdn =
    gregorianToJDN(from.getFullYear(), from.getMonth() + 1, from.getDate()) + adjustmentDays;
  const current = jdnToHijri(todayJdn);

  const results: UpcomingOccasion[] = [];
  for (const occasion of ISLAMIC_OCCASIONS) {
    for (const year of [current.year, current.year + 1]) {
      const jdn = hijriToJDN(year, occasion.month, occasion.day);
      const daysAway = jdn - todayJdn;
      if (daysAway < 0) continue;
      results.push({
        ...occasion,
        daysAway,
        gregorianDate: jdnToGregorian(jdn - adjustmentDays),
      });
      break;
    }
  }

  return results.sort((a, b) => a.daysAway - b.daysAway).slice(0, limit);
}

/** Inverse of {@link gregorianToJDN}. */
export function jdnToGregorian(jdn: number): Date {
  let l = jdn + 68569;
  const n = int((4 * l) / 146097);
  l = l - int((146097 * n + 3) / 4);
  const i = int((4000 * (l + 1)) / 1461001);
  l = l - int((1461 * i) / 4) + 31;
  const j = int((80 * l) / 2447);
  const day = l - int((2447 * j) / 80);
  l = int(j / 11);
  const month = j + 2 - 12 * l;
  const year = 100 * (n - 49) + i + l;
  return new Date(year, month - 1, day);
}

/** True when the given Hijri date falls in Ramadan. */
export function isRamadan(hijri: HijriDate): boolean {
  return hijri.month === 9;
}

/** True during the last ten nights of Ramadan. */
export function isLastTenNights(hijri: HijriDate): boolean {
  return hijri.month === 9 && hijri.day >= 21;
}

/** The occasion falling exactly on this Hijri date, if any. */
export function occasionOn(hijri: HijriDate): IslamicOccasion | null {
  return (
    ISLAMIC_OCCASIONS.find((o) => o.month === hijri.month && o.day === hijri.day) ?? null
  );
}
