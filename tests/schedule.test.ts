import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_CONFIG, cloneConfig, type MasjidConfig } from '../src/lib/config.ts';
import { buildDaySchedule, buildSchedulePair, findCurrentPrayer, findNextPrayer } from '../src/lib/schedule.ts';
import { resolvePrayerState } from '../src/lib/prayer-state.ts';
import { parseClock, formatClock, formatDuration, MINUTES_PER_DAY } from '../src/lib/time.ts';

function config(mutate: (draft: MasjidConfig) => void = () => {}): MasjidConfig {
  const draft = cloneConfig(DEFAULT_CONFIG);
  // Pin the timezone so the tests do not depend on the machine's clock.
  draft.location.utcOffsetHours = 2;
  mutate(draft);
  return draft;
}

const at = (value: string) => parseClock(value)!;

// 2026-09-16 is a Wednesday, 2026-09-18 a Friday, 2026-09-20 a Sunday.
const WEDNESDAY = new Date(2026, 8, 16);
const FRIDAY = new Date(2026, 8, 18);
const SUNDAY = new Date(2026, 8, 20);

test('a fixed adhaan and jamaat are used verbatim', () => {
  const day = buildDaySchedule(config(), WEDNESDAY);
  const isha = day.prayers.find((p) => p.key === 'isha')!;
  assert.equal(formatClock(isha.adhaan, { hour12: false, padHour: true }), '19:00');
  assert.equal(formatClock(isha.jamaat, { hour12: false, padHour: true }), '19:10');
});

test('an offset jamaat follows its adhaan', () => {
  const day = buildDaySchedule(config(), WEDNESDAY);
  const fajr = day.prayers.find((p) => p.key === 'fajr')!;
  assert.equal(fajr.jamaat - fajr.adhaan, 20);
});

test('a calculated adhaan can be nudged', () => {
  const day = buildDaySchedule(
    config((draft) => {
      draft.prayers.asr.adhaan = { mode: 'calculated', offsetMinutes: 7 };
    }),
    WEDNESDAY,
  );
  const asr = day.prayers.find((p) => p.key === 'asr')!;
  assert.equal(asr.adhaan - asr.calculated, 7);
});

test('a rounded jamaat lands on the configured step', () => {
  const day = buildDaySchedule(
    config((draft) => {
      draft.prayers.asr.adhaan = { mode: 'fixed', time: '15:07' };
      draft.prayers.asr.jamaat = { mode: 'rounded', minutes: 10, step: 15 };
    }),
    WEDNESDAY,
  );
  const asr = day.prayers.find((p) => p.key === 'asr')!;
  // 15:07 + 10 = 15:17, rounded up to the next quarter hour.
  assert.equal(formatClock(asr.jamaat, { hour12: false, padHour: true }), '15:30');
});

test("Jumu'ah replaces Dhuhr on a Friday only", () => {
  const weekday = buildDaySchedule(config(), WEDNESDAY);
  const friday = buildDaySchedule(config(), FRIDAY);

  assert.equal(weekday.prayers.find((p) => p.key === 'dhuhr')!.isJumuah, false);

  const jumuah = friday.prayers.find((p) => p.key === 'dhuhr')!;
  assert.equal(jumuah.isJumuah, true);
  assert.equal(jumuah.adhaan, at('12:10'));
  assert.equal(jumuah.jamaat, at('12:40'));
  assert.equal(jumuah.name, "Jumu'ah");
});

test("a disabled Jumu'ah leaves Friday's Dhuhr alone", () => {
  const friday = buildDaySchedule(
    config((draft) => {
      draft.jumuah.enabled = false;
    }),
    FRIDAY,
  );
  const dhuhr = friday.prayers.find((p) => p.key === 'dhuhr')!;
  assert.equal(dhuhr.isJumuah, false);
  assert.equal(dhuhr.adhaan, at('12:45'));
});

test('the Sunday override applies on Sundays and not otherwise', () => {
  const sunday = buildDaySchedule(config(), SUNDAY);
  const wednesday = buildDaySchedule(config(), WEDNESDAY);

  const sundayDhuhr = sunday.prayers.find((p) => p.key === 'dhuhr')!;
  assert.equal(sundayDhuhr.adhaan, at('12:15'));
  assert.equal(sundayDhuhr.jamaat, at('12:30'));
  assert.equal(sundayDhuhr.overriddenBy, 'Sundays & Public Holidays');

  assert.equal(wednesday.prayers.find((p) => p.key === 'dhuhr')!.adhaan, at('12:45'));
  assert.equal(wednesday.prayers.find((p) => p.key === 'dhuhr')!.overriddenBy, null);
});

test('an override can be pinned to a specific date, such as a public holiday', () => {
  const holiday = new Date(2026, 8, 24); // a Thursday
  const day = buildDaySchedule(
    config((draft) => {
      draft.overrides[0].dates = ['2026-09-24'];
    }),
    holiday,
  );
  assert.equal(day.prayers.find((p) => p.key === 'dhuhr')!.adhaan, at('12:15'));
});

test("Jumu'ah wins over a weekday override on the same day", () => {
  const day = buildDaySchedule(
    config((draft) => {
      draft.overrides[0].weekdays = [5]; // also claim Friday
    }),
    FRIDAY,
  );
  const dhuhr = day.prayers.find((p) => p.key === 'dhuhr')!;
  assert.equal(dhuhr.isJumuah, true);
  assert.equal(dhuhr.adhaan, at('12:10'));
});

test('the next prayer rolls into tomorrow after the last jamaat', () => {
  const [today, tomorrow] = buildSchedulePair(config(), WEDNESDAY);
  const lateNight = at('23:30');
  const next = findNextPrayer(today, tomorrow, lateNight);

  assert.equal(next.prayer.key, 'fajr');
  assert.equal(next.tomorrow, true);
  assert.ok(next.jamaatAt > MINUTES_PER_DAY, 'tomorrow’s jamaat is expressed past midnight');
});

test('the current prayer is the last one whose adhaan has been called', () => {
  const day = buildDaySchedule(config(), WEDNESDAY);
  const asr = day.prayers.find((p) => p.key === 'asr')!;

  assert.equal(findCurrentPrayer(day, asr.adhaan + 1)!.key, 'asr');
  assert.equal(findCurrentPrayer(day, asr.adhaan - 1)!.key, 'dhuhr');
  assert.equal(findCurrentPrayer(day, at('01:00')), null);
});

// --- the alert state machine ------------------------------------------------------

test('the salaah phases run in order around a prayer', () => {
  const cfg = config();
  const [today, tomorrow] = buildSchedulePair(cfg, WEDNESDAY);
  const isha = today.prayers.find((p) => p.key === 'isha')!;
  const alerts = cfg.alerts;

  const phaseAt = (minutes: number) =>
    resolvePrayerState({ today, tomorrow, nowMinutes: minutes, alerts }).phase;

  assert.equal(phaseAt(isha.adhaan - alerts.preAdhaanMinutes - 1), 'idle');
  assert.equal(phaseAt(isha.adhaan - 5), 'approaching');
  assert.equal(phaseAt(isha.adhaan + 1), 'adhaan');
  // Jamaat is ten minutes after adhaan and the hold is four, so the wait begins then.
  assert.equal(phaseAt(isha.adhaan + alerts.adhaanHoldMinutes + 1), 'awaitingJamaat');
  assert.equal(phaseAt(isha.jamaat + 1), 'salaah');
  assert.equal(phaseAt(isha.jamaat + alerts.salaahInProgressMinutes.isha + 1), 'idle');
});

test('the adhaan hold never runs past the jamaat', () => {
  const cfg = config((draft) => {
    draft.alerts.adhaanHoldMinutes = 30; // longer than the ten-minute gap
  });
  const [today, tomorrow] = buildSchedulePair(cfg, WEDNESDAY);
  const isha = today.prayers.find((p) => p.key === 'isha')!;

  const state = resolvePrayerState({
    today,
    tomorrow,
    nowMinutes: isha.jamaat - 0.5,
    alerts: cfg.alerts,
  });
  assert.equal(state.phase, 'adhaan');
  assert.ok(state.secondsRemaining <= 30, 'the countdown ends at the iqamah');
});

test('the pre-adhaan notice is a banner, not a takeover', () => {
  const cfg = config();
  const [today, tomorrow] = buildSchedulePair(cfg, WEDNESDAY);
  const isha = today.prayers.find((p) => p.key === 'isha')!;

  const approaching = resolvePrayerState({
    today,
    tomorrow,
    nowMinutes: isha.adhaan - 3,
    alerts: cfg.alerts,
  });
  assert.equal(approaching.takeover, false);

  const adhaan = resolvePrayerState({
    today,
    tomorrow,
    nowMinutes: isha.adhaan + 1,
    alerts: cfg.alerts,
  });
  assert.equal(adhaan.takeover, true);
});

test('switching alerts off keeps the board rotating', () => {
  const cfg = config((draft) => {
    draft.alerts.enabled = false;
  });
  const [today, tomorrow] = buildSchedulePair(cfg, WEDNESDAY);
  const isha = today.prayers.find((p) => p.key === 'isha')!;

  const state = resolvePrayerState({
    today,
    tomorrow,
    nowMinutes: isha.adhaan + 1,
    alerts: cfg.alerts,
  });
  assert.equal(state.phase, 'idle');
  assert.equal(state.takeover, false);
});

test("last night's Isha can still be in progress just after midnight", () => {
  const cfg = config((draft) => {
    draft.prayers.isha = {
      adhaan: { mode: 'fixed', time: '23:50' },
      jamaat: { mode: 'fixed', time: '23:58' },
    };
    draft.alerts.salaahInProgressMinutes.isha = 20;
  });
  const [today, tomorrow] = buildSchedulePair(cfg, WEDNESDAY);

  // 00:05 the next morning — five minutes past midnight.
  const state = resolvePrayerState({ today, tomorrow, nowMinutes: 5, alerts: cfg.alerts });
  assert.equal(state.phase, 'salaah');
  assert.equal(state.prayer?.key, 'isha');
});

// --- formatting -------------------------------------------------------------------

test('clock formatting handles both conventions', () => {
  assert.equal(formatClock(0, { hour12: true }), '12:00');
  assert.equal(formatClock(0, { hour12: false, padHour: true }), '00:00');
  assert.equal(formatClock(13 * 60 + 5, { hour12: true }), '1:05');
  assert.equal(formatClock(13 * 60 + 5, { hour12: false }), '13:05');
  assert.equal(formatClock(13 * 60 + 5, { hour12: true, showMeridiem: true }), '1:05 PM');
  // Past midnight wraps rather than printing "25:00".
  assert.equal(formatClock(MINUTES_PER_DAY + 60, { hour12: false, padHour: true }), '01:00');
});

test('durations drop the hour when there is none', () => {
  assert.equal(formatDuration(65), '01:05');
  assert.equal(formatDuration(65, true), '0:01:05');
  assert.equal(formatDuration(3725), '1:02:05');
  assert.equal(formatDuration(-10), '00:00');
});

test('clock parsing rejects nonsense', () => {
  assert.equal(parseClock('07:45'), 465);
  assert.equal(parseClock('7:45'), 465);
  assert.equal(parseClock('25:00'), null);
  assert.equal(parseClock('07:99'), null);
  assert.equal(parseClock(''), null);
  assert.equal(parseClock(null), null);
});
