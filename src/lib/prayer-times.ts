/**
 * Offline astronomical salaah-time engine.
 *
 * Follows the standard sun-position approach used by PrayTimes.org: compute the
 * sun's declination and equation of time for the moment in question, then solve
 * the hour angle for each depression angle. Everything here is pure maths — no
 * network, no data files — so the board keeps working when the internet doesn't.
 *
 * All returned times are minutes from local midnight (float, may be fractional).
 */

import { MINUTES_PER_DAY } from './time.ts';

// --- degree-based trig helpers -------------------------------------------------

const dtr = (d: number) => (d * Math.PI) / 180;
const rtd = (r: number) => (r * 180) / Math.PI;

const sin = (d: number) => Math.sin(dtr(d));
const cos = (d: number) => Math.cos(dtr(d));
const tan = (d: number) => Math.tan(dtr(d));
const arcsin = (x: number) => rtd(Math.asin(x));
const arccos = (x: number) => rtd(Math.acos(x));
const arctan2 = (y: number, x: number) => rtd(Math.atan2(y, x));
const arccot = (x: number) => rtd(Math.atan(1 / x));

function fixAngle(a: number): number {
  const v = a - 360 * Math.floor(a / 360);
  return v < 0 ? v + 360 : v;
}

function fixHour(a: number): number {
  const v = a - 24 * Math.floor(a / 24);
  return v < 0 ? v + 24 : v;
}

// --- configuration -------------------------------------------------------------

export type PrayerKey = 'fajr' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';

export const PRAYER_KEYS: PrayerKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export type HighLatitudeRule = 'none' | 'middleOfNight' | 'seventhOfNight' | 'angleBased';

export type AsrJuristic = 'standard' | 'hanafi';

/**
 * A parameter that is either a sun depression angle in degrees, or a fixed
 * number of minutes after/before the anchoring event (used by Umm al-Qura for
 * Isha, and by most boards for Imsak/Maghrib).
 */
export type AngleOrMinutes = { type: 'angle'; value: number } | { type: 'minutes'; value: number };

export interface CalculationParams {
  fajrAngle: number;
  ishaParam: AngleOrMinutes;
  /** Depression angle for Maghrib; most schools use plain sunset (0 minutes). */
  maghribParam: AngleOrMinutes;
  /** Imsak precedes Fajr; conventionally 10 minutes. */
  imsakParam: AngleOrMinutes;
  /** Minutes added to solar noon so Dhuhr falls safely after zawaal. */
  dhuhrMinutes: number;
  asrJuristic: AsrJuristic;
  highLatitudeRule: HighLatitudeRule;
}

export type CalculationMethodId =
  | 'MWL'
  | 'ISNA'
  | 'Egypt'
  | 'Makkah'
  | 'Karachi'
  | 'Tehran'
  | 'Jafari'
  | 'Gulf'
  | 'Kuwait'
  | 'Qatar'
  | 'Singapore'
  | 'Turkey'
  | 'SouthAfrica'
  | 'Custom';

export interface CalculationMethod {
  id: CalculationMethodId;
  name: string;
  description: string;
  params: Pick<CalculationParams, 'fajrAngle' | 'ishaParam' | 'maghribParam' | 'dhuhrMinutes'>;
}

const angle = (value: number): AngleOrMinutes => ({ type: 'angle', value });
const minutes = (value: number): AngleOrMinutes => ({ type: 'minutes', value });

export const CALCULATION_METHODS: CalculationMethod[] = [
  {
    id: 'MWL',
    name: 'Muslim World League',
    description: 'Fajr 18°, Isha 17°. Widely used across Europe and the Far East.',
    params: { fajrAngle: 18, ishaParam: angle(17), maghribParam: minutes(0), dhuhrMinutes: 1 },
  },
  {
    id: 'ISNA',
    name: 'Islamic Society of North America',
    description: 'Fajr 15°, Isha 15°.',
    params: { fajrAngle: 15, ishaParam: angle(15), maghribParam: minutes(0), dhuhrMinutes: 1 },
  },
  {
    id: 'Egypt',
    name: 'Egyptian General Authority of Survey',
    description: 'Fajr 19.5°, Isha 17.5°.',
    params: { fajrAngle: 19.5, ishaParam: angle(17.5), maghribParam: minutes(0), dhuhrMinutes: 1 },
  },
  {
    id: 'Makkah',
    name: 'Umm al-Qura, Makkah',
    description: 'Fajr 18.5°, Isha 90 minutes after Maghrib.',
    params: { fajrAngle: 18.5, ishaParam: minutes(90), maghribParam: minutes(0), dhuhrMinutes: 1 },
  },
  {
    id: 'Karachi',
    name: 'University of Islamic Sciences, Karachi',
    description: 'Fajr 18°, Isha 18°. Common across the Indian subcontinent.',
    params: { fajrAngle: 18, ishaParam: angle(18), maghribParam: minutes(0), dhuhrMinutes: 1 },
  },
  {
    id: 'Tehran',
    name: 'Institute of Geophysics, University of Tehran',
    description: 'Fajr 17.7°, Maghrib 4.5°, Isha 14°.',
    params: { fajrAngle: 17.7, ishaParam: angle(14), maghribParam: angle(4.5), dhuhrMinutes: 1 },
  },
  {
    id: 'Jafari',
    name: 'Shia Ithna-Ashari (Jafari)',
    description: 'Fajr 16°, Maghrib 4°, Isha 14°.',
    params: { fajrAngle: 16, ishaParam: angle(14), maghribParam: angle(4), dhuhrMinutes: 1 },
  },
  {
    id: 'Gulf',
    name: 'Gulf Region',
    description: 'Fajr 19.5°, Isha 90 minutes after Maghrib.',
    params: { fajrAngle: 19.5, ishaParam: minutes(90), maghribParam: minutes(0), dhuhrMinutes: 1 },
  },
  {
    id: 'Kuwait',
    name: 'Kuwait',
    description: 'Fajr 18°, Isha 17.5°.',
    params: { fajrAngle: 18, ishaParam: angle(17.5), maghribParam: minutes(0), dhuhrMinutes: 1 },
  },
  {
    id: 'Qatar',
    name: 'Qatar',
    description: 'Fajr 18°, Isha 90 minutes after Maghrib.',
    params: { fajrAngle: 18, ishaParam: minutes(90), maghribParam: minutes(0), dhuhrMinutes: 1 },
  },
  {
    id: 'Singapore',
    name: 'Majlis Ugama Islam Singapura',
    description: 'Fajr 20°, Isha 18°.',
    params: { fajrAngle: 20, ishaParam: angle(18), maghribParam: minutes(0), dhuhrMinutes: 1 },
  },
  {
    id: 'Turkey',
    name: 'Diyanet İşleri Başkanlığı, Turkey',
    description: 'Fajr 18°, Isha 17°.',
    params: { fajrAngle: 18, ishaParam: angle(17), maghribParam: minutes(0), dhuhrMinutes: 1 },
  },
  {
    id: 'SouthAfrica',
    name: 'South Africa (Jamiatul Ulama)',
    description: 'Fajr 18°, Isha 17°, with a 2 minute Dhuhr allowance after zawaal.',
    params: { fajrAngle: 18, ishaParam: angle(17), maghribParam: minutes(0), dhuhrMinutes: 2 },
  },
  {
    id: 'Custom',
    name: 'Custom angles',
    description: 'Set the Fajr and Isha parameters by hand.',
    params: { fajrAngle: 18, ishaParam: angle(17), maghribParam: minutes(0), dhuhrMinutes: 1 },
  },
];

export function getMethod(id: CalculationMethodId): CalculationMethod {
  return CALCULATION_METHODS.find((m) => m.id === id) ?? CALCULATION_METHODS[0];
}

// --- solar geometry ------------------------------------------------------------

/** Julian day number for a civil calendar date at 00:00 UT. */
export function julianDay(year: number, month: number, day: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524.5;
}

export interface SunPosition {
  /** Declination of the sun, degrees. */
  declination: number;
  /** Equation of time, hours. */
  equationOfTime: number;
}

/** Low-precision sun position (good to well under a minute for salaah use). */
export function sunPosition(jd: number): SunPosition {
  const d = jd - 2451545.0;
  const g = fixAngle(357.529 + 0.98560028 * d); // mean anomaly
  const q = fixAngle(280.459 + 0.98564736 * d); // mean longitude
  const l = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g)); // ecliptic longitude
  const e = 23.439 - 0.00000036 * d; // obliquity of the ecliptic
  const ra = arctan2(cos(e) * sin(l), cos(l)) / 15; // right ascension, hours
  return {
    declination: arcsin(sin(e) * sin(l)),
    equationOfTime: q / 15 - fixHour(ra),
  };
}

export interface Location {
  latitude: number;
  longitude: number;
  /** Metres above sea level; lifts the horizon slightly for sunrise/sunset. */
  elevation?: number;
}

/**
 * Per-prayer manual nudges in minutes, applied after calculation. Masjids
 * routinely shift Fajr a couple of minutes for precaution.
 */
export type PrayerAdjustments = Partial<Record<TimeKey, number>>;

export type TimeKey =
  | 'imsak'
  | 'fajr'
  | 'sunrise'
  | 'ishraaq'
  | 'zawaal'
  | 'dhuhr'
  | 'asr'
  | 'asrHanafi'
  | 'sunset'
  | 'maghrib'
  | 'isha'
  | 'midnight'
  | 'lastThird';

export interface PrayerTimeOptions {
  location: Location;
  params: CalculationParams;
  /** UTC offset in hours (east positive). Defaults to the machine's own offset. */
  utcOffset?: number;
  adjustments?: PrayerAdjustments;
  /** Minutes after sunrise at which Ishraaq/Duha is announced. */
  ishraaqOffset?: number;
}

export type PrayerTimeTable = Record<TimeKey, number>;

/** Depression angle of the sun's upper limb at sunrise/sunset, refraction included. */
function riseSetAngle(elevation = 0): number {
  return 0.833 + 0.0347 * Math.sign(elevation) * Math.sqrt(Math.abs(elevation));
}

/**
 * Compute all solar times for a date at a location.
 * Returns minutes from local midnight.
 */
export function computePrayerTimes(date: Date, options: PrayerTimeOptions): PrayerTimeTable {
  const { location, params } = options;
  const { latitude: lat, longitude: lng, elevation = 0 } = location;
  const utcOffset = options.utcOffset ?? -date.getTimezoneOffset() / 60;
  const ishraaqOffset = options.ishraaqOffset ?? 12;

  // Julian day for local midnight, shifted to the meridian of the location.
  const jdBase = julianDay(date.getFullYear(), date.getMonth() + 1, date.getDate()) - lng / (15 * 24);

  const declinationAt = (dayFraction: number) => sunPosition(jdBase + dayFraction).declination;
  const solarNoon = (dayFraction: number) => fixHour(12 - sunPosition(jdBase + dayFraction).equationOfTime);

  /**
   * UT hour at which the sun sits `depression` degrees below the horizon.
   * `direction` 'before' returns the morning occurrence, 'after' the evening one.
   */
  const sunAngleTime = (depression: number, dayFraction: number, direction: 'before' | 'after') => {
    const decl = declinationAt(dayFraction);
    const noon = solarNoon(dayFraction);
    const numerator = -sin(depression) - sin(decl) * sin(lat);
    const denominator = cos(decl) * cos(lat);
    const ratio = numerator / denominator;
    // |ratio| > 1 means the sun never reaches that depression today.
    if (ratio > 1 || ratio < -1) return NaN;
    const hourAngle = arccos(ratio) / 15;
    return direction === 'before' ? noon - hourAngle : noon + hourAngle;
  };

  const asrTime = (shadowFactor: number, dayFraction: number) => {
    const decl = declinationAt(dayFraction);
    const depression = -arccot(shadowFactor + tan(Math.abs(lat - decl)));
    return sunAngleTime(depression, dayFraction, 'after');
  };

  // Seed with rough guesses in UT hours, then refine. Each pass re-evaluates the
  // sun's position at a better estimate of the moment, which matters most for
  // Fajr and Isha where the sun's declination is moving fastest relative to the
  // shallow angle being solved for.
  //
  // The estimates are held in hours and divided by 24 at the point of use — the
  // helpers above take a fraction of a day, and feeding hours back into them
  // would ask for the sun's position days away from the date in question.
  let t = {
    imsak: 5,
    fajr: 5,
    sunrise: 6,
    dhuhr: 12,
    asr: 13,
    asrHanafi: 14,
    sunset: 18,
    maghrib: 18,
    isha: 18,
  };

  const horizon = riseSetAngle(elevation);
  const asFraction = (hours: number) => (Number.isFinite(hours) ? hours / 24 : 0.5);

  for (let pass = 0; pass < 3; pass += 1) {
    const next = {
      imsak:
        params.imsakParam.type === 'angle'
          ? sunAngleTime(params.imsakParam.value, asFraction(t.imsak), 'before')
          : sunAngleTime(params.fajrAngle, asFraction(t.fajr), 'before') -
            params.imsakParam.value / 60,
      fajr: sunAngleTime(params.fajrAngle, asFraction(t.fajr), 'before'),
      sunrise: sunAngleTime(horizon, asFraction(t.sunrise), 'before'),
      dhuhr: solarNoon(asFraction(t.dhuhr)),
      asr: asrTime(1, asFraction(t.asr)),
      asrHanafi: asrTime(2, asFraction(t.asrHanafi)),
      sunset: sunAngleTime(horizon, asFraction(t.sunset), 'after'),
      maghrib:
        params.maghribParam.type === 'angle'
          ? sunAngleTime(params.maghribParam.value, asFraction(t.maghrib), 'after')
          : sunAngleTime(horizon, asFraction(t.sunset), 'after') + params.maghribParam.value / 60,
      isha:
        params.ishaParam.type === 'angle'
          ? sunAngleTime(params.ishaParam.value, asFraction(t.isha), 'after')
          : NaN, // resolved below, once Maghrib is final
    };
    t = { ...t, ...next };
  }

  // Convert from UT hours to local wall-clock hours.
  const toLocal = (hours: number) => hours + utcOffset - lng / 15;

  const local: Record<string, number> = {
    imsak: toLocal(t.imsak),
    fajr: toLocal(t.fajr),
    sunrise: toLocal(t.sunrise),
    dhuhr: toLocal(t.dhuhr),
    asr: toLocal(t.asr),
    asrHanafi: toLocal(t.asrHanafi),
    sunset: toLocal(t.sunset),
    maghrib: toLocal(t.maghrib),
    isha: toLocal(t.isha),
  };

  if (params.highLatitudeRule !== 'none') {
    applyHighLatitudeRule(local, params, horizon);
  }

  // Interval-based Isha hangs off the final Maghrib, so it is resolved last.
  if (params.ishaParam.type === 'minutes') {
    local.isha = local.maghrib + params.ishaParam.value / 60;
  }

  // Zawaal is true solar noon; Dhuhr is announced a little after it.
  local.zawaal = local.dhuhr;
  local.dhuhr += params.dhuhrMinutes / 60;

  // The night runs from sunset to the next sunrise.
  const nightLength = 24 - (local.sunset - local.sunrise);
  local.midnight = local.sunset + nightLength / 2;
  local.lastThird = local.sunset + (nightLength * 2) / 3;
  local.ishraaq = local.sunrise + ishraaqOffset / 60;

  const adjustments = options.adjustments ?? {};
  const table = {} as PrayerTimeTable;
  for (const key of Object.keys(local) as TimeKey[]) {
    const value = local[key] * 60 + (adjustments[key] ?? 0);
    table[key] = value;
  }
  return table;
}

/**
 * Near the poles the sun may never dip to the Fajr/Isha depression angle. The
 * conventional fallbacks cap those times to a fraction of the night.
 */
function applyHighLatitudeRule(
  local: Record<string, number>,
  params: CalculationParams,
  horizon: number,
): void {
  const nightLength = 24 - (local.sunset - local.sunrise);

  const portionFor = (depression: number) => {
    switch (params.highLatitudeRule) {
      case 'angleBased':
        return (depression / 60) * nightLength;
      case 'seventhOfNight':
        return nightLength / 7;
      case 'middleOfNight':
      default:
        return nightLength / 2;
    }
  };

  const capBefore = (time: number, anchor: number, depression: number) => {
    const portion = portionFor(depression);
    const diff = anchor - time;
    return Number.isNaN(time) || diff > portion ? anchor - portion : time;
  };

  const capAfter = (time: number, anchor: number, depression: number) => {
    const portion = portionFor(depression);
    const diff = time - anchor;
    return Number.isNaN(time) || diff > portion ? anchor + portion : time;
  };

  const imsakDepression =
    params.imsakParam.type === 'angle' ? params.imsakParam.value : params.fajrAngle;
  const ishaDepression = params.ishaParam.type === 'angle' ? params.ishaParam.value : 18;
  const maghribDepression =
    params.maghribParam.type === 'angle' ? params.maghribParam.value : horizon;

  local.imsak = capBefore(local.imsak, local.sunrise, imsakDepression);
  local.fajr = capBefore(local.fajr, local.sunrise, params.fajrAngle);
  local.maghrib = capAfter(local.maghrib, local.sunset, maghribDepression);
  if (params.ishaParam.type === 'angle') {
    local.isha = capAfter(local.isha, local.sunset, ishaDepression);
  }
}

/** Qibla bearing from true north, degrees clockwise. */
export function qiblaDirection(location: Location): number {
  const kaabaLat = 21.4224779;
  const kaabaLng = 39.6255745;
  const deltaLng = kaabaLng - location.longitude;
  const y = sin(deltaLng);
  const x = cos(location.latitude) * tan(kaabaLat) - sin(location.latitude) * cos(deltaLng);
  return fixAngle(arctan2(y, x));
}

/** Great-circle distance to the Kaaba in kilometres. */
export function distanceToKaaba(location: Location): number {
  const kaabaLat = 21.4224779;
  const kaabaLng = 39.6255745;
  const earthRadiusKm = 6371;
  const dLat = dtr(kaabaLat - location.latitude);
  const dLng = dtr(kaabaLng - location.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    cos(location.latitude) * cos(kaabaLat) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Convenience: the length of a day in minutes, sunrise to sunset. */
export function daylightMinutes(table: PrayerTimeTable): number {
  return table.sunset - table.sunrise;
}

export function isValidTime(value: number): boolean {
  return Number.isFinite(value) && value > -MINUTES_PER_DAY && value < 2 * MINUTES_PER_DAY;
}

/**
 * The makrooh window around solar noon, when salaah is not performed.
 * The sun's disc takes roughly two minutes to cross the meridian, which is the
 * bracket masjid boards conventionally print either side of zawaal.
 */
export const ZAWAAL_WINDOW_MINUTES = 2;

export function zawaalWindow(table: PrayerTimeTable): { start: number; end: number } {
  return {
    start: table.zawaal - ZAWAAL_WINDOW_MINUTES,
    end: table.zawaal + ZAWAAL_WINDOW_MINUTES,
  };
}
