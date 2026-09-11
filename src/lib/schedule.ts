/**
 * Turns the config plus a calendar date into the day's actual timetable:
 * astronomical times, then the masjid's own adhaan and jamaat rules layered on
 * top, then any weekday/holiday override, then Jumu'ah on a Friday.
 */

import {
  computePrayerTimes,
  getMethod,
  PRAYER_KEYS,
  type CalculationParams,
  type PrayerKey,
  type PrayerTimeTable,
} from './prayer-times.ts';
import type {
  AdhaanRule,
  CalculationConfig,
  JamaatRule,
  MasjidConfig,
  PrayerSchedule,
  ScheduleOverride,
} from './config.ts';
import { toHijri, type HijriDate } from './hijri.ts';
import {
  addDays,
  parseClock,
  roundMinutes,
  toISODate,
  MINUTES_PER_DAY,
  minutesOfDay,
} from './time.ts';

export interface PrayerLabel {
  key: PrayerKey;
  name: string;
  arabic: string;
}

export const PRAYER_LABELS: PrayerLabel[] = [
  { key: 'fajr', name: 'Fajr', arabic: 'الفجر' },
  { key: 'dhuhr', name: 'Dhuhr', arabic: 'الظهر' },
  { key: 'asr', name: 'Asr', arabic: 'العصر' },
  { key: 'maghrib', name: 'Maghrib', arabic: 'المغرب' },
  { key: 'isha', name: 'Isha', arabic: 'العشاء' },
];

export function prayerLabel(key: PrayerKey): PrayerLabel {
  return PRAYER_LABELS.find((p) => p.key === key) ?? PRAYER_LABELS[0];
}

export interface ResolvedPrayer {
  key: PrayerKey;
  name: string;
  arabic: string;
  /** The astronomical time, before the masjid's rules. */
  calculated: number;
  adhaan: number;
  jamaat: number;
  /** Set when Jumu'ah has replaced Dhuhr. */
  isJumuah: boolean;
  /** Name of the override that changed this row, if any. */
  overriddenBy: string | null;
}

export interface DaySchedule {
  date: Date;
  /** Raw astronomical times, minutes from midnight. */
  solar: PrayerTimeTable;
  prayers: ResolvedPrayer[];
  hijri: HijriDate;
  isFriday: boolean;
  activeOverrides: ScheduleOverride[];
}

/** Build the calculation parameters the engine wants from the stored config. */
export function toCalculationParams(calc: CalculationConfig): CalculationParams {
  const method = getMethod(calc.method);
  const isCustom = calc.method === 'Custom';
  return {
    fajrAngle: isCustom ? calc.customFajrAngle : method.params.fajrAngle,
    ishaParam: isCustom ? calc.customIshaParam : method.params.ishaParam,
    maghribParam: isCustom ? calc.customMaghribParam : method.params.maghribParam,
    imsakParam: calc.imsakParam,
    dhuhrMinutes: isCustom ? calc.dhuhrMinutes : method.params.dhuhrMinutes,
    asrJuristic: calc.asrJuristic,
    highLatitudeRule: calc.highLatitudeRule,
  };
}

export function computeSolarTimes(config: MasjidConfig, date: Date): PrayerTimeTable {
  return computePrayerTimes(date, {
    location: {
      latitude: config.location.latitude,
      longitude: config.location.longitude,
      elevation: config.location.elevation,
    },
    params: toCalculationParams(config.calculation),
    utcOffset: config.location.utcOffsetHours ?? undefined,
    adjustments: config.calculation.adjustments,
    ishraaqOffset: config.calculation.ishraaqOffsetMinutes,
  });
}

/** The astronomical start of a prayer, honouring the Asr madhhab setting. */
function baseTimeFor(key: PrayerKey, solar: PrayerTimeTable, calc: CalculationConfig): number {
  if (key === 'asr') return calc.asrJuristic === 'hanafi' ? solar.asrHanafi : solar.asr;
  return solar[key];
}

function resolveAdhaan(rule: AdhaanRule, base: number): number {
  if (rule.mode === 'fixed') {
    const parsed = parseClock(rule.time);
    return parsed ?? base;
  }
  return base + rule.offsetMinutes;
}

function resolveJamaat(rule: JamaatRule, adhaan: number): number {
  switch (rule.mode) {
    case 'fixed': {
      const parsed = parseClock(rule.time);
      return parsed ?? adhaan;
    }
    case 'rounded': {
      const step = Math.max(1, rule.step);
      return Math.ceil((adhaan + rule.minutes) / step) * step;
    }
    case 'offset':
    default:
      return adhaan + rule.minutes;
  }
}

/** Overrides that apply to a given date, in config order. */
export function activeOverridesFor(config: MasjidConfig, date: Date): ScheduleOverride[] {
  const iso = toISODate(date);
  const weekday = date.getDay();
  return config.overrides.filter((override) => {
    if (!override.enabled) return false;
    const matchesWeekday = override.weekdays.includes(weekday);
    const matchesDate = override.dates.includes(iso);
    return matchesWeekday || matchesDate;
  });
}

export function buildDaySchedule(config: MasjidConfig, date: Date): DaySchedule {
  const solar = computeSolarTimes(config, date);
  const overrides = activeOverridesFor(config, date);
  const isFriday = date.getDay() === 5;
  const rounding = config.calculation.rounding;

  const prayers: ResolvedPrayer[] = PRAYER_KEYS.map((key) => {
    const label = prayerLabel(key);
    const base = baseTimeFor(key, solar, config.calculation);

    let schedule: PrayerSchedule = config.prayers[key];
    let overriddenBy: string | null = null;
    for (const override of overrides) {
      const patch = override.prayers[key];
      if (!patch) continue;
      schedule = { ...schedule, ...patch };
      overriddenBy = override.label;
    }

    let isJumuah = false;
    if (key === 'dhuhr' && isFriday && config.jumuah.enabled) {
      isJumuah = true;
      schedule = {
        adhaan: { mode: 'fixed', time: config.jumuah.adhaanTime },
        jamaat: { mode: 'fixed', time: config.jumuah.salaahTime },
      };
      overriddenBy = null;
    }

    const adhaan = resolveAdhaan(schedule.adhaan, base);
    const jamaat = resolveJamaat(schedule.jamaat, adhaan);

    return {
      key,
      name: isJumuah ? config.jumuah.label : label.name,
      arabic: isJumuah ? 'الجمعة' : label.arabic,
      calculated: roundMinutes(base, rounding),
      adhaan: roundMinutes(adhaan, rounding),
      jamaat: roundMinutes(jamaat, rounding),
      isJumuah,
      overriddenBy,
    };
  });

  const maghribPassed =
    config.calculation.hijriRollsAtMaghrib &&
    isSameCalendarDay(date, new Date()) &&
    minutesOfDay(new Date()) >= solar.maghrib;

  return {
    date,
    solar,
    prayers,
    hijri: toHijri(date, config.calculation.hijriAdjustment, maghribPassed),
    isFriday,
    activeOverrides: overrides,
  };
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

// --- next / current prayer -----------------------------------------------------

export interface PrayerPointer {
  prayer: ResolvedPrayer;
  /** Minutes from *now's* midnight; may exceed 1440 when it falls tomorrow. */
  adhaanAt: number;
  jamaatAt: number;
  /** True when the pointer refers to tomorrow's schedule. */
  tomorrow: boolean;
}

/**
 * The next salaah relative to `nowMinutes`. Rolls into tomorrow's Fajr once
 * Isha's jamaat has passed.
 */
export function findNextPrayer(
  today: DaySchedule,
  tomorrow: DaySchedule,
  nowMinutes: number,
): PrayerPointer {
  for (const prayer of today.prayers) {
    if (prayer.jamaat > nowMinutes) {
      return { prayer, adhaanAt: prayer.adhaan, jamaatAt: prayer.jamaat, tomorrow: false };
    }
  }
  const first = tomorrow.prayers[0];
  return {
    prayer: first,
    adhaanAt: first.adhaan + MINUTES_PER_DAY,
    jamaatAt: first.jamaat + MINUTES_PER_DAY,
    tomorrow: true,
  };
}

/** The salaah whose window we are currently inside (its adhaan has passed). */
export function findCurrentPrayer(today: DaySchedule, nowMinutes: number): ResolvedPrayer | null {
  let current: ResolvedPrayer | null = null;
  for (const prayer of today.prayers) {
    if (prayer.adhaan <= nowMinutes) current = prayer;
  }
  return current;
}

/** Convenience for building today's and tomorrow's schedules together. */
export function buildSchedulePair(config: MasjidConfig, date: Date): [DaySchedule, DaySchedule] {
  return [buildDaySchedule(config, date), buildDaySchedule(config, addDays(date, 1))];
}
